const express = require('express')
const { requireAuth } = require('../middleware/auth')
const sm   = require('../services/streamManager')
const imou = require('../services/imouService')
const pool = require('../db')

const router = express.Router()
router.use(requireAuth)

async function fetchCameraType(cameraId) {
  const { rows } = await pool.query(
    'SELECT id, stream_type, imou_device_id, imou_channel_id FROM cameras WHERE id = $1 AND active = true',
    [cameraId]
  )
  return rows[0] || null
}

// ── POST /api/streams/:cameraId/start ───────────────────────────────
router.post('/:cameraId/start', async (req, res) => {
  const cameraId = parseInt(req.params.cameraId, 10)
  if (isNaN(cameraId)) return res.status(400).json({ error: 'Invalid camera ID' })
  try {
    const cam = await fetchCameraType(cameraId)
    if (!cam) return res.status(404).json({ error: 'Camera not found' })

    if (cam.stream_type === 'imou') {
      const url = await imou.getStreamUrl(cameraId, cam.imou_device_id, cam.imou_channel_id)
      return res.json({ url, status: imou.isActive(cameraId) ? 'already_running' : 'started', source: 'imou' })
    }

    const result = await sm.startStream(cameraId)
    res.json({ ...result, source: 'rtsp' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/streams/:cameraId/status — heartbeat + status check ────
router.get('/:cameraId/status', async (req, res) => {
  const cameraId = parseInt(req.params.cameraId, 10)
  if (isNaN(cameraId)) return res.status(400).json({ error: 'Invalid camera ID' })
  try {
    const cam = await fetchCameraType(cameraId)
    if (!cam) return res.status(404).json({ error: 'Camera not found' })

    if (cam.stream_type === 'imou') {
      const running = imou.isActive(cameraId)
      if (!running) return res.json({ running: false, url: null })
      // Refresh HLS URL on heartbeat (token in URL may expire after ~24h)
      const url = await imou.getStreamUrl(cameraId, cam.imou_device_id, cam.imou_channel_id)
      return res.json({ running: true, url })
    }

    const running = sm.isRunning(cameraId)
    if (running) sm.heartbeat(cameraId)
    res.json({ running, url: running ? sm.hlsUrl(cameraId) : null })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── DELETE /api/streams/:cameraId — stop stream ─────────────────────
router.delete('/:cameraId', async (req, res) => {
  const cameraId = parseInt(req.params.cameraId, 10)
  if (isNaN(cameraId)) return res.status(400).json({ error: 'Invalid camera ID' })
  try {
    const cam = await fetchCameraType(cameraId)
    if (cam?.stream_type === 'imou') {
      await imou.releaseStream(cameraId, cam.imou_device_id)
    } else {
      sm.stopStream(cameraId)
    }
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
