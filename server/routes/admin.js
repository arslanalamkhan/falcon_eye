const express = require('express')
const pool    = require('../db')
const { requireAuth }         = require('../middleware/auth')
const { syncRoutingToFirebase } = require('../services/routingSync')

const router = express.Router()

// All admin routes require authentication
router.use(requireAuth)

// ── GET /api/admin/data — full config snapshot ────────────────────
router.get('/data', async (_req, res) => {
  try {
    const [sitesRes, receiversRes, routesRes] = await Promise.all([
      pool.query('SELECT * FROM sites       ORDER BY type, label'),
      pool.query('SELECT * FROM hq_receivers ORDER BY lea, label'),
      pool.query('SELECT site_id, receiver_id FROM site_receiver_routes'),
    ])
    res.json({
      sites:     sitesRes.rows,
      receivers: receiversRes.rows,
      routes:    routesRes.rows,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── PUT /api/admin/routes/:siteId/:receiverId — enable a route ────
router.put('/routes/:siteId/:receiverId', async (req, res) => {
  const { siteId, receiverId } = req.params
  try {
    await pool.query(
      'INSERT INTO site_receiver_routes (site_id, receiver_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [siteId, receiverId]
    )
    await syncRoutingToFirebase()
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── DELETE /api/admin/routes/:siteId/:receiverId — disable ───────
router.delete('/routes/:siteId/:receiverId', async (req, res) => {
  const { siteId, receiverId } = req.params
  try {
    await pool.query(
      'DELETE FROM site_receiver_routes WHERE site_id = $1 AND receiver_id = $2',
      [siteId, receiverId]
    )
    await syncRoutingToFirebase()
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/admin/sites — add a site ───────────────────────────
router.post('/sites', async (req, res) => {
  const { id, label, type, region } = req.body
  if (!id || !label) return res.status(400).json({ error: 'id and label are required' })
  if (!['train', 'mine', 'other'].includes(type)) return res.status(400).json({ error: 'type must be train, mine, or other' })
  try {
    const { rows } = await pool.query(
      'INSERT INTO sites (id, label, type, region) VALUES ($1, $2, $3, $4) RETURNING *',
      [id.trim(), label.trim(), type, (region || '').trim()]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Site ID already exists' })
    res.status(500).json({ error: err.message })
  }
})

// ── DELETE /api/admin/sites/:id — remove a site ─────────────────
router.delete('/sites/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM sites WHERE id = $1', [req.params.id])
    await syncRoutingToFirebase()
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/admin/receivers — add a receiver ───────────────────
router.post('/receivers', async (req, res) => {
  const { id, label, lea, city } = req.body
  if (!id || !label) return res.status(400).json({ error: 'id and label are required' })
  try {
    const { rows } = await pool.query(
      'INSERT INTO hq_receivers (id, label, lea, city) VALUES ($1, $2, $3, $4) RETURNING *',
      [id.trim(), label.trim(), (lea || '').trim(), (city || '').trim()]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Receiver ID already exists' })
    res.status(500).json({ error: err.message })
  }
})

// ── DELETE /api/admin/receivers/:id — remove a receiver ──────────
router.delete('/receivers/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM hq_receivers WHERE id = $1', [req.params.id])
    await syncRoutingToFirebase()
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
