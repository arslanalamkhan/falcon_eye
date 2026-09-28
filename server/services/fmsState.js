// Pure alert/position state machine for one FMS satellite site.
//
// No I/O — fmsSync.js feeds it a site's current state plus that site's new
// messages (ascending ReferenceID) and writes the result to Postgres and
// Firebase. Kept pure so every rule below is covered by fmsState.test.js.
//
// Rules:
// - An SSAS terminal re-sends Ship_Security_Alert every ~15 min until it is
//   reset. Only the FIRST alert of an incident is the onset: it raises the
//   alarm and sets last_alert. Later ones are repeats — position update +
//   an 'alert_repeat' log entry, never a new trigger time or a new "alert".
// - SSAS_Reset_Acknowledgement clears the alarm.
// - If an onset and its reset arrive in the same poll batch, writing only
//   the final state would mean Firebase never shows alert=true, so
//   alertRouter never buzzes a receiver. When the onset is fresh we stop at
//   the reset and hand it (and anything after it) back as `deferred`, so it
//   is applied on the next tick — receivers ring for at least one interval.
//   Stale onsets (catch-up after downtime) are applied in full: we don't
//   buzz headquarters for an incident that already ended long ago.
// - GPS status is 'live' only if the newest report is fresher than staleMs,
//   otherwise 'fallback' (shown as "last known position").

const REPORT = {
  ALERT: 'Ship_Security_Alert',
  RESET: 'SSAS_Reset_Acknowledgement',
  TEST:  'SSAS_Test',
}

function gpsStatus(receivedMs, nowMs, staleMs) {
  return nowMs - receivedMs > staleMs ? 'fallback' : 'live'
}

/**
 * @param {{ alert: boolean, lastAlert?: string }} current   the site's state before this batch
 *        (from Firebase). lastAlert lets a re-processed onset be recognised as itself.
 * @param {Array<{ referenceId: number, type: string, lat: number, lng: number,
 *                 speedKmh: string, receivedAt: string, receivedMs: number }>} messages
 *        this site's messages, ascending referenceId
 * @param {{ nowMs: number, recentMs: number, staleMs: number }} opts
 * @returns {{
 *   consumed: number[],   // referenceIds fully applied this tick
 *   deferred: number[],   // referenceIds to re-process next tick
 *   history:  object[],   // rows for fms_position_history
 *   logs:     Array<{ referenceId: number, date: string, event: string, receivedAt: string, lat: number, lng: number, gpsStatus: string }>,
 *   patch:    object,     // Firebase fields for sites/{id} ('gps' is a nested object)
 *   alert:    boolean,    // alert state after this batch
 * }}
 */
function reduceSite(current, messages, { nowMs, recentMs, staleMs }) {
  const out = { consumed: [], deferred: [], history: [], logs: [], patch: {}, alert: current.alert }
  let alert = current.alert
  let freshOnsetInBatch = false
  let latest = null

  for (let i = 0; i < messages.length; i++) {
    const m = messages[i]

    if (m.type === REPORT.RESET && alert && freshOnsetInBatch) {
      out.deferred = messages.slice(i).map((x) => x.referenceId)
      break
    }

    out.consumed.push(m.referenceId)
    out.history.push({
      referenceId: m.referenceId,
      lat: m.lat,
      lng: m.lng,
      speedKmh: m.speedKmh,
      reportType: m.type,
      receivedAt: m.receivedAt,
    })
    latest = m

    let event = null
    if (m.type === REPORT.ALERT) {
      if (!alert) {
        alert = true
        freshOnsetInBatch = nowMs - m.receivedMs <= recentMs
        out.patch.alert = 'true'
        out.patch.status = 'alert'
        out.patch.last_alert = m.receivedAt
        event = 'alert'
      } else {
        // Re-processing the onset we already applied (e.g. a DB write failed
        // after Firebase succeeded) must not relabel it as a repeat
        event = m.receivedAt === current.lastAlert ? 'alert' : 'alert_repeat'
      }
    } else if (m.type === REPORT.RESET) {
      if (alert) {
        alert = false
        freshOnsetInBatch = false
        out.patch.alert = 'false'
        out.patch.status = 'standby'
      }
      event = 'reset_acknowledged'
    } else if (m.type === REPORT.TEST) {
      event = 'test_alert'
    }

    if (event) {
      out.logs.push({
        referenceId: m.referenceId,
        date: m.receivedAt.slice(0, 10),
        event,
        receivedAt: m.receivedAt,
        lat: m.lat,
        lng: m.lng,
        gpsStatus: gpsStatus(m.receivedMs, nowMs, staleMs),
      })
    }
  }

  if (latest) {
    out.patch.gps = {
      lat: String(latest.lat),
      lng: String(latest.lng),
      speed_kmh: latest.speedKmh,
      updated: latest.receivedAt,
      status: gpsStatus(latest.receivedMs, nowMs, staleMs),
    }
  }

  out.alert = alert
  return out
}

module.exports = { reduceSite, gpsStatus, REPORT }
