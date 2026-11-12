// Run with: npm test   (node's built-in test runner). global.fetch is mocked —
// these tests never touch the live FMS API.
const test = require('node:test')
const assert = require('node:assert/strict')
const client = require('./fmsClient')
const { fmsBudget, FmsApiError, normalizeForwardStatus } = client

const KEY = 'test-key-1234567890'
const realFetch = global.fetch
let calls

function mockFetch(handler) {
  calls = []
  global.fetch = async (url, init) => {
    calls.push({ url: String(url), init })
    return handler(url, init)
  }
}
const json = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
})

test.beforeEach(() => {
  process.env.FMS_API_KEY = KEY
  delete process.env.FMS_API_BASE_URL
  delete process.env.FMS_RATE_LIMIT
  fmsBudget._resetForTests()
})
test.afterEach(() => { global.fetch = realFetch })

async function rejects(promise) {
  try { await promise } catch (e) { return e }
  assert.fail('expected rejection')
}

test('sends the api_key header and never puts the key in the URL', async () => {
  mockFetch(() => json({ ErrorCode: 0, AssetPosition: [], NextReferenceID: 5 }))
  const r = await client.fetchTrackingData(42)
  assert.deepEqual(r, { assetPositions: [], nextReferenceId: 5 })
  assert.equal(calls[0].init.headers.Authorization, `api_key ${KEY}`)
  assert.ok(!calls[0].url.includes(KEY))
  assert.equal(calls[0].url, 'https://falconmegatrack.com/api/v2/json/SecureAccessData/GetTrackingDataByReferenceID/42')
  assert.equal(calls[0].init.method, 'GET')
})

test('each function uses the documented method and path (params URL-encoded)', async () => {
  mockFetch(() => json({ ErrorCode: 200, Description: 'ok', ForwardMessageID: 77, ForwardMessageStatus: '1' }))
  await client.resetSsasToNormal('A/B 1')
  await client.getForwardMessageStatus('M1', 77)
  await client.pollCurrentPosition('M1')
  await client.setSsasTestMode('M1', true)
  await client.setSsasTestMode('M1', false)
  const base = 'https://falconmegatrack.com/api/v2/json/SecureAccessData'
  assert.deepEqual(calls.map((c) => [c.init.method, c.url]), [
    ['POST', `${base}/ResetSsasToNormal/A%2FB%201`],
    ['GET',  `${base}/GetForwardMessageStatus/M1/77`],
    ['GET',  `${base}/PollCurrentPosition/M1`],
    ['POST', `${base}/SetSsasWebTestModeON/M1`],
    ['POST', `${base}/SetSsasWebTestModeOff/M1`],
  ])
})

test('FMS_API_BASE_URL overrides the base', async () => {
  process.env.FMS_API_BASE_URL = 'http://localhost:9/x/'
  mockFetch(() => json({ ErrorCode: 0, Description: 'ok', ForwardMessageID: 1 }))
  await client.pollCurrentPosition('M1')
  assert.equal(calls[0].url, 'http://localhost:9/x/PollCurrentPosition/M1')
})

test('ErrorCode 0 and 200 are both success; return shapes', async () => {
  mockFetch(() => json({ ErrorCode: 0, Description: 'Queued', ForwardMessageID: '123' }))
  assert.deepEqual(await client.resetSsasToNormal('M1'), { forwardMessageId: 123, description: 'Queued' })
  mockFetch(() => json({ ErrorCode: 200, Description: 'Test on' }))
  assert.deepEqual(await client.setSsasTestMode('M1', true), { description: 'Test on' })
})

test('forward status: digit and name both normalise; unknown -> null', async () => {
  mockFetch(() => json({ ErrorCode: 0, ForwardMessageStatus: '1', Description: 'd', ForwardMessageID: 9 }))
  const a = await client.getForwardMessageStatus('M1', 9)
  assert.equal(a.status, 'RECEIVED')
  assert.equal(a.raw, '1')
  assert.equal(a.forwardMessageId, 9)
  mockFetch(() => json({ ErrorCode: 0, ForwardMessageStatus: 'RECEIVED', ForwardMessageID: 9 }))
  assert.equal((await client.getForwardMessageStatus('M1', 9)).status, 'RECEIVED')
  mockFetch(() => json({ ErrorCode: 0, ForwardMessageStatus: 'WAT', ForwardMessageID: 9 }))
  assert.equal((await client.getForwardMessageStatus('M1', 9)).status, null)
  assert.equal(normalizeForwardStatus(8), 'TRANSMITTED')
  assert.equal(normalizeForwardStatus('timed_out'), 'TIMED_OUT')
})

test('HTTP 403 "limit exceeded" -> rate_limit and the budget is marked exhausted', async () => {
  mockFetch(() => json('API call limit exceeded', 403))
  const e = await rejects(client.fetchTrackingData(1))
  assert.ok(e instanceof FmsApiError)
  assert.equal(e.kind, 'rate_limit')
  assert.equal(e.fmsCode, 403)
  assert.match(e.message, /10 requests/)
  assert.equal(fmsBudget.tryTake('command'), false, 'even a command is refused while exhausted')
  assert.ok(fmsBudget.retryAfterMs() > 290_000)
})

test('HTTP 403 without limit text -> forbidden (budget untouched)', async () => {
  mockFetch(() => json({ ErrorCode: 403, Description: 'Key locked' }, 403))
  const e = await rejects(client.resetSsasToNormal('M1'))
  assert.equal(e.kind, 'forbidden')
  assert.equal(fmsBudget.tryTake('command'), true)
})

test('body ErrorCode 601 under HTTP 200 -> unreachable; 651 -> busy', async () => {
  mockFetch(() => json({ ErrorCode: 601, Description: 'x' }))
  let e = await rejects(client.resetSsasToNormal('M1'))
  assert.equal(e.kind, 'unreachable')
  assert.equal(e.fmsCode, 601)
  assert.match(e.message, /not reachable/)
  mockFetch(() => json({ ErrorCode: 651, Description: 'x' }))
  e = await rejects(client.resetSsasToNormal('M1'))
  assert.equal(e.kind, 'busy')
  assert.match(e.message, /5 minutes/)
})

test('FMS code in the body wins over a generic HTTP status', async () => {
  mockFetch(() => json({ ErrorCode: 601, Description: 'x' }, 500))
  assert.equal((await rejects(client.pollCurrentPosition('M1'))).kind, 'unreachable')
})

test('other statuses: 404 not_found, 401 auth, 400 bad_request, 400 key -> auth, 500 server', async () => {
  const kindFor = async (body, status) => {
    mockFetch(() => json(body, status))
    return (await rejects(client.fetchTrackingData(1))).kind
  }
  assert.equal(await kindFor({ ErrorCode: 404, Description: 'No asset' }, 404), 'not_found')
  assert.equal(await kindFor('nope', 401), 'auth')
  assert.equal(await kindFor({ ErrorCode: 400, Description: 'Bad cursor' }, 400), 'bad_request')
  assert.equal(await kindFor({ ErrorCode: 400, Description: 'API key invalid or missing' }, 400), 'auth')
  assert.equal(await kindFor('boom', 500), 'server')
  mockFetch(() => json('<html>not json</html>'))
  assert.equal((await rejects(client.fetchTrackingData(1))).kind, 'server')
  mockFetch(() => json({ Description: 'no code' }))
  assert.equal((await rejects(client.fetchTrackingData(1))).kind, 'server')
})

test('401 message mentions the IP; no message contains the key', async () => {
  mockFetch(() => json(`bad ${KEY}`, 400))
  const e1 = await rejects(client.fetchTrackingData(1))
  assert.ok(!e1.message.includes(KEY))
  mockFetch(() => json('x', 401))
  const e2 = await rejects(client.fetchTrackingData(1))
  assert.match(e2.message, /IP address/)
})

test('budget priorities: status refused before tracking, tracking before command', () => {
  process.env.FMS_RATE_LIMIT = '10'
  for (let i = 0; i < 7; i++) assert.equal(fmsBudget.tryTake('command'), true)   // 3 free
  assert.equal(fmsBudget.tryTake('status'), true)                                // needs 3 -> ok, now 2 free
  assert.equal(fmsBudget.tryTake('status'), false)                               // needs 3
  assert.equal(fmsBudget.tryTake('tracking'), true)                              // needs 2 -> ok, now 1 free
  assert.equal(fmsBudget.tryTake('tracking'), false)                             // needs 2
  assert.equal(fmsBudget.tryTake('command'), true)                               // last slot
  assert.equal(fmsBudget.tryTake('command'), false)
})

test('budget window slides and retryAfterMs reports when a slot frees', () => {
  let t = 1_000_000
  fmsBudget._resetForTests({ now: () => t })
  for (let i = 0; i < 10; i++) { fmsBudget.tryTake('command'); t += 1000 }       // stamps at +0..+9s
  assert.equal(fmsBudget.tryTake('command'), false)
  assert.equal(fmsBudget.retryAfterMs('command'), 300_000 - 10_000)              // oldest at +0, now +10s
  t += 290_000                                                                   // oldest expires
  assert.equal(fmsBudget.tryTake('command'), true)
})

test('refusal by our own budget does not call fetch and reports fmsCode 429', async () => {
  mockFetch(() => json({ ErrorCode: 0, AssetPosition: [] }))
  for (let i = 0; i < 9; i++) fmsBudget.tryTake('command')                       // 1 free
  const e = await rejects(client.fetchTrackingData(1))                           // tracking needs 2
  assert.equal(e.kind, 'rate_limit')
  assert.equal(e.fmsCode, 429)
  assert.equal(calls.length, 0)
  await client.resetSsasToNormal('M1').catch(() => {})                           // command still allowed
  assert.equal(calls.length, 1)
})

test('timeout and connection failure -> network', async () => {
  mockFetch(() => { const e = new Error('t'); e.name = 'TimeoutError'; throw e })
  let e = await rejects(client.pollCurrentPosition('M1'))
  assert.equal(e.kind, 'network')
  assert.equal(e.fmsCode, 0)
  assert.ok(!e.message.includes('http'))
  mockFetch(() => { throw new TypeError('fetch failed') })
  e = await rejects(client.pollCurrentPosition('M1'))
  assert.equal(e.kind, 'network')
})

test('missing API key throws auth without fetching or spending budget', async () => {
  delete process.env.FMS_API_KEY
  mockFetch(() => json({}))
  const e = await rejects(client.fetchTrackingData(1))
  assert.equal(e.kind, 'auth')
  assert.equal(calls.length, 0)
  assert.equal(fmsBudget.retryAfterMs(), 0)
})
