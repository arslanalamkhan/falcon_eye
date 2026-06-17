const { spawn }  = require('child_process')
const path       = require('path')
const fs         = require('fs')
const pool       = require('../db')


const STREAMS_DIR  = path.join(__dirname, '../streams')
const IDLE_MS      = 5 * 60 * 1000  // stop after 5 min with no heartbeat
const START_TIMEOUT_MS = 20 * 1000  // fail if FFmpeg doesn't produce output in 20s

// Map<cameraId, StreamEntry>
const active = new Map()

function ensureStreamsDir() {
  if (!fs.existsSync(STREAMS_DIR)) fs.mkdirSync(STREAMS_DIR, { recursive: true })
}

function streamDir(cameraId) {
  return path.join(STREAMS_DIR, String(cameraId))
}

function hlsUrl(cameraId) {
  return `/streams/${cameraId}/stream.m3u8`
}

function buildRtspUrl(cam) {
  return `rtsp://${cam.username}:${cam.password}@${cam.ip}:${cam.port}/cam/realmonitor?channel=${cam.channel}&subtype=${cam.subtype}`
}

function waitForFile(filePath, timeoutMs) {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const timer = setInterval(() => {
      if (fs.existsSync(filePath)) {
        clearInterval(timer)
        resolve()
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(timer)
        reject(new Error('Stream timed out — FFmpeg did not produce output. Check camera connectivity.'))
      }
    }, 400)
  })
}

function cleanup(cameraId) {
  const entry = active.get(cameraId)
  if (!entry) return
  clearInterval(entry.idleTimer)
  try { entry.process.kill('SIGTERM') } catch (_) {}
  active.delete(cameraId)
  const dir = streamDir(cameraId)
  try { fs.rmSync(dir, { recursive: true, force: true }) } catch (_) {}
}

async function fetchCamera(cameraId) {
  const { rows } = await pool.query(
    'SELECT id, site_id, ip, port, username, password, channel, subtype FROM cameras WHERE id = $1 AND active = true',
    [cameraId]
  )
  return rows[0] || null
}

async function startStream(cameraId) {
  // Return early if already running — just refresh idle timer
  if (active.has(cameraId)) {
    active.get(cameraId).lastAccess = Date.now()
    return { url: hlsUrl(cameraId), status: 'already_running' }
  }

  const cam = await fetchCamera(cameraId)
  if (!cam) throw new Error('Camera not found or inactive')

  ensureStreamsDir()
  const dir = streamDir(cameraId)
  fs.mkdirSync(dir, { recursive: true })

  const rtspUrl = buildRtspUrl(cam)
  const m3u8    = path.join(dir, 'stream.m3u8')
  const segPat  = path.join(dir, 'seg%03d.ts')

  const args = [
    '-loglevel', 'warning',
    '-rtsp_transport', 'tcp',
    '-i', rtspUrl,
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-tune', 'zerolatency',
    '-an',                            // drop audio — lower latency, smaller segments
    '-f', 'hls',
    '-hls_time', '2',
    '-hls_list_size', '3',
    '-hls_flags', 'delete_segments+omit_endlist',
    '-hls_segment_filename', segPat,
    m3u8,
  ]

  const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] })

  const entry = {
    process:    proc,
    lastAccess: Date.now(),
    idleTimer:  null,
  }
  active.set(cameraId, entry)

  // Catch spawn errors (e.g. ffmpeg not in PATH) so they don't crash the server
  proc.on('error', (err) => {
    clearInterval(entry.idleTimer)
    active.delete(cameraId)
    try { fs.rmSync(dir, { recursive: true, force: true }) } catch (_) {}
    if (err.code === 'ENOENT') {
      console.error('[stream] ffmpeg not found — install FFmpeg and ensure it is in PATH')
    } else {
      console.error(`[stream] Camera ${cameraId} spawn error:`, err.message)
    }
  })

  proc.on('exit', (code) => {
    clearInterval(entry.idleTimer)
    active.delete(cameraId)
    try { fs.rmSync(dir, { recursive: true, force: true }) } catch (_) {}
    if (code !== 0 && code !== null) {
      console.warn(`[stream] Camera ${cameraId} FFmpeg exited with code ${code}`)
    }
  })

  // Set up idle timeout ticker
  entry.idleTimer = setInterval(() => {
    if (Date.now() - entry.lastAccess > IDLE_MS) {
      console.log(`[stream] Camera ${cameraId} idle — stopping`)
      cleanup(cameraId)
    }
  }, 30_000)

  try {
    await waitForFile(m3u8, START_TIMEOUT_MS)
  } catch (err) {
    cleanup(cameraId)
    // Check if the process already exited due to missing ffmpeg
    if (!active.has(cameraId)) {
      throw new Error('FFmpeg not found on server — install FFmpeg and ensure it is in PATH')
    }
    throw err
  }

  return { url: hlsUrl(cameraId), status: 'started' }
}

function stopStream(cameraId) {
  cleanup(cameraId)
}

function heartbeat(cameraId) {
  const entry = active.get(cameraId)
  if (!entry) return false
  entry.lastAccess = Date.now()
  return true
}

function isRunning(cameraId) {
  return active.has(cameraId)
}

function activeCount() {
  return active.size
}

module.exports = { startStream, stopStream, heartbeat, isRunning, activeCount, hlsUrl }
