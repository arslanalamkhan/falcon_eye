const https  = require('https')
const crypto = require('crypto')

const APP_ID     = () => process.env.IMOU_APP_ID
const APP_SECRET = () => process.env.IMOU_APP_SECRET
const BASE_URL   = () => process.env.IMOU_API_BASE_URL || 'https://openapi.easy4ip.com/openapi'

// ── Token cache ──────────────────────────────────────────────────────
let cachedToken    = null
let tokenExpiresAt = 0

// ── Stream binding cache: Map<cameraId, { streamId, hlsUrl }> ───────
const streamCache = new Map()

// ── Helpers ──────────────────────────────────────────────────────────
function randomNonce() {
  return crypto.randomBytes(8).toString('hex')
}

function buildSign(timestamp, nonce) {
  const raw = `time:${timestamp},nonce:${nonce},appSecret:${APP_SECRET()}`
  return crypto.createHash('md5').update(raw).digest('hex')
}

function buildSystem() {
  const time  = Math.floor(Date.now() / 1000)
  const nonce = randomNonce()
  return { ver: '1.0', sign: buildSign(time, nonce), appId: APP_ID(), time, nonce }
}

function imouPost(endpoint, params) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ system: buildSystem(), params })
    const base = BASE_URL()
    const url  = new URL(`${base}/${endpoint}`)

    const options = {
      hostname: url.hostname,
      path:     url.pathname,
      method:   'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }

    const req = https.request(options, res => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          const code = json.result?.code
          if (code !== '0' && code !== 0) {
            const err = new Error(`IMOU API [${endpoint}] error ${code}: ${json.result?.msg || 'Unknown error'}`)
            err.imouCode = code
            reject(err)
          } else {
            // IMOU wraps payload inside result.data (not top-level data)
            resolve(json.result?.data ?? json.data ?? {})
          }
        } catch (e) {
          reject(new Error(`IMOU response parse error: ${e.message}`))
        }
      })
    })

    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

// ── Public API ───────────────────────────────────────────────────────

async function getAccessToken() {
  const now = Date.now()
  if (cachedToken && now < tokenExpiresAt - 60_000) return cachedToken

  if (!APP_ID() || !APP_SECRET()) {
    throw new Error('IMOU_APP_ID and IMOU_APP_SECRET environment variables are not set')
  }

  const data = await imouPost('accessToken', { appSecret: APP_SECRET() })
  cachedToken    = data.accessToken
  tokenExpiresAt = now + (data.expireTime ?? 86400) * 1000
  console.log('[imou] Access token refreshed')
  return cachedToken
}

async function getStreamUrl(cameraId, deviceId, channelId = '0') {
  if (!deviceId) throw new Error('No IMOU device ID configured for this camera')

  const token  = await getAccessToken()
  const cached = streamCache.get(cameraId)

  if (!cached) {
    let streamId, hlsUrl

    try {
      // Normal path: bind and get stream info from the same response
      const bindData = await imouPost('bindDeviceLive', {
        deviceId, channelId, streamId: 0, token,
      })
      const stream = bindData.streams?.[0]
      if (stream) {
        streamId = stream.streamId
        hlsUrl   = stream.hls
      }
    } catch (err) {
      if (err.imouCode !== 'LV1001') throw err
      // LV1001: a binding already exists on IMOU's side (e.g. after server restart)
      // Fall through to getLiveStreamInfo by device ID below
      console.log(`[imou] Camera ${cameraId} already bound — fetching existing stream URL`)
    }

    // Fallback (LV1001 or bind gave no URL): fetch by device ID
    if (!hlsUrl) {
      const liveData = await imouPost('getLiveStreamInfo', { deviceId, channelId, token })
      const stream = liveData.streams?.[0]
      if (stream) {
        streamId = stream.streamId
        hlsUrl   = stream.hls
      }
    }

    if (!hlsUrl) throw new Error('Could not obtain IMOU stream URL — check device ID and IMOU account binding')

    streamCache.set(cameraId, { streamId, hlsUrl })
    console.log(`[imou] Camera ${cameraId} ready — streamId=${streamId}`)
    return hlsUrl
  }

  // Subsequent calls: refresh URL via getLiveStreamInfo
  try {
    const liveData = await imouPost('getLiveStreamInfo', { streamId: cached.streamId, token })
    const hlsUrl   = liveData.streams?.[0]?.hls
    if (hlsUrl) {
      cached.hlsUrl = hlsUrl
      return hlsUrl
    }
  } catch (err) {
    console.warn(`[imou] getLiveStreamInfo failed, using cached URL:`, err.message)
  }

  return cached.hlsUrl
}

async function releaseStream(cameraId, deviceId) {
  const cached = streamCache.get(cameraId)
  if (!cached) return
  streamCache.delete(cameraId)
  try {
    const token = await getAccessToken()
    await imouPost('deleteDeviceLive', { deviceId, streamId: cached.streamId, token })
    console.log(`[imou] Released stream ${cached.streamId} for camera ${cameraId}`)
  } catch (err) {
    console.warn(`[imou] Could not release stream:`, err.message)
  }
}

function isActive(cameraId) {
  return streamCache.has(cameraId)
}

module.exports = { getStreamUrl, releaseStream, isActive }
