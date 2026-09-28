// Polls the Falcon Mega Track (FMS) satellite API and mirrors asset GPS +
// SOS state into Firebase sites/ — the same node ESP32 panic buttons write
// to — so alertRouter, LiveMap, and Dashboard pick these assets up with no
// changes on their end. This service is the "virtual device" for
// satellite-tracked ground assets: nothing else seeds their sites/{id}
// node in Firebase. FMS's API/field names are maritime (IMO, MMSI,
// Ship_Security_Alert) because their platform is built for vessels, but
// the terminals themselves are being deployed on ground assets here.
const pool = require('../db')
const { getFirebaseDb } = require('./firebase')
const { fetchTrackingData } = require('./fmsClient')

const KNOTS_TO_KMH = 1.852

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

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

async function getCursor() {
  const { rows } = await pool.query('SELECT next_reference_id FROM fms_sync_cursor WHERE id = 1')
  return rows[0] ? Number(rows[0].next_reference_id) : 0
}

async function saveCursor(nextReferenceId) {
  await pool.query(
    'UPDATE fms_sync_cursor SET next_reference_id = $1, updated_at = NOW() WHERE id = 1',
    [nextReferenceId]
  )
}

async function insertHistory(row) {
  await pool.query(
    `INSERT INTO fms_position_history (site_id, reference_id, lat, lng, speed_kmh, report_type, received_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (reference_id) DO NOTHING`,
    [row.siteId, row.referenceId, row.lat, row.lng, row.speedKmh, row.reportType, row.receivedAt]
  )
}

// Rolling 15-day retention — Postgres has no built-in TTL, so this prunes
// on every tick instead of needing a separate scheduled job.
async function pruneHistory() {
  await pool.query("DELETE FROM fms_position_history WHERE received_at < NOW() - INTERVAL '15 days'")
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
    if (row.imo)        byImo.set(row.imo, row)
    if (row.mmsi)        byMmsi.set(row.mmsi, row)
  }
  return { byMobileId, byImo, byMmsi }
}

// PositionReportType -> what to do with sites/{id}/alert + logs/
// Ship_Security_Alert is the maritime SSAS panic trigger (the vessel
// equivalent of the ESP32 panic button). SSAS_Reset_Acknowledgement is the
// vessel's own system clearing it. SSAS_Test must never dispatch QRF.
function resolveEvent(reportType) {
  if (reportType === 'Ship_Security_Alert')       return { alert: true,  log: 'alert' }
  if (reportType === 'SSAS_Reset_Acknowledgement') return { alert: false, log: 'reset_acknowledged' }
  if (reportType === 'SSAS_Test')                  return { alert: null,  log: 'test_alert' }
  return { alert: null, log: null } // Automatic_Position_Report / Position_Report_Distance — GPS only
}

async function processTick(rtdb) {
  const cursor = await getCursor()
  const { assetPositions, nextReferenceId } = await fetchTrackingData(cursor)

  if (assetPositions.length > 0) {
    const { byMobileId, byImo, byMmsi } = await loadAssetMap()
    const updates = {}
    const today = todayStr()

    for (const pos of assetPositions) {
      const mobileId = cleanId(pos.MobileID)
      const imo       = cleanId(pos.IMO, { zeroIsEmpty: true })
      const mmsi      = cleanId(pos.MMSI)
      const asset = (mobileId && byMobileId.get(mobileId)) || (imo && byImo.get(imo)) || (mmsi && byMmsi.get(mmsi))

      if (!asset) {
        console.warn(`[FMS] Unregistered asset — AssetName="${pos.AssetName}" MobileID=${mobileId} IMO=${imo} MMSI=${mmsi}. Register it in Admin -> Sites first.`)
        continue
      }

      const siteId = asset.site_id
      const updatedIso = new Date(pos.ReceivedOn_UnixUTC * 1000).toISOString()
      const speedKmh = typeof pos.Speed === 'number'
        ? ((pos.SpeedUnit === 'knots' ? pos.Speed * KNOTS_TO_KMH : pos.Speed).toFixed(1))
        : '0'

      updates[`sites/${siteId}/label`]        = asset.label
      updates[`sites/${siteId}/gps/lat`]       = String(pos.Latitude)
      updates[`sites/${siteId}/gps/lng`]       = String(pos.Longitude)
      updates[`sites/${siteId}/gps/status`]    = 'live'
      updates[`sites/${siteId}/gps/speed_kmh`] = speedKmh
      updates[`sites/${siteId}/gps/updated`]   = updatedIso

      const { alert, log } = resolveEvent(pos.PositionReportType)
      if (alert !== null) {
        updates[`sites/${siteId}/alert`]  = alert ? 'true' : 'false'
        updates[`sites/${siteId}/status`] = alert ? 'alert' : 'standby'
        if (alert) updates[`sites/${siteId}/last_alert`] = updatedIso
      }

      if (log) {
        updates[`logs/${today}/${pos.ReferenceID}`] = {
          site_id:    siteId,
          site_label: asset.label,
          event:      log,
          timestamp:  updatedIso,
          lat:        String(pos.Latitude),
          lng:        String(pos.Longitude),
          gps_status: 'live',
        }
      }

      await insertHistory({
        siteId,
        referenceId: pos.ReferenceID,
        lat:         pos.Latitude,
        lng:         pos.Longitude,
        speedKmh,
        reportType:  pos.PositionReportType,
        receivedAt:  updatedIso,
      })
    }

    if (Object.keys(updates).length > 0) {
      await rtdb.ref().update(updates)
    }
  }

  await saveCursor(nextReferenceId)
  await pruneHistory()
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

  const intervalMs = Number(process.env.FMS_POLL_INTERVAL_MS) || 300000

  const tick = () => {
    processTick(rtdb).catch(err => console.error('[FMS] Sync tick failed:', err.message))
  }

  console.log(`[FMS] Satellite sync started — polling every ${intervalMs / 1000}s`)
  tick()
  setInterval(tick, intervalMs)
}

module.exports = { startFmsSync }
