// Thin client for the Falcon Mega Track (FMS) satellite tracking API.
//
// GET {base}/{apiKey}/{cursor}
//   -> { ErrorCode, Description, AssetPosition: [...], NextReferenceID }
//
// The API is cursor-based, not a snapshot: each call returns every message
// with ReferenceID >= cursor (inclusive — verified against the live API),
// plus NextReferenceID to use for the next call. Callers must persist the
// cursor. FMS retains history, so rewinding the cursor replays messages.
//
// Rate limit: 10 requests per 5 minutes per API key (HTTP 403, ErrorCode
// 403). Every process polling with the same key shares that budget — run
// exactly one server instance per key.
const BASE_URL = process.env.FMS_API_BASE_URL
  || 'https://falconmegatrack.com/api/v1/json/AccessData/GetTrackingDataByReferenceID'

// A hung request must not stall the sync loop forever
const TIMEOUT_MS = Number(process.env.FMS_REQUEST_TIMEOUT_MS) || 20_000

async function fetchTrackingData(cursor) {
  const apiKey = process.env.FMS_API_KEY
  if (!apiKey) throw new Error('FMS_API_KEY not set')

  let res
  try {
    res = await fetch(`${BASE_URL}/${apiKey}/${cursor}`, { signal: AbortSignal.timeout(TIMEOUT_MS) })
  } catch (err) {
    // Never echo the URL — it contains the API key
    if (err.name === 'TimeoutError') throw new Error(`FMS API timed out after ${TIMEOUT_MS / 1000}s`)
    throw new Error(`FMS API unreachable: ${err.cause?.code || err.message}`)
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    if (res.status === 403 && /limit exceeded/i.test(body)) {
      const err = new Error('FMS API rate limit hit (10 requests / 5 min per key). Is another server polling with the same FMS_API_KEY?')
      err.code = 'FMS_RATE_LIMIT'
      throw err
    }
    throw new Error(`FMS API HTTP ${res.status}: ${body.slice(0, 200) || res.statusText}`)
  }

  const data = await res.json()
  if (data.ErrorCode !== 0) {
    throw new Error(`FMS API error ${data.ErrorCode}: ${data.Description}`)
  }

  return {
    assetPositions:  data.AssetPosition || [],
    nextReferenceId: data.NextReferenceID,
  }
}

module.exports = { fetchTrackingData }
