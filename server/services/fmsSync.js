// Polls the Falcon Mega Track (FMS) satellite API and mirrors asset GPS +
// SOS state into Firebase sites/ — the same node ESP32 panic buttons write
// to — so alertRouter, LiveMap, and Dashboard pick these assets up with no
// changes on their end. This service is the "virtual device" for
// satellite-tracked ground assets: nothing else seeds their sites/{id}
// node in Firebase. FMS's API/field names are maritime (IMO, MMSI,
// Ship_Security_Alert) because their platform is built for vessels, but
// the terminals themselves are being deployed on ground assets here.
//
// Each tick:
//   1. adopt parked reports from terminals that have since been registered
//   2. fetch new messages from the cursor; skip any already processed
//   3. per site, run the pure state machine (fmsState.js) — onset vs
//      repeat, reset, fresh-alarm deferral, GPS freshness
//   4. write Firebase first, then history + cursor (the state machine
//      recognises a re-processed onset, so a DB failure after the Firebase
//      write is safe to retry)
//   5. mark sites whose last report is stale as last-known position
//   6. prune rows older than the 15-day retention window
// Ticks never overlap: the next one is scheduled only after this one ends.
const pool = require('../db')
const { getFirebaseDb } = require('./firebase')
const { fetchTrackingData } = require('./fmsClient')
const { reduceSite } = require('./fmsState')
const { reconcileAlertHistory } = require('./fmsReconcile')

const KNOTS_TO_KMH = 1.852
const MIN = 60_000
// FMS allows 10 requests / 5 min per key, shared with operator commands
// (fmsClient's fmsBudget) — one poll per 30s is the ceiling. The 60s default
// uses half, leaving headroom for restarts and remote commands.
const MIN_INTERVAL_MS = 30_000

function loadConfig() {
  const requested = Number(process.env.FMS_POLL_INTERVAL_MS) || MIN
  const intervalMs = Math.max(requested, MIN_INTERVAL_MS)
  if (requested < MIN_INTERVAL_MS) {
    console.warn(`[FMS] FMS_POLL_INTERVAL_MS=${requested} is below the API rate limit — using ${MIN_INTERVAL_MS}ms`)
  }
  return {
    intervalMs,
    staleMs: (Number(process.env.FMS_STALE_AFTER_MIN) || 60) * MIN,
    // An alarm raised and reset within one batch is held open for a tick
    // only if it's this fresh; older pairs are catch-up history.
    recentMs: Math.max(10 * MIN, 3 * intervalMs),
  }
}

// FMS's docs promise "Undefined" for absent IMO/MMSI, but real ground
// terminals send junk placeholders instead — IMO comes back as "0"
// (never a valid IMO number) and MMSI as lowercase "undefined" — so this
// treats any of those forms, case-insensitively, as not-present.
function cleanId(raw, { zeroIsEmpty = false } = {}) {
  if (raw === undefined || raw === null) return null
  const s = String(raw).trim()
  if (!s.length) return null
  if (s.toLowerCase() === 'undefined') return null
  if (zeroIsEmpty && s === '0') return null
  return s
}

function normalize(pos) {
  const receivedMs = Number(pos.ReceivedOn_UnixUTC) * 1000
  const speed = typeof pos.Speed === 'number'
    ? (pos.SpeedUnit === 'knots' ? pos.Speed * KNOTS_TO_KMH : pos.Speed)
    : 0
  return {
    referenceId: Number(pos.ReferenceID),
    type:        pos.PositionReportType,
    lat:         pos.Latitude,
    lng:         pos.Longitude,
    speedKmh:    speed.toFixed(1),
    receivedAt:  new Date(receivedMs).toISOString(),
    receivedMs,
    mobileId:    cleanId(pos.MobileID),
    imo:         cleanId(pos.IMO, { zeroIsEmpty: true }),
    mmsi:        cleanId(pos.MMSI),
    assetName:   pos.AssetName || '',
  }
}

// ── Persistence helpers ───────────────────────────────────────────────
async function getCursor() {
  const { rows } = await pool.query('SELECT next_reference_id FROM fms_sync_cursor WHERE id = 1')
  return rows[0] ? Number(rows[0].next_reference_id) : 0
}

async function saveCursor(client, cursor) {
  await client.query(
    'UPDATE fms_sync_cursor SET next_reference_id = $1, updated_at = NOW() WHERE id = 1',
    [cursor]
  )
}

async function insertHistory(client, siteId, row) {
  await client.query(
    `INSERT INTO fms_position_history (site_id, reference_id, lat, lng, speed_kmh, report_type, received_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (reference_id) DO NOTHING`,
    [siteId, row.referenceId, row.lat, row.lng, row.speedKmh, row.reportType, row.receivedAt]
  )
}

// ReferenceIDs already applied (history) or parked (unmatched) — re-fetched
// after a deferral or a rewound cursor, and must not be processed twice.
async function alreadySeen(referenceIds) {
  if (referenceIds.length === 0) return new Set()
  const { rows } = await pool.query(
    `SELECT reference_id FROM fms_position_history  WHERE reference_id = ANY($1::bigint[])
     UNION
     SELECT reference_id FROM fms_unmatched_messages WHERE reference_id = ANY($1::bigint[])`,
    [referenceIds]
  )
  return new Set(rows.map((r) => Number(r.reference_id)))
}

// site_id/label come from Postgres (source of truth for config). Matched
// primarily by MobileID (the terminal's own hardware serial — confirmed
// present on every real message, though undocumented). IMO/MMSI are kept
// as a fallback only; on these ground terminals FMS sends placeholder
// junk for them, not real values, so they rarely resolve anything.
async function loadAssetMap() {
  const { rows } = await pool.query(`
    SELECT fa.site_id, fa.mobile_id, fa.imo, fa.mmsi, s.label
      FROM fms_assets fa JOIN sites s ON s.id = fa.site_id
  `)
  const byMobileId = new Map()
  const byImo = new Map()
  const byMmsi = new Map()
  for (const row of rows) {
    if (row.mobile_id) byMobileId.set(row.mobile_id, row)
    if (row.imo)       byImo.set(row.imo, row)
    if (row.mmsi)      byMmsi.set(row.mmsi, row)
  }
  return (m) => (m.mobileId && byMobileId.get(m.mobileId)) || (m.imo && byImo.get(m.imo)) || (m.mmsi && byMmsi.get(m.mmsi)) || null
}

// ── Step 1: adopt parked reports from newly registered terminals ─────
// History + latest position only. An actively alarming SSAS terminal
// re-sends every ~15 min, so its alarm is raised by the next live repeat —
// adoption never replays old alarms at headquarters.
async function adoptParked(rtdb, cfg) {
  const { rows } = await pool.query(`
    SELECT m.*, fa.site_id, s.label
      FROM fms_unmatched_messages m
      JOIN fms_assets fa ON fa.mobile_id = m.mobile_id
      JOIN sites s ON s.id = fa.site_id
     ORDER BY m.reference_id
  `)
  if (rows.length === 0) return

  const bySite = new Map()
  for (const r of rows) {
    if (!bySite.has(r.site_id)) bySite.set(r.site_id, { label: r.label, rows: [] })
    bySite.get(r.site_id).rows.push(r)
  }

  const updates = {}
  for (const [siteId, { label, rows: siteRows }] of bySite) {
    // Newest by timestamp (ReferenceIDs rise with time in practice, but the
    // shown position must match "last seen" regardless)
    const latest = siteRows.reduce((a, b) => (new Date(b.received_at) > new Date(a.received_at) ? b : a))
    const latestIso = new Date(latest.received_at).toISOString()
    const gps = (await rtdb.ref(`sites/${siteId}/gps`).get()).val()
    if (!gps?.updated || Date.parse(gps.updated) < Date.parse(latestIso)) {
      updates[`sites/${siteId}/label`] = label
      updates[`sites/${siteId}/gps`] = {
        lat: String(latest.lat),
        lng: String(latest.lng),
        speed_kmh: String(latest.speed_kmh),
        updated: latestIso,
        status: Date.now() - Date.parse(latestIso) > cfg.staleMs ? 'fallback' : 'live',
      }
    }
    console.log(`[FMS] Adopted ${siteRows.length} earlier report(s) for ${siteId} (MobileID ${latest.mobile_id})`)
  }
  if (Object.keys(updates).length > 0) await rtdb.ref().update(updates)

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (const r of rows) {
      await insertHistory(client, r.site_id, {
        referenceId: r.reference_id, lat: r.lat, lng: r.lng, speedKmh: r.speed_kmh,
        reportType: r.report_type, receivedAt: r.received_at,
      })
    }
    await client.query('DELETE FROM fms_unmatched_messages WHERE reference_id = ANY($1::bigint[])', [rows.map((r) => r.reference_id)])
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// ── Steps 2–4: fetch, reduce, write ──────────────────────────────────
async function processNewMessages(rtdb, cfg) {
  const cursor = await getCursor()
  const { assetPositions, nextReferenceId } = await fetchTrackingData(cursor)

  const all = assetPositions.map(normalize).sort((a, b) => a.referenceId - b.referenceId)
  const seen = await alreadySeen(all.map((m) => m.referenceId))
  const fresh = all.filter((m) => !seen.has(m.referenceId))

  const match = await loadAssetMap()
  const bySite = new Map()
  const unmatched = []
  for (const m of fresh) {
    const asset = match(m)
    if (!asset) { unmatched.push(m); continue }
    if (!bySite.has(asset.site_id)) bySite.set(asset.site_id, { asset, messages: [] })
    bySite.get(asset.site_id).messages.push(m)
  }

  const updates = {}
  const historyBySite = []
  const deferred = []
  const nowMs = Date.now()

  for (const [siteId, { asset, messages }] of bySite) {
    const site = (await rtdb.ref(`sites/${siteId}`).get()).val() || {}
    const r = reduceSite(
      { alert: site.alert === 'true', lastAlert: site.last_alert, resetAtMs: Date.parse(site.fms_reset_at) || undefined },
      messages,
      { nowMs, recentMs: cfg.recentMs, staleMs: cfg.staleMs }
    )

    if (r.consumed.length > 0) updates[`sites/${siteId}/label`] = asset.label
    for (const [key, value] of Object.entries(r.patch)) {
      if (key === 'gps') {
        for (const [gk, gv] of Object.entries(value)) updates[`sites/${siteId}/gps/${gk}`] = gv
      } else {
        updates[`sites/${siteId}/${key}`] = value
      }
    }
    for (const l of r.logs) {
      updates[`logs/${l.date}/${l.referenceId}`] = {
        site_id:    siteId,
        site_label: asset.label,
        event:      l.event,
        timestamp:  l.receivedAt,
        lat:        String(l.lat),
        lng:        String(l.lng),
        gps_status: l.gpsStatus,
      }
    }
    historyBySite.push([siteId, r.history])
    deferred.push(...r.deferred)

    if (r.patch.alert === 'true') {
      console.log(`[FMS] ALERT onset — ${asset.label} (${siteId}) at ${r.patch.last_alert}`)
    }
    if (r.patch.alert === 'false') {
      console.log(`[FMS] Alarm reset by terminal — ${asset.label} (${siteId})`)
    }
    if (r.deferred.length > 0) {
      console.log(`[FMS] ${siteId}: alarm raised and reset within one poll — holding the reset until next tick so receivers are notified`)
    }
  }

  if (Object.keys(updates).length > 0) await rtdb.ref().update(updates)

  // Deferred messages must be re-fetched: the cursor is inclusive, so
  // restart from the earliest one (everything else is skipped as seen).
  const nextCursor = deferred.length > 0 ? Math.min(...deferred) : nextReferenceId

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (const [siteId, rows] of historyBySite) {
      for (const row of rows) await insertHistory(client, siteId, row)
    }
    for (const m of unmatched) {
      await client.query(
        `INSERT INTO fms_unmatched_messages (reference_id, mobile_id, asset_name, report_type, lat, lng, speed_kmh, received_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (reference_id) DO NOTHING`,
        [m.referenceId, m.mobileId ?? m.imo ?? m.mmsi ?? 'unknown', m.assetName, m.type, m.lat, m.lng, m.speedKmh, m.receivedAt]
      )
    }
    await saveCursor(client, nextCursor)
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }

  if (unmatched.length > 0) {
    const terminals = [...new Set(unmatched.map((m) => `${m.assetName || '?'} [${m.mobileId}]`))]
    console.warn(`[FMS] ${unmatched.length} report(s) from unregistered terminal(s): ${terminals.join(', ')} — kept for 15 days; register them in Admin → Sites`)
  }
}

// ── Step 5: stale positions become "last known" ──────────────────────
async function markStaleSites(rtdb, cfg) {
  const { rows } = await pool.query('SELECT site_id FROM fms_assets')
  const updates = {}
  await Promise.all(rows.map(async ({ site_id: siteId }) => {
    const gps = (await rtdb.ref(`sites/${siteId}/gps`).get()).val()
    if (gps?.status === 'live' && gps.updated && Date.now() - Date.parse(gps.updated) > cfg.staleMs) {
      updates[`sites/${siteId}/gps/status`] = 'fallback'
    }
  }))
  if (Object.keys(updates).length > 0) {
    await rtdb.ref().update(updates)
    console.log(`[FMS] No recent report — marked last-known position: ${Object.keys(updates).map((p) => p.split('/')[1]).join(', ')}`)
  }
}

// ── Step 6: rolling 15-day retention ─────────────────────────────────
async function prune() {
  await pool.query("DELETE FROM fms_position_history   WHERE received_at < NOW() - INTERVAL '15 days'")
  await pool.query("DELETE FROM fms_unmatched_messages WHERE received_at < NOW() - INTERVAL '15 days'")
}

async function processTick(rtdb, cfg) {
  await adoptParked(rtdb, cfg)
  await processNewMessages(rtdb, cfg)
  await markStaleSites(rtdb, cfg)
  await prune()
}

function startFmsSync() {
  if (!process.env.FMS_API_KEY) {
    console.log('[FMS] FMS_API_KEY not set — satellite sync disabled')
    return
  }

  let rtdb
  try {
    rtdb = getFirebaseDb()
  } catch (err) {
    console.error('[FMS] Firebase init failed:', err.message)
    return
  }

  const cfg = loadConfig()

  const loop = async () => {
    try {
      await processTick(rtdb, cfg)
    } catch (err) {
      if (err.kind === 'rate_limit' && err.fmsCode === 429) {
        // Our own shared budget (operator commands) refused the poll — not an FMS error
        console.log('[FMS] Poll skipped this tick — shared request budget is in use')
      } else {
        console.error('[FMS] Sync tick failed:', err.message)
      }
    }
    setTimeout(loop, cfg.intervalMs)
  }

  console.log(`[FMS] Satellite sync started — polling every ${cfg.intervalMs / 1000}s, positions go stale after ${cfg.staleMs / MIN} min`)

  // Repair alert data written by the pre-fix sync, then start polling
  reconcileAlertHistory(rtdb, { apply: true, staleMs: cfg.staleMs })
    .then((changes) => {
      if (changes.length > 0) console.log(`[FMS] Reconciled ${changes.length} alert record(s) from before the onset/repeat fix`)
    })
    .catch((err) => console.error('[FMS] Reconcile failed:', err.message))
    .finally(loop)
}

module.exports = { startFmsSync }
