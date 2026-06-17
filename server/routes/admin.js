const express  = require('express')
const bcrypt   = require('bcryptjs')
const pool     = require('../db')
const { requireAuth, requireRole } = require('../middleware/auth')
const { syncRoutingToFirebase }    = require('../services/routingSync')

const router = express.Router()

// All admin routes require authentication
router.use(requireAuth)

const adminOrSupervisor = requireRole('admin', 'supervisor')
const adminOnly         = requireRole('admin')

// ── GET /api/admin/data — full config snapshot ────────────────────
router.get('/data', adminOrSupervisor, async (_req, res) => {
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
router.put('/routes/:siteId/:receiverId', adminOrSupervisor, async (req, res) => {
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
router.delete('/routes/:siteId/:receiverId', adminOrSupervisor, async (req, res) => {
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
router.post('/sites', adminOnly, async (req, res) => {
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
router.delete('/sites/:id', adminOnly, async (req, res) => {
  try {
    await pool.query('DELETE FROM sites WHERE id = $1', [req.params.id])
    await syncRoutingToFirebase()
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/admin/receivers — add a receiver ───────────────────
router.post('/receivers', adminOnly, async (req, res) => {
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
router.delete('/receivers/:id', adminOnly, async (req, res) => {
  try {
    await pool.query('DELETE FROM hq_receivers WHERE id = $1', [req.params.id])
    await syncRoutingToFirebase()
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/admin/users — list all users ────────────────────────
router.get('/users', adminOnly, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, email, full_name, role, created_at FROM users ORDER BY created_at ASC'
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/admin/users — create a user ────────────────────────
router.post('/users', adminOnly, async (req, res) => {
  const { email, full_name, password, role } = req.body
  if (!email || !password || !full_name) {
    return res.status(400).json({ error: 'email, full_name, and password are required' })
  }
  if (!['admin', 'supervisor', 'operator'].includes(role)) {
    return res.status(400).json({ error: 'role must be admin, supervisor, or operator' })
  }
  try {
    const password_hash = await bcrypt.hash(password, 10)
    const { rows } = await pool.query(
      'INSERT INTO users (email, full_name, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, email, full_name, role, created_at',
      [email.toLowerCase().trim(), full_name.trim(), password_hash, role]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already in use' })
    res.status(500).json({ error: err.message })
  }
})

// ── PATCH /api/admin/users/:id/password — reset a user's password ─
router.patch('/users/:id/password', adminOnly, async (req, res) => {
  const { newPassword } = req.body
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' })
  }
  try {
    const hash = await bcrypt.hash(newPassword, 10)
    const { rowCount } = await pool.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [hash, req.params.id]
    )
    if (rowCount === 0) return res.status(404).json({ error: 'User not found' })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── PATCH /api/admin/users/:id/role — change a user's role ───────
router.patch('/users/:id/role', adminOnly, async (req, res) => {
  const { role } = req.body
  if (!['admin', 'supervisor', 'operator'].includes(role)) {
    return res.status(400).json({ error: 'role must be admin, supervisor, or operator' })
  }
  if (Number(req.params.id) === req.user.id) {
    return res.status(400).json({ error: 'You cannot change your own role' })
  }
  try {
    const { rows } = await pool.query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, email, full_name, role',
      [role, req.params.id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'User not found' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── DELETE /api/admin/users/:id — remove a user ──────────────────
router.delete('/users/:id', adminOnly, async (req, res) => {
  if (Number(req.params.id) === req.user.id) {
    return res.status(400).json({ error: 'You cannot delete your own account' })
  }
  try {
    const { rowCount } = await pool.query('DELETE FROM users WHERE id = $1', [req.params.id])
    if (rowCount === 0) return res.status(404).json({ error: 'User not found' })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
