// One-pass repair of FMS alert data written before the onset/repeat fix.
//
// The old sync treated every 15-minute SSAS repeat as a brand-new alert:
// it overwrote sites/{id}/last_alert (so "triggered 5m ago" on a two-hour
// incident) and logged each repeat as event "alert" (inflating "Alerts
// today" and the recent-alert feed). This replays each site's stored
// history through the same state machine the live sync uses, then:
//   1. restores last_alert of an ongoing incident to its real onset
//   2. relabels logged repeats as "alert_repeat"
// Idempotent — safe to run on every server start (fmsSync does).
const pool = require('../db')
const { reduceSite } = require('./fmsState')

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/

async function reconcileAlertHistory(rtdb, { apply = false, staleMs = 60 * 60_000 } = {}) {
  const { rows: sites } = await pool.query(
    `SELECT fa.site_id, s.label FROM fms_assets fa JOIN sites s ON s.id = fa.site_id`
  )
  const changes = []

  for (const { site_id: siteId, label } of sites) {
    const { rows } = await pool.query(
      `SELECT reference_id, report_type, lat, lng, speed_kmh, received_at
         FROM fms_position_history WHERE site_id = $1 ORDER BY reference_id`,
      [siteId]
    )
    if (rows.length === 0) continue

    const messages = rows.map((r) => {
      const receivedAt = new Date(r.received_at).toISOString()
      return {
        referenceId: Number(r.reference_id),
        type: r.report_type,
        lat: r.lat,
        lng: r.lng,
        speedKmh: String(r.speed_kmh),
        receivedAt,
        receivedMs: Date.parse(receivedAt),
      }
    })

    // Replay from a clean slate. recentMs: 0 — never defer, this is history.
    const sim = reduceSite({ alert: false }, messages, { nowMs: Date.now(), recentMs: 0, staleMs })
    const site = (await rtdb.ref(`sites/${siteId}`).get()).val() || {}

    if (sim.alert && site.alert === 'true' && sim.patch.last_alert && site.last_alert !== sim.patch.last_alert) {
      changes.push({
        site: label,
        path: `sites/${siteId}/last_alert`,
        from: site.last_alert ?? null,
        to: sim.patch.last_alert,
        why: 'ongoing incident — trigger time restored to its onset',
      })
    }

    const repeatRefs = new Set(sim.logs.filter((l) => l.event === 'alert_repeat').map((l) => String(l.referenceId)))
    if (repeatRefs.size > 0) {
      const earliest = messages[0].receivedAt.slice(0, 10)
      const buckets = (await rtdb.ref('logs').orderByKey().startAt(earliest).get()).val() || {}
      for (const [date, entries] of Object.entries(buckets)) {
        if (!DATE_KEY.test(date) || !entries) continue
        for (const [key, entry] of Object.entries(entries)) {
          if (entry?.site_id === siteId && entry.event === 'alert' && repeatRefs.has(key)) {
            changes.push({ site: label, path: `logs/${date}/${key}/event`, from: 'alert', to: 'alert_repeat', why: 'SSAS repeat, not a new alert' })
          }
        }
      }
    }
  }

  if (apply && changes.length > 0) {
    await rtdb.ref().update(Object.fromEntries(changes.map((c) => [c.path, c.to])))
  }
  return changes
}

module.exports = { reconcileAlertHistory }
