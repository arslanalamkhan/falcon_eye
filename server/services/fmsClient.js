// Thin client for the Falcon Mega Track (FMS) satellite tracking API.
//
// GET {base}/{apiKey}/{nextReferenceId}
//   -> { ErrorCode, Description, AssetPosition: [...], NextReferenceID }
//
// The API is cursor-based, not a snapshot: each call returns messages
// received since the last NextReferenceID (start at 0), plus the cursor
// to use for the next call. Callers must persist NextReferenceID.
const BASE_URL = process.env.FMS_API_BASE_URL
  || 'https://falconmegatrack.com/api/v1/json/AccessData/GetTrackingDataByReferenceID'

async function fetchTrackingData(nextReferenceId) {
  const apiKey = process.env.FMS_API_KEY
  if (!apiKey) throw new Error('FMS_API_KEY not set')

  const url = `${BASE_URL}/${apiKey}/${nextReferenceId}`
  const res = await fetch(url)

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`FMS API HTTP ${res.status}: ${body || res.statusText}`)
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
