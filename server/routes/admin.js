const express  = require('express')
const bcrypt   = require('bcryptjs')
const pool     = require('../db')
const { requireAuth, requireRole } = require('../middleware/auth')
const { syncRoutingToFirebase }    = require('../services/routingSync')
const {
  getVisibleSiteIds, getVisibleReceiverIds,
  canManageSite, canManageReceiver,
} = require('../services/visibility')

const router = express.Router()

// All admin routes require authentication
router.use(requireAuth)

const adminOnly = requireRole('admin')

// ── GET /api/admin/data — config snapshot scoped to what the user can see ─
router.get('/data', async (req, res) => {
  try {
    const [visibleSiteIds, visibleReceiverIds] = await Promise.all([
      getVisibleSiteIds(req.user),
      getVisibleReceiverIds(req.user),
    ])

    const sitesQuery = visibleSiteIds === null
      ? pool.query(
          `SELECT s.*, u.full_name AS owner_name
             FROM sites s LEFT JOIN users u ON u.id = s.owner_id
            ORDER BY s.type, s.label`
        )
      : pool.query(
          `SELECT s.*, u.full_name AS owner_name
             FROM sites s LEFT JOIN users u ON u.id = s.owner_id
            WHERE s.id = ANY($1)
            ORDER BY s.type, s.label`,
          [visibleSiteIds]
        )

    const receiversQuery = visibleReceiverIds === null
      ? pool.query(
          `SELECT r.*, u.full_name AS owner_name
             FROM hq_receivers r LEFT JOIN users u ON u.id = r.owner_id
            ORDER BY r.lea, r.label`
        )
      : pool.query(
          `SELECT r.*, u.full_name AS owner_name
             FROM hq_receivers r LEFT JOIN users u ON u.id = r.owner_id
            WHERE r.id = ANY($1)
            ORDER BY r.lea, r.label`,
          [visibleReceiverIds]
        )

    const routesQuery = (visibleSiteIds === null && visibleReceiverIds === null)
      ? pool.query('SELECT site_id, receiver_id FROM site_receiver_routes')
      : pool.query(
          `SELECT site_id, receiver_id FROM site_receiver_routes
            WHERE site_id = ANY($1) AND receiver_id = ANY($2)`,
          [visibleSiteIds ?? [], visibleReceiverIds ?? []]
        )

    const [sitesRes, receiversRes, routesRes] = await Promise.all([sitesQuery, receiversQuery, routesQuery])
    res.json({
      sites:     sitesRes.rows,
      receivers: receiversRes.rows,
      routes:    routesRes.rows,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/admin/my-visibility — visible site/receiver ID sets ─────────
router.get('/my-visibility', async (req, res) => {
  try {
    const [siteIds, receiverIds] = await Promise.all([
      getVisibleSiteIds(req.user),
      getVisibleReceiverIds(req.user),
    ])
    res.json({ siteIds, receiverIds })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── PUT /api/admin/routes/:siteId/:receiverId — enable a route ────
router.put('/routes/:siteId/:receiverId', async (req, res) => {
  const { siteId, receiverId } = req.params
  try {
    const [ownsSite, visibleReceiverIds] = await Promise.all([
      canManageSite(req.user, siteId),
      getVisibleReceiverIds(req.user),
    ])
    if (!ownsSite) return res.status(403).json({ error: 'Forbidden' })
    if (visibleReceiverIds !== null && !visibleReceiverIds.includes(receiverId)) {
      return res.status(403).json({ error: 'Forbidden' })
    }
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
    if (!(await canManageSite(req.user, siteId))) {
      return res.status(403).json({ error: 'Forbidden' })
    }
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

// ── POST /api/admin/sites — add a site (owned by the creator) ────
// source 'satellite_fms' registers a site tracked via a Falcon Mega Track
// terminal instead of an ESP32 panic button — requires the terminal's
// mobile_id (hardware serial) so fmsSync can match incoming position
// reports to it, independent of the site's physical `type`. IMO/MMSI are
// optional — FMS returns placeholder junk for them on non-vessel terminals.
router.post('/sites', async (req, res) => {
  const { id, label, type, region, source, mobile_id, imo, mmsi } = req.body
  if (!id || !label) return res.status(400).json({ error: 'id and label are required' })
  if (!['train', 'mine', 'other'].includes(type)) {
    return res.status(400).json({ error: 'type must be train, mine, or other' })
  }
  const siteSource = source === 'satellite_fms' ? 'satellite_fms' : 'cellular'
  if (siteSource === 'satellite_fms' && !mobile_id) {
    return res.status(400).json({ error: 'mobile_id (terminal serial) is required for satellite (FMS) sites' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query(
      'INSERT INTO sites (id, label, type, region, source, owner_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [id.trim(), label.trim(), type, (region || '').trim(), siteSource, req.user.id]
    )
    if (siteSource === 'satellite_fms') {
      await client.query(
        'INSERT INTO fms_assets (site_id, mobile_id, imo, mmsi, asset_name) VALUES ($1, $2, $3, $4, $5)',
        [id.trim(), mobile_id.trim(), (imo || '').trim() || null, (mmsi || '').trim() || null, label.trim()]
      )
    }
    await client.query('COMMIT')
    res.status(201).json(rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    if (err.code === '23505') return res.status(409).json({ error: 'Site ID, Mobile ID, IMO, or MMSI already exists' })
    res.status(500).json({ error: err.message })
  } finally {
    client.release()
  }
})

// ── GET /api/admin/sites/:id/history — last 15 days of FMS position history ─
router.get('/sites/:id/history', async (req, res) => {
  try {
    const visibleSiteIds = await getVisibleSiteIds(req.user)
    if (visibleSiteIds !== null && !visibleSiteIds.includes(req.params.id)) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    const { rows } = await pool.query(
      `SELECT reference_id, lat, lng, speed_kmh, report_type, received_at
         FROM fms_position_history
        WHERE site_id = $1
        ORDER BY received_at DESC
        LIMIT 2000`,
      [req.params.id]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── DELETE /api/admin/sites/:id — remove a site (owner or admin) ─
router.delete('/sites/:id', async (req, res) => {
  try {
    if (!(await canManageSite(req.user, req.params.id))) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    await pool.query('DELETE FROM sites WHERE id = $1', [req.params.id])
    await syncRoutingToFirebase()
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/admin/receivers — add a receiver (owned by creator) ─
router.post('/receivers', async (req, res) => {
  const { id, label, lea, city } = req.body
  if (!id || !label) return res.status(400).json({ error: 'id and label are required' })
  try {
    const { rows } = await pool.query(
      'INSERT INTO hq_receivers (id, label, lea, city, owner_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [id.trim(), label.trim(), (lea || '').trim(), (city || '').trim(), req.user.id]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Receiver ID already exists' })
    res.status(500).json({ error: err.message })
  }
})

// ── DELETE /api/admin/receivers/:id — remove a receiver (owner or admin) ─
router.delete('/receivers/:id', async (req, res) => {
  try {
    if (!(await canManageReceiver(req.user, req.params.id))) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    await pool.query('DELETE FROM hq_receivers WHERE id = $1', [req.params.id])
    await syncRoutingToFirebase()
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Visibility grants (admin only) ────────────────────────────────
router.get('/sites/:id/visibility', adminOnly, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.full_name, u.email
         FROM site_visibility_grants g JOIN users u ON u.id = g.user_id
        WHERE g.site_id = $1
        ORDER BY u.full_name`,
      [req.params.id]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/sites/:id/visibility/:userId', adminOnly, async (req, res) => {
  try {
    await pool.query(
      'INSERT INTO site_visibility_grants (site_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.params.id, req.params.userId]
    )
    res.json({ ok: true })
  } catch (err) {
    if (err.code === '23503') return res.status(404).json({ error: 'Site or user not found' })
    res.status(500).json({ error: err.message })
  }
})

router.delete('/sites/:id/visibility/:userId', adminOnly, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM site_visibility_grants WHERE site_id = $1 AND user_id = $2',
      [req.params.id, req.params.userId]
    )
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/receivers/:id/visibility', adminOnly, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.full_name, u.email
         FROM receiver_visibility_grants g JOIN users u ON u.id = g.user_id
        WHERE g.receiver_id = $1
        ORDER BY u.full_name`,
      [req.params.id]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/receivers/:id/visibility/:userId', adminOnly, async (req, res) => {
  try {
    await pool.query(
      'INSERT INTO receiver_visibility_grants (receiver_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.params.id, req.params.userId]
    )
    res.json({ ok: true })
  } catch (err) {
    if (err.code === '23503') return res.status(404).json({ error: 'Receiver or user not found' })
    res.status(500).json({ error: err.message })
  }
})

router.delete('/receivers/:id/visibility/:userId', adminOnly, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM receiver_visibility_grants WHERE receiver_id = $1 AND user_id = $2',
      [req.params.id, req.params.userId]
    )
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
