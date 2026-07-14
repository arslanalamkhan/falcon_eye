const express  = require('express')
const pool     = require('../db')
const { requireAuth } = require('../middleware/auth')
const { getVisibleSiteIds, canManageSite, canManageCamera } = require('../services/visibility')

const router   = express.Router()

router.use(requireAuth)

const SAFE_COLS = `id, site_id, label, ip, port, channel, subtype, active, created_at,
                   stream_type, imou_device_id, imou_channel_id`

// ── GET /api/cameras?siteId=xxx ─────────────────────────────────────
router.get('/', async (req, res) => {
  const { siteId } = req.query
  if (!siteId) return res.status(400).json({ error: 'siteId query param is required' })
  try {
    const visibleSiteIds = await getVisibleSiteIds(req.user)
    if (visibleSiteIds !== null && !visibleSiteIds.includes(siteId)) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    const { rows } = await pool.query(
      `SELECT ${SAFE_COLS} FROM cameras WHERE site_id = $1 AND active = true ORDER BY id`,
      [siteId]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/cameras/all — list all cameras grouped with site info ───
router.get('/all', async (req, res) => {
  try {
    const visibleSiteIds = await getVisibleSiteIds(req.user)
    const query = visibleSiteIds === null
      ? pool.query(
          `SELECT c.id, c.site_id, c.label, c.ip, c.port, c.channel, c.subtype,
                  c.active, c.created_at, c.stream_type, c.imou_device_id, c.imou_channel_id,
                  s.label AS site_label, s.type AS site_type, s.owner_id AS site_owner_id
             FROM cameras c
             JOIN sites s ON s.id = c.site_id
            ORDER BY s.label, c.id`
        )
      : pool.query(
          `SELECT c.id, c.site_id, c.label, c.ip, c.port, c.channel, c.subtype,
                  c.active, c.created_at, c.stream_type, c.imou_device_id, c.imou_channel_id,
                  s.label AS site_label, s.type AS site_type, s.owner_id AS site_owner_id
             FROM cameras c
             JOIN sites s ON s.id = c.site_id
            WHERE c.site_id = ANY($1)
            ORDER BY s.label, c.id`,
          [visibleSiteIds]
        )
    const { rows } = await query
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/cameras — add a camera (must own the parent site) ─────
router.post('/', async (req, res) => {
  const {
    site_id, label, stream_type = 'rtsp',
    // RTSP fields
    ip, port, username, password, channel, subtype,
    // IMOU fields
    imou_device_id, imou_channel_id = '0',
  } = req.body

  if (!site_id) return res.status(400).json({ error: 'site_id is required' })

  if (stream_type === 'imou') {
    if (!imou_device_id) return res.status(400).json({ error: 'imou_device_id is required for IMOU cameras' })
  } else {
    if (!ip || !username || !password) {
      return res.status(400).json({ error: 'ip, username, and password are required for RTSP cameras' })
    }
  }

  try {
    if (!(await canManageSite(req.user, site_id))) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    const { rows } = await pool.query(
      `INSERT INTO cameras
         (site_id, label, stream_type, ip, port, username, password, channel, subtype, imou_device_id, imou_channel_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING ${SAFE_COLS}`,
      [
        site_id,
        (label || 'Camera').trim(),
        stream_type,
        ip?.trim()       || null,
        port             || 554,
        username?.trim() || null,
        password         || null,
        channel          || 1,
        subtype          || 0,
        imou_device_id?.trim() || null,
        imou_channel_id,
      ]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    if (err.code === '23503') return res.status(404).json({ error: 'Site not found' })
    res.status(500).json({ error: err.message })
  }
})

// ── PUT /api/cameras/:id — update a camera (owner of parent site or admin) ─
router.put('/:id', async (req, res) => {
  const { label, ip, port, username, password, channel, subtype, active, imou_device_id, imou_channel_id } = req.body
  try {
    if (!(await canManageCamera(req.user, req.params.id))) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    const sets = []
    const vals = []
    let i = 1
    if (label           !== undefined) { sets.push(`label            = $${i++}`); vals.push(label.trim()) }
    if (ip              !== undefined) { sets.push(`ip               = $${i++}`); vals.push(ip?.trim() || null) }
    if (port            !== undefined) { sets.push(`port             = $${i++}`); vals.push(port) }
    if (username        !== undefined) { sets.push(`username         = $${i++}`); vals.push(username?.trim() || null) }
    if (password        !== undefined) { sets.push(`password         = $${i++}`); vals.push(password) }
    if (channel         !== undefined) { sets.push(`channel          = $${i++}`); vals.push(channel) }
    if (subtype         !== undefined) { sets.push(`subtype          = $${i++}`); vals.push(subtype) }
    if (active          !== undefined) { sets.push(`active           = $${i++}`); vals.push(active) }
    if (imou_device_id  !== undefined) { sets.push(`imou_device_id   = $${i++}`); vals.push(imou_device_id?.trim() || null) }
    if (imou_channel_id !== undefined) { sets.push(`imou_channel_id  = $${i++}`); vals.push(imou_channel_id) }
    if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' })
    vals.push(req.params.id)
    const { rows } = await pool.query(
      `UPDATE cameras SET ${sets.join(', ')} WHERE id = $${i} RETURNING ${SAFE_COLS}`,
      vals
    )
    if (!rows[0]) return res.status(404).json({ error: 'Camera not found' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── DELETE /api/cameras/:id — delete a camera (owner of parent site or admin) ─
router.delete('/:id', async (req, res) => {
  try {
    if (!(await canManageCamera(req.user, req.params.id))) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    const { rowCount } = await pool.query('DELETE FROM cameras WHERE id = $1', [req.params.id])
    if (rowCount === 0) return res.status(404).json({ error: 'Camera not found' })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
