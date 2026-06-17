const express = require('express')
const { requireAuth } = require('../middleware/auth')
const sm = require('../services/streamManager')

const router = express.Router()
router.use(requireAuth)

// ── POST /api/streams/:cameraId/start ───────────────────────────────
// Starts FFmpeg (or returns existing stream). Waits until m3u8 is ready.
router.post('/:cameraId/start', async (req, res) => {
  const cameraId = parseInt(req.params.cameraId, 10)
  if (isNaN(cameraId)) return res.status(400).json({ error: 'Invalid camera ID' })
  try {
    const result = await sm.startStream(cameraId)
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/streams/:cameraId/status — heartbeat + status check ────
router.get('/:cameraId/status', (req, res) => {
  const cameraId = parseInt(req.params.cameraId, 10)
  if (isNaN(cameraId)) return res.status(400).json({ error: 'Invalid camera ID' })
  const running = sm.isRunning(cameraId)
  if (running) sm.heartbeat(cameraId)
  res.json({
    running,
    url: running ? sm.hlsUrl(cameraId) : null,
  })
})

// ── DELETE /api/streams/:cameraId — stop stream ─────────────────────
router.delete('/:cameraId', (req, res) => {
  const cameraId = parseInt(req.params.cameraId, 10)
  if (isNaN(cameraId)) return res.status(400).json({ error: 'Invalid camera ID' })
  sm.stopStream(cameraId)
  res.json({ ok: true })
})

module.exports = router
