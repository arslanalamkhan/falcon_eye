// Run with: npm test   (node's built-in test runner)
const test = require('node:test')
const assert = require('node:assert/strict')
const { reduceSite, gpsStatus } = require('./fmsState')

const MIN = 60_000
const NOW = Date.parse('2026-09-28T10:30:00Z')
const OPTS = { nowMs: NOW, recentMs: 10 * MIN, staleMs: 60 * MIN }

let nextRef = 1000
function msg(type, isoTime) {
  return {
    referenceId: nextRef++,
    type,
    lat: 31.1415,
    lng: 74.4605,
    speedKmh: '0.0',
    receivedAt: new Date(isoTime).toISOString(),
    receivedMs: Date.parse(isoTime),
  }
}
const ALERT = 'Ship_Security_Alert'
const RESET = 'SSAS_Reset_Acknowledgement'
const TEST = 'SSAS_Test'
const POS = 'Automatic_Position_Report'

test('first alert is the onset; later alerts are repeats that keep the original trigger time', () => {
  // Real pattern from 2026-09-28: onset 07:54:47, repeats every 15 min
  const msgs = [msg(ALERT, '2026-09-28T07:54:47Z'), msg(ALERT, '2026-09-28T08:08:35Z'), msg(ALERT, '2026-09-28T08:23:32Z')]
  const r = reduceSite({ alert: false }, msgs, OPTS)

  assert.equal(r.alert, true)
  assert.equal(r.patch.alert, 'true')
  assert.equal(r.patch.last_alert, '2026-09-28T07:54:47.000Z', 'trigger time is the onset, not the latest repeat')
  assert.deepEqual(r.logs.map((l) => l.event), ['alert', 'alert_repeat', 'alert_repeat'])
  assert.equal(r.consumed.length, 3)
  assert.equal(r.deferred.length, 0)
})

test('a repeat arriving in a later tick does not re-trigger or move last_alert', () => {
  const r = reduceSite({ alert: true }, [msg(ALERT, '2026-09-28T10:23:35Z')], OPTS)
  assert.equal(r.patch.alert, undefined, 'no alert state change')
  assert.equal(r.patch.last_alert, undefined, 'onset time untouched')
  assert.deepEqual(r.logs.map((l) => l.event), ['alert_repeat'])
  assert.equal(r.patch.gps.updated, '2026-09-28T10:23:35.000Z', 'position still updates')
})

test('reset clears an alarm raised in an earlier tick', () => {
  const r = reduceSite({ alert: true }, [msg(RESET, '2026-09-28T10:28:00Z')], OPTS)
  assert.equal(r.alert, false)
  assert.equal(r.patch.alert, 'false')
  assert.equal(r.patch.status, 'standby')
  assert.deepEqual(r.logs.map((l) => l.event), ['reset_acknowledged'])
})

test('fresh onset + reset in the same batch: the reset is deferred so receivers still ring', () => {
  const onset = msg(ALERT, '2026-09-28T10:28:00Z')   // 2 min ago — fresh
  const reset = msg(RESET, '2026-09-28T10:29:00Z')
  const after = msg(POS, '2026-09-28T10:29:30Z')
  const r = reduceSite({ alert: false }, [onset, reset, after], OPTS)

  assert.equal(r.alert, true, 'this tick leaves the alarm visible')
  assert.equal(r.patch.alert, 'true')
  assert.deepEqual(r.consumed, [onset.referenceId])
  assert.deepEqual(r.deferred, [reset.referenceId, after.referenceId], 'reset and everything after it wait for next tick')

  // Next tick: the deferred reset now clears it normally
  const next = reduceSite({ alert: true }, [reset, after], OPTS)
  assert.equal(next.alert, false)
  assert.deepEqual(next.deferred, [])
})

test('stale onset + reset in one batch (catch-up after downtime) is applied in full, no buzzing', () => {
  // Real pattern from 2026-09-23: onset 08:17, repeats, reset 08:47 — days old
  const msgs = [
    msg(ALERT, '2026-09-23T08:17:05Z'),
    msg(ALERT, '2026-09-23T08:32:05Z'),
    msg(ALERT, '2026-09-23T08:47:07Z'),
    msg(RESET, '2026-09-23T08:47:45Z'),
  ]
  const r = reduceSite({ alert: false }, msgs, OPTS)
  assert.equal(r.alert, false)
  assert.equal(r.deferred.length, 0)
  assert.deepEqual(r.logs.map((l) => l.event), ['alert', 'alert_repeat', 'alert_repeat', 'reset_acknowledged'])
})

test('SSAS test never raises an alarm', () => {
  const r = reduceSite({ alert: false }, [msg(TEST, '2026-09-28T10:25:00Z'), msg(RESET, '2026-09-28T10:26:00Z')], OPTS)
  assert.equal(r.alert, false)
  assert.equal(r.patch.alert, undefined)
  assert.deepEqual(r.logs.map((l) => l.event), ['test_alert', 'reset_acknowledged'])
})

test('position reports only update GPS', () => {
  const r = reduceSite({ alert: false }, [msg(POS, '2026-09-28T10:20:00Z')], OPTS)
  assert.equal(r.patch.alert, undefined)
  assert.equal(r.logs.length, 0)
  assert.equal(r.history.length, 1)
  assert.equal(r.patch.gps.status, 'live')
})

test('a report older than the stale threshold is marked as last-known, not live', () => {
  const r = reduceSite({ alert: false }, [msg(POS, '2026-09-28T08:00:00Z')], OPTS) // 2.5h old
  assert.equal(r.patch.gps.status, 'fallback')
})

test('alarm raised again after a reset is a new onset with a new trigger time', () => {
  const msgs = [
    msg(ALERT, '2026-09-28T09:00:00Z'),
    msg(RESET, '2026-09-28T09:05:00Z'),
    msg(ALERT, '2026-09-28T09:40:00Z'),
  ]
  const r = reduceSite({ alert: false }, msgs, OPTS)
  assert.equal(r.alert, true)
  assert.equal(r.patch.last_alert, '2026-09-28T09:40:00.000Z')
  assert.deepEqual(r.logs.map((l) => l.event), ['alert', 'reset_acknowledged', 'alert'])
})

test('log entries are bucketed by the message date, not the processing date', () => {
  const r = reduceSite({ alert: false }, [msg(ALERT, '2026-09-23T08:17:05Z')], OPTS)
  assert.equal(r.logs[0].date, '2026-09-23')
})

test('re-processing an already-applied onset keeps it labelled as the onset', () => {
  const onset = msg(ALERT, '2026-09-28T10:20:00Z')
  const r = reduceSite({ alert: true, lastAlert: onset.receivedAt }, [onset], OPTS)
  assert.deepEqual(r.logs.map((l) => l.event), ['alert'])
  assert.equal(r.patch.last_alert, undefined)
})

test('gpsStatus boundary', () => {
  assert.equal(gpsStatus(NOW - 60 * MIN, NOW, 60 * MIN), 'live')
  assert.equal(gpsStatus(NOW - 60 * MIN - 1, NOW, 60 * MIN), 'fallback')
})

// ── Remote reset (current.resetAtMs) ─────────────────────────────────
const RESET_AT = Date.parse('2026-09-28T10:20:00Z')

test('remote reset: a late alert at/before the reset time is a repeat, no onset', () => {
  const late = msg(ALERT, '2026-09-28T10:15:00Z')
  const atReset = msg(ALERT, '2026-09-28T10:20:00Z')
  const r = reduceSite({ alert: false, resetAtMs: RESET_AT }, [late, atReset], OPTS)
  assert.equal(r.alert, false)
  assert.equal(r.patch.alert, undefined)
  assert.equal(r.patch.last_alert, undefined)
  assert.deepEqual(r.logs.map((l) => l.event), ['alert_repeat', 'alert_repeat'])
  assert.equal(r.history.length, 2, 'still recorded in history')
  assert.equal(r.patch.gps.updated, atReset.receivedAt, 'position still updates')
})

test('remote reset: a newer alarm after the reset raises a real onset', () => {
  const r = reduceSite({ alert: false, resetAtMs: RESET_AT }, [msg(ALERT, '2026-09-28T10:25:00Z')], OPTS)
  assert.equal(r.alert, true)
  assert.equal(r.patch.alert, 'true')
  assert.equal(r.patch.last_alert, '2026-09-28T10:25:00.000Z')
  assert.deepEqual(r.logs.map((l) => l.event), ['alert'])
})

test('without resetAtMs an alert while clear is still an onset', () => {
  const r = reduceSite({ alert: false }, [msg(ALERT, '2026-09-28T10:15:00Z')], OPTS)
  assert.equal(r.patch.alert, 'true')
  assert.deepEqual(r.logs.map((l) => l.event), ['alert'])
})

test('terminal acknowledgement after a remote reset just logs', () => {
  const r = reduceSite({ alert: false, resetAtMs: RESET_AT }, [msg(RESET, '2026-09-28T10:22:00Z')], OPTS)
  assert.equal(r.alert, false)
  assert.equal(r.patch.alert, undefined)
  assert.deepEqual(r.logs.map((l) => l.event), ['reset_acknowledged'])
})
