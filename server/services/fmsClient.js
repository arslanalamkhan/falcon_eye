// Client for the Falcon Mega Track (FMS) satellite API, v2 ("SecureAccessData").
//
// Auth: every call sends `Authorization: api_key <FMS_API_KEY>`. The key is
// never placed in a URL, log line or error message.
//
//   GET  {base}/GetTrackingDataByReferenceID/{cursor}
//          -> { ErrorCode, Description, AssetPosition: [...], NextReferenceID }
//   POST {base}/ResetSsasToNormal/{mobileId}          -> { ErrorCode, Description, ForwardMessageID }
//   GET  {base}/GetForwardMessageStatus/{mobileId}/{fwdId}
//          -> { ForwardMessageStatus, ErrorCode, Description, ForwardMessageID }
//   GET  {base}/PollCurrentPosition/{mobileId}        -> { ForwardMessageID, ErrorCode, Description }
//   POST {base}/SetSsasWebTestModeON/{mobileId}       -> { ErrorCode, Description }
//   POST {base}/SetSsasWebTestModeOff/{mobileId}      -> { ErrorCode, Description }
//
// Tracking is cursor-based, not a snapshot: each call returns every message
// with ReferenceID >= cursor (inclusive), plus NextReferenceID for the next
// call. Callers must persist the cursor. FMS retains history, so rewinding
// the cursor replays messages.
//
// Success is Number(ErrorCode) of 0 or 200. Failures arrive either as a
// non-2xx HTTP status or as a 200 body carrying a failing ErrorCode; both are
// mapped to FmsApiError. The command endpoints act on a REAL satellite
// terminal.
//
// Rate limit: 10 requests per 5 minutes per API key, shared across every
// endpoint and every process using the key (run exactly one server per key).
// `fmsBudget` is an in-process sliding window that keeps us under it and
// reserves headroom for operator-initiated commands.

// FMS_API_BASE_URL overrides the API *base* (the SecureAccessData root), NOT a
// full endpoint — operation names are appended to it.
function baseUrl() {
  return (process.env.FMS_API_BASE_URL || 'https://falconmegatrack.com/api/v2/json/SecureAccessData').replace(/\/+$/, '')
}

// A hung request must not stall the sync loop or a user's click forever
function timeoutMs() {
  return Number(process.env.FMS_REQUEST_TIMEOUT_MS) || 20_000
}

const FORWARD_STATUS = {
  0: 'SUBMITTED',
  1: 'RECEIVED',
  2: 'ERROR',
  3: 'DELIVERY_FAILED',
  4: 'TIMED_OUT',
  5: 'CANCELLED',
  6: 'WAITING',
  7: 'NA',
  8: 'TRANSMITTED',
}

/** "1" / 1 / "RECEIVED" / "received" -> "RECEIVED"; anything unrecognised -> null. */
function normalizeForwardStatus(raw) {
  if (raw === undefined || raw === null) return null
  const s = String(raw).trim().toUpperCase()
  if (/^\d+$/.test(s)) return FORWARD_STATUS[Number(s)] || null
  return Object.values(FORWARD_STATUS).includes(s) ? s : null
}

class FmsApiError extends Error {
  /**
   * @param {string} kind   rate_limit | busy | unreachable | not_found | forbidden | auth | bad_request | network | server
   * @param {number} fmsCode HTTP status / ErrorCode that signalled failure (0 for network/timeout)
   * @param {string} message operator-safe text (no key, no URL)
   */
  constructor(kind, fmsCode, message) {
    super(message)
    this.name = 'FmsApiError'
    this.kind = kind
    this.fmsCode = fmsCode
  }
}

// ── Shared request budget ────────────────────────────────────────────
const PRIORITY_FREE_SLOTS = { command: 1, tracking: 2, status: 3 }

function createBudget() {
  let now = () => Date.now()
  let stamps = []            // request timestamps inside the window
  let exhaustedUntil = 0

  const limit = () => Math.max(1, Number(process.env.FMS_RATE_LIMIT) || 10)
  const windowMs = () => 300_000

  function prune() {
    const cutoff = now() - windowMs()
    stamps = stamps.filter((t) => t > cutoff)
  }

  return {
    /** Records a slot and returns true if `priority` may proceed now. */
    tryTake(priority = 'command') {
      const need = PRIORITY_FREE_SLOTS[priority] ?? 1
      const t = now()
      if (t < exhaustedUntil) return false
      prune()
      if (limit() - stamps.length < need) return false
      stamps.push(t)
      return true
    },

    /** Milliseconds until a request of this priority could be admitted (0 = now). */
    retryAfterMs(priority = 'command') {
      const t = now()
      let wait = Math.max(0, exhaustedUntil - t)
      prune()
      const need = PRIORITY_FREE_SLOTS[priority] ?? 1
      const mustDrop = stamps.length - (limit() - need)   // oldest stamps that must expire
      if (mustDrop > 0) wait = Math.max(wait, stamps[mustDrop - 1] + windowMs() - t)
      return wait
    },

    /** FMS itself said "limit exceeded": treat the window as full for 300 s. */
    markExhausted() {
      exhaustedUntil = now() + windowMs()
    },

    /** Test hook: clear all state, optionally injecting a clock. */
    _resetForTests({ now: clock } = {}) {
      stamps = []
      exhaustedUntil = 0
      now = clock || (() => Date.now())
    },
  }
}

const fmsBudget = createBudget()

// ── Error mapping ────────────────────────────────────────────────────
function describeError(kind, fmsCode, fmsText) {
  switch (kind) {
    case 'rate_limit':
      return 'FMS request limit reached (10 requests per 5 minutes, shared by the whole system). Try again in a few minutes.'
    case 'busy':
      return 'FMS is already processing a command for this terminal — wait about 5 minutes.'
    case 'unreachable':
      return 'The satellite terminal is not reachable right now. Try again in a few minutes.'
    case 'not_found':
      return 'FMS has no satellite terminal registered for this device ID.'
    case 'forbidden':
      return 'FMS refused the request: the key is locked or this terminal does not belong to it.'
    case 'auth':
      return fmsCode === 401
        ? "FMS rejected this server's IP address. Ask Falcon Mega Track to allow-list it."
        : 'FMS rejected the API key. Check FMS_API_KEY on the server.'
    case 'bad_request':
      return `FMS rejected the request${fmsText ? `: ${fmsText}` : '.'}`
    case 'network':
      return 'Could not reach the FMS service. Check the server\'s internet connection and try again.'
    default:
      return `FMS reported an error (${fmsCode})${fmsText ? `: ${fmsText}` : '.'}`
  }
}

function classify(code, text) {
  const t = text || ''
  if (code === 429) return 'rate_limit'
  if (code === 403) return /limit|exceed|too many/i.test(t) ? 'rate_limit' : 'forbidden'
  if (code === 651) return 'busy'
  if (code === 601) return 'unreachable'
  if (code === 404) return 'not_found'
  if (code === 401) return 'auth'
  if (code === 400) return /api.?key|authori[sz]|unauthori[sz]/i.test(t) ? 'auth' : 'bad_request'
  return 'server'
}

function makeError(code, text) {
  const kind = classify(code, text)
  // Strip the key if FMS ever echoes it, and keep operator text short
  let safe = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 140)
  const key = process.env.FMS_API_KEY
  if (key && safe.includes(key)) safe = safe.split(key).join('[redacted]')
  return new FmsApiError(kind, code, describeError(kind, code, safe))
}

const isSuccessCode = (c) => c === 0 || c === 200

/**
 * One FMS request, through the shared budget. Resolves with the parsed body
 * on success; throws FmsApiError otherwise.
 */
async function request(method, path, priority) {
  const apiKey = process.env.FMS_API_KEY
  if (!apiKey) throw new FmsApiError('auth', 0, 'FMS is not configured on this server (FMS_API_KEY is not set).')

  if (!fmsBudget.tryTake(priority)) {
    const secs = Math.ceil(fmsBudget.retryAfterMs(priority) / 1000)
    const err = new FmsApiError('rate_limit', 429, describeError('rate_limit', 429))
    err.retryAfterS = secs
    throw err
  }

  let res
  try {
    res = await fetch(`${baseUrl()}${path}`, {
      method,
      headers: { Authorization: `api_key ${apiKey}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs()),
    })
  } catch (err) {
    // Never echo the URL or key
    const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError'
    const e = new FmsApiError('network', 0, timedOut
      ? `FMS did not respond within ${Math.round(timeoutMs() / 1000)} s. Try again shortly.`
      : describeError('network', 0))
    e.detail = timedOut ? 'timeout' : (err?.cause?.code || 'unreachable')
    throw e
  }

  const raw = await res.text().catch(() => '')
  let body = null
  try { body = JSON.parse(raw) } catch { /* non-JSON body */ }
  const bodyCode = body && body.ErrorCode !== undefined && body.ErrorCode !== null ? Number(body.ErrorCode) : NaN
  const description = body && typeof body.Description === 'string' ? body.Description : ''

  let failure = null
  if (!res.ok) {
    // Prefer FMS's own code when it supplied a failing one (e.g. 601 under HTTP 400/500)
    const code = Number.isFinite(bodyCode) && !isSuccessCode(bodyCode) ? bodyCode : res.status
    failure = makeError(code, description || (body ? '' : raw))
  } else if (!body || typeof body !== 'object') {
    failure = new FmsApiError('server', res.status, 'FMS returned an unreadable response.')
  } else if (!isSuccessCode(bodyCode)) {
    failure = makeError(Number.isFinite(bodyCode) ? bodyCode : res.status, description)
  }

  if (failure) {
    if (failure.kind === 'rate_limit') fmsBudget.markExhausted()
    throw failure
  }
  return body
}

function forwardMessageIdOf(data) {
  const id = Number(data.ForwardMessageID)
  if (!Number.isFinite(id)) throw new FmsApiError('server', 0, 'FMS accepted the command but returned no message ID.')
  return id
}

const enc = encodeURIComponent

// ── Public API ───────────────────────────────────────────────────────
async function fetchTrackingData(cursor, { priority = 'tracking' } = {}) {
  const data = await request('GET', `/GetTrackingDataByReferenceID/${enc(cursor)}`, priority)
  return {
    assetPositions:  data.AssetPosition || [],
    nextReferenceId: data.NextReferenceID,
  }
}

/** Clear a terminal's SSAS alarm remotely. Delivery is confirmed via getForwardMessageStatus. */
async function resetSsasToNormal(mobileId, { priority = 'command' } = {}) {
  const data = await request('POST', `/ResetSsasToNormal/${enc(mobileId)}`, priority)
  return { forwardMessageId: forwardMessageIdOf(data), description: data.Description || '' }
}

async function getForwardMessageStatus(mobileId, forwardMessageId, { priority = 'status' } = {}) {
  const data = await request('GET', `/GetForwardMessageStatus/${enc(mobileId)}/${enc(forwardMessageId)}`, priority)
  return {
    status:           normalizeForwardStatus(data.ForwardMessageStatus),
    raw:              data.ForwardMessageStatus,
    description:      data.Description || '',
    forwardMessageId: Number.isFinite(Number(data.ForwardMessageID)) ? Number(data.ForwardMessageID) : Number(forwardMessageId),
  }
}

/** Ask the terminal to report its current position (a forward message, like reset). */
async function pollCurrentPosition(mobileId, { priority = 'command' } = {}) {
  const data = await request('GET', `/PollCurrentPosition/${enc(mobileId)}`, priority)
  return { forwardMessageId: forwardMessageIdOf(data), description: data.Description || '' }
}

/** Put the terminal's SSAS into / out of web test mode (synchronous, no forward message). */
async function setSsasTestMode(mobileId, enabled, { priority = 'command' } = {}) {
  const op = enabled ? 'SetSsasWebTestModeON' : 'SetSsasWebTestModeOff'
  const data = await request('POST', `/${op}/${enc(mobileId)}`, priority)
  return { description: data.Description || '' }
}

module.exports = {
  fetchTrackingData,
  resetSsasToNormal,
  getForwardMessageStatus,
  pollCurrentPosition,
  setSsasTestMode,
  FmsApiError,
  fmsBudget,
  FORWARD_STATUS,
  normalizeForwardStatus,
}
