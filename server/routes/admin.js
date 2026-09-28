const express  = require('express')
const pool     = require('../db')
const { requireAuth, adminOnly, superOnly } = require('../middleware/auth')
const { syncRoutingToFirebase }  = require('../services/routingSync')
const { audit } = require('../services/audit')
const {
  getVisibleSites, getVisibleSiteIds, getVisibleReceiverIds,
  canManageSite, canManageReceiver, canRoute,
} = require('../services/access')

const router = express.Router()

// All admin routes require authentication
router.use(requireAuth)

// ── GET /api/admin/data — config snapshot scoped to what the user can see ─
router.get('/data', async (req, res) => {
  try {
    const [{ allSites, siteIds }, visibleReceiverIds] = await Promise.all([
      getVisibleSites(req.user),
      getVisibleReceiverIds(req.user),
    ])

    const sitesQuery = allSites
      ? pool.query(
          `SELECT s.*, u.full_name AS owner_name, d.code AS department_code, d.name AS department_name
             FROM sites s
             LEFT JOIN users u ON u.id = s.owner_id
             JOIN departments d ON d.id = s.department_id
            ORDER BY s.type, s.label`
        )
      : pool.query(
          `SELECT s.*, u.full_name AS owner_name, d.code AS department_code, d.name AS department_name
             FROM sites s
             LEFT JOIN users u ON u.id = s.owner_id
             JOIN departments d ON d.id = s.department_id
            WHERE s.id = ANY($1)
            ORDER BY s.type, s.label`,
          [siteIds]
        )

    const receiversQuery = visibleReceiverIds === null
      ? pool.query(
          `SELECT r.*, u.full_name AS owner_name, d.code AS department_code, d.name AS department_name
             FROM hq_receivers r
             LEFT JOIN users u ON u.id = r.owner_id
             JOIN departments d ON d.id = r.department_id
            ORDER BY r.lea, r.label`
        )
      : pool.query(
          `SELECT r.*, u.full_name AS owner_name, d.code AS department_code, d.name AS department_name
             FROM hq_receivers r
             LEFT JOIN users u ON u.id = r.owner_id
             JOIN departments d ON d.id = r.department_id
            WHERE r.id = ANY($1)
            ORDER BY r.lea, r.label`,
          [visibleReceiverIds]
        )

    // Routes for visible sites — includes routes to receivers outside the
    // actor's scope (e.g. a super-admin cross-department route) so dept
    // admins can see them read-only, rather than silently hiding them.
    const routesQuery = allSites
      ? pool.query('SELECT site_id, receiver_id FROM site_receiver_routes')
      : pool.query(
          `SELECT site_id, receiver_id FROM site_receiver_routes WHERE site_id = ANY($1)`,
          [siteIds]
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

// ── PUT /api/admin/routes/:siteId/:receiverId — enable a route ────
router.put('/routes/:siteId/:receiverId', adminOnly, async (req, res) => {
  const { siteId, receiverId } = req.params
  try {
    if (!(await canRoute(req.user, siteId, receiverId))) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    await pool.query(
      'INSERT INTO site_receiver_routes (site_id, receiver_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [siteId, receiverId]
    )
    await syncRoutingToFirebase()
    await audit(req.user, 'route.enable', 'route', `${siteId}:${receiverId}`, null)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── DELETE /api/admin/routes/:siteId/:receiverId — disable ───────
router.delete('/routes/:siteId/:receiverId', adminOnly, async (req, res) => {
  const { siteId, receiverId } = req.params
  try {
    if (!(await canRoute(req.user, siteId, receiverId))) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    await pool.query(
      'DELETE FROM site_receiver_routes WHERE site_id = $1 AND receiver_id = $2',
      [siteId, receiverId]
    )
    await syncRoutingToFirebase()
    await audit(req.user, 'route.disable', 'route', `${siteId}:${receiverId}`, null)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/admin/sites — add a site (owned by creator, in their dept) ─
// source 'satellite_fms' registers a site tracked via a Falcon Mega Track
// terminal instead of an ESP32 panic button — requires the terminal's
// mobile_id (hardware serial) so fmsSync can match incoming position
// reports to it, independent of the site's physical `type`. IMO/MMSI are
// optional — FMS returns placeholder junk for them on non-vessel terminals.
router.post('/sites', adminOnly, async (req, res) => {
  const { id, label, type, region, source, mobile_id, imo, mmsi, department_id } = req.body
  if (!id || !label) return res.status(400).json({ error: 'id and label are required' })
  if (!['train', 'mine', 'other'].includes(type)) {
    return res.status(400).json({ error: 'type must be train, mine, or other' })
  }
  const siteSource = source === 'satellite_fms' ? 'satellite_fms' : 'cellular'
  if (siteSource === 'satellite_fms' && !mobile_id) {
    return res.status(400).json({ error: 'mobile_id (terminal serial) is required for satellite (FMS) sites' })
  }

  // dept_admins can only create sites in their own department; only the
  // super admin may target a different department.
  const targetDeptId = req.user.role === 'super_admin' ? (department_id ?? req.user.department_id) : req.user.department_id

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query(
      'INSERT INTO sites (id, label, type, region, source, owner_id, department_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [id.trim(), label.trim(), type, (region || '').trim(), siteSource, req.user.id, targetDeptId]
    )
    if (siteSource === 'satellite_fms') {
      await client.query(
        'INSERT INTO fms_assets (site_id, mobile_id, imo, mmsi, asset_name) VALUES ($1, $2, $3, $4, $5)',
        [id.trim(), mobile_id.trim(), (imo || '').trim() || null, (mmsi || '').trim() || null, label.trim()]
      )
    }
    await client.query('COMMIT')
    await audit(req.user, 'site.create', 'site', rows[0].id, { label: rows[0].label, department_id: targetDeptId })
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

// ── DELETE /api/admin/sites/:id — remove a site (own dept admin or super) ─
router.delete('/sites/:id', adminOnly, async (req, res) => {
  try {
    if (!(await canManageSite(req.user, req.params.id))) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    await pool.query('DELETE FROM sites WHERE id = $1', [req.params.id])
    await syncRoutingToFirebase()
    await audit(req.user, 'site.delete', 'site', req.params.id, null)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/admin/receivers — add a receiver (owned by creator, in their dept) ─
router.post('/receivers', adminOnly, async (req, res) => {
  const { id, label, lea, city, department_id } = req.body
  if (!id || !label) return res.status(400).json({ error: 'id and label are required' })
  const targetDeptId = req.user.role === 'super_admin' ? (department_id ?? req.user.department_id) : req.user.department_id
  try {
    const { rows } = await pool.query(
      'INSERT INTO hq_receivers (id, label, lea, city, owner_id, department_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [id.trim(), label.trim(), (lea || '').trim(), (city || '').trim(), req.user.id, targetDeptId]
    )
    await audit(req.user, 'receiver.create', 'receiver', rows[0].id, { label: rows[0].label, department_id: targetDeptId })
    res.status(201).json(rows[0])
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Receiver ID already exists' })
    res.status(500).json({ error: err.message })
  }
})

// ── DELETE /api/admin/receivers/:id — remove a receiver (own dept admin or super) ─
router.delete('/receivers/:id', adminOnly, async (req, res) => {
  try {
    if (!(await canManageReceiver(req.user, req.params.id))) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    await pool.query('DELETE FROM hq_receivers WHERE id = $1', [req.params.id])
    await syncRoutingToFirebase()
    await audit(req.user, 'receiver.delete', 'receiver', req.params.id, null)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/admin/fms/unregistered — terminals reporting but not registered ─
// Super admin only: an unregistered terminal belongs to no department yet,
// so showing it to a dept admin would leak another agency's asset.
// fmsSync parks these reports (15-day window) and adopts them into
// fms_position_history as soon as a site is registered with the MobileID.
router.get('/fms/unregistered', superOnly, async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT m.mobile_id,
             (array_agg(m.asset_name  ORDER BY m.received_at DESC, m.reference_id DESC))[1] AS asset_name,
             (array_agg(m.report_type ORDER BY m.received_at DESC, m.reference_id DESC))[1] AS last_report_type,
             (array_agg(m.lat         ORDER BY m.received_at DESC, m.reference_id DESC))[1] AS lat,
             (array_agg(m.lng         ORDER BY m.received_at DESC, m.reference_id DESC))[1] AS lng,
             COUNT(*)::int      AS report_count,
             MIN(m.received_at) AS first_seen,
             MAX(m.received_at) AS last_seen,
             BOOL_OR(m.report_type = 'Ship_Security_Alert' AND m.received_at > NOW() - INTERVAL '45 minutes') AS alarm_recent
        FROM fms_unmatched_messages m
       WHERE m.mobile_id NOT IN (SELECT mobile_id FROM fms_assets)
       GROUP BY m.mobile_id
       ORDER BY alarm_recent DESC, last_seen DESC
    `)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/admin/audit — audit trail (super: all, dept_admin: own dept) ─
router.get('/audit', adminOnly, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500)
    const query = req.user.role === 'super_admin'
      ? pool.query(
          `SELECT a.*, u.email AS actor_email, u.full_name AS actor_name, d.code AS department_code
             FROM audit_log a
             LEFT JOIN users u ON u.id = a.actor_id
             LEFT JOIN departments d ON d.id = a.department_id
            ORDER BY a.created_at DESC LIMIT $1`,
          [limit]
        )
      : pool.query(
          `SELECT a.*, u.email AS actor_email, u.full_name AS actor_name, d.code AS department_code
             FROM audit_log a
             LEFT JOIN users u ON u.id = a.actor_id
             LEFT JOIN departments d ON d.id = a.department_id
            WHERE a.department_id = $1
            ORDER BY a.created_at DESC LIMIT $2`,
          [req.user.department_id, limit]
        )
    const { rows } = await query
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
