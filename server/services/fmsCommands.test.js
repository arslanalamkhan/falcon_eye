const { test } = require('node:test')
const assert = require('node:assert/strict')
const cmds = require('./fmsCommands')

const { outcomeForForwardStatus, buildResetUpdate, decideTransition, runTrackerPass, _deps } = cmds

test('outcomeForForwardStatus maps all nine FMS statuses', () => {
  const expected = {
    SUBMITTED: 'pending', WAITING: 'pending', TRANSMITTED: 'pending',
    RECEIVED: 'completed',
    ERROR: 'failed', DELIVERY_FAILED: 'failed', TIMED_OUT: 'failed', CANCELLED: 'failed', NA: 'failed',
  }
  for (const [name, outcome] of Object.entries(expected)) {
    assert.equal(outcomeForForwardStatus(name), outcome, name)
  }
  assert.equal(outcomeForForwardStatus(null), 'pending')
})

test('buildResetUpdate writes alert/status/fms_reset_at and a reset_remote log', () => {
  const nowIso = '2026-11-12T08:30:00.000Z'
  const u = buildResetUpdate({
    siteId: 'jaffer', commandId: 42, siteLabel: 'Jaffer Express',
    gps: { lat: '30.1', lng: '71.4', status: 'live', speed_kmh: '0' }, nowIso,
  })
  assert.deepEqual(Object.keys(u).sort(), [
    'logs/2026-11-12/fmsreset_42', 'sites/jaffer/alert', 'sites/jaffer/fms_reset_at', 'sites/jaffer/status',
  ])
  assert.equal(u['sites/jaffer/alert'], 'false')
  assert.equal(u['sites/jaffer/status'], 'standby')
  assert.equal(u['sites/jaffer/fms_reset_at'], nowIso)
  assert.deepEqual(u['logs/2026-11-12/fmsreset_42'], {
    site_id: 'jaffer', site_label: 'Jaffer Express', event: 'reset_remote',
    timestamp: nowIso, lat: '30.1', lng: '71.4', gps_status: 'live',
  })
})

test('buildResetUpdate tolerates a site with no gps', () => {
  const u = buildResetUpdate({ siteId: 's', commandId: 1, siteLabel: null, gps: undefined, nowIso: '2026-01-02T00:00:00.000Z' })
  const log = u['logs/2026-01-02/fmsreset_1']
  assert.equal(log.lat, '')
  assert.equal(log.site_label, 's')
})

test('decideTransition: final statuses win, expiry times out, otherwise stays pending', () => {
  const row = { kind: 'reset', created_at: new Date(1_000_000) }
  const T = 180_000
  assert.equal(decideTransition(row, 'RECEIVED', 1_000_000 + 10, T).status, 'completed')
  assert.equal(decideTransition(row, 'DELIVERY_FAILED', 1_000_000 + 10, T).status, 'failed')
  assert.equal(decideTransition(row, 'WAITING', 1_000_000 + 10, T), null)
  assert.equal(decideTransition(row, null, 1_000_000 + T, T).status, 'timed_out')
  assert.equal(decideTransition(row, 'WAITING', 1_000_000 + T, T).status, 'timed_out')
  // delivered at the deadline still counts
  assert.equal(decideTransition(row, 'RECEIVED', 1_000_000 + T, T).status, 'completed')
})

// Minimal fake pool: serves the pending-rows SELECT and records UPDATEs.
function fakePool(pendingRows) {
  const updates = []
  return {
    updates,
    async query(sql, params) {
      if (/FROM fms_commands c JOIN sites/.test(sql)) return { rows: pendingRows }
      if (/UPDATE fms_commands/.test(sql) && /RETURNING/.test(sql)) {
        updates.push({ id: params[0], status: params[1], description: params[2] })
        return { rows: [{ id: params[0] }] }
      }
      return { rows: [] }
    },
  }
}

test('tracker pass times out overdue rows when the budget is exhausted', async () => {
  const saved = { ..._deps }
  const now = 10_000_000
  const rateLimited = Object.assign(new Error('budget'), { name: 'FmsApiError', kind: 'rate_limit', fmsCode: 429 })
  const pool = fakePool([
    { id: 1, site_id: 'a', mobile_id: 'M1', kind: 'reset', forward_message_id: 11, created_at: new Date(now - 200_000) },
    { id: 2, site_id: 'b', mobile_id: 'M2', kind: 'poll_position', forward_message_id: 12, created_at: new Date(now - 5_000) },
  ])
  const audits = []
  let statusCalls = 0
  Object.assign(_deps, {
    pool,
    now: () => now,
    audit: async (...a) => { audits.push(a) },
    client: { getForwardMessageStatus: async () => { statusCalls++; throw rateLimited } },
  })
  try {
    const seen = await runTrackerPass()
    assert.equal(seen, 2)
    assert.equal(statusCalls, 1, 'stops asking after the first rate_limit')
    assert.equal(pool.updates.length, 1)
    assert.equal(pool.updates[0].id, 1)
    assert.equal(pool.updates[0].status, 'timed_out')
    assert.match(pool.updates[0].description, /did not confirm within 3 minutes/)
    assert.equal(audits[0][1], 'fms.reset.failed')
  } finally {
    Object.assign(_deps, saved)
  }
})

test('tracker pass completes a reset: writes Firebase then marks completed', async () => {
  const saved = { ..._deps }
  const now = Date.parse('2026-11-12T09:00:00.000Z')
  const pool = fakePool([
    { id: 7, site_id: 'jaffer', site_label: 'Jaffer', mobile_id: 'M1', kind: 'reset', forward_message_id: 99, created_at: new Date(now - 60_000) },
  ])
  const written = []
  const rtdb = {
    ref: (path) => ({
      get: async () => ({ val: () => ({ label: 'Jaffer Express', gps: { lat: '1', lng: '2', status: 'live' } }) }),
      update: async (u) => { written.push({ path, u }) },
    }),
  }
  const audits = []
  Object.assign(_deps, {
    pool, now: () => now, getFirebaseDb: () => rtdb,
    audit: async (...a) => { audits.push(a) },
    client: { getForwardMessageStatus: async () => ({ status: 'RECEIVED' }) },
  })
  try {
    await runTrackerPass()
    assert.equal(written.length, 1)
    assert.equal(written[0].u['sites/jaffer/alert'], 'false')
    assert.ok(written[0].u['logs/2026-11-12/fmsreset_7'])
    assert.equal(pool.updates[0].status, 'completed')
    assert.equal(audits[0][1], 'fms.reset.completed')
  } finally {
    Object.assign(_deps, saved)
  }
})
