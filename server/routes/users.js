const express = require('express')
const bcrypt  = require('bcryptjs')
const pool    = require('../db')
const { requireAuth, adminOnly } = require('../middleware/auth')
const { canManageUser, getVisibleSites, loadActor } = require('../services/access')
const { audit } = require('../services/audit')

const router = express.Router()

router.use(requireAuth)
router.use(adminOnly)

// ── GET /api/users — list users in scope ─────────────────────────
// super_admin sees everyone (optionally filtered by ?departmentId);
// dept_admin sees only their own department's users.
router.get('/', async (req, res) => {
  try {
    let query, params
    if (req.user.role === 'super_admin') {
      if (req.query.departmentId) {
        query = `SELECT u.id, u.email, u.full_name, u.role, u.active, u.department_id, d.code AS department_code, u.created_at
                    FROM users u JOIN departments d ON d.id = u.department_id
                   WHERE u.department_id = $1 ORDER BY u.created_at ASC`
        params = [req.query.departmentId]
      } else {
        query = `SELECT u.id, u.email, u.full_name, u.role, u.active, u.department_id, d.code AS department_code, u.created_at
                    FROM users u JOIN departments d ON d.id = u.department_id
                   ORDER BY u.created_at ASC`
        params = []
      }
    } else {
      query = `SELECT u.id, u.email, u.full_name, u.role, u.active, u.department_id, d.code AS department_code, u.created_at
                  FROM users u JOIN departments d ON d.id = u.department_id
                 WHERE u.department_id = $1 ORDER BY u.created_at ASC`
      params = [req.user.department_id]
    }
    const { rows } = await pool.query(query, params)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/users — create a user ──────────────────────────────
router.post('/', async (req, res) => {
  const { email, full_name, password, role, department_id } = req.body
  if (!email || !password || !full_name) {
    return res.status(400).json({ error: 'email, full_name, and password are required' })
  }
  if (!['super_admin', 'dept_admin', 'supervisor', 'operator'].includes(role)) {
    return res.status(400).json({ error: 'role must be super_admin, dept_admin, supervisor, or operator' })
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' })
  }

  // Dept admins are locked into their own department and may never mint
  // another super_admin. The super admin may target any department, but
  // super_admin accounts only make sense in the head department.
  let targetDeptId
  if (req.user.role === 'dept_admin') {
    if (role === 'super_admin') return res.status(403).json({ error: 'Only a super admin can create a super admin' })
    targetDeptId = req.user.department_id
  } else {
    targetDeptId = department_id ?? req.user.department_id
    if (role === 'super_admin') {
      const { rows } = await pool.query('SELECT is_head FROM departments WHERE id = $1', [targetDeptId])
      if (!rows[0]?.is_head) return res.status(400).json({ error: 'super_admin accounts must belong to the head department' })
    }
  }

  try {
    const password_hash = await bcrypt.hash(password, 10)
    const { rows } = await pool.query(
      `INSERT INTO users (email, full_name, password_hash, role, department_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, full_name, role, active, department_id, created_at`,
      [email.toLowerCase().trim(), full_name.trim(), password_hash, role, targetDeptId, req.user.id]
    )
    await audit(req.user, 'user.create', 'user', rows[0].id, { email: rows[0].email, role })
    res.status(201).json(rows[0])
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already in use' })
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/users/:id/sites — an operator's granted site IDs ───
router.get('/:id/sites', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT site_id FROM site_visibility_grants WHERE user_id = $1',
      [req.params.id]
    )
    res.json(rows.map(r => r.site_id))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── PUT /api/users/:id/sites — bulk-replace an operator's site grants ─
router.put('/:id/sites', async (req, res) => {
  const targetId = Number(req.params.id)
  const { siteIds } = req.body
  if (!Array.isArray(siteIds)) return res.status(400).json({ error: 'siteIds must be an array' })

  const client = await pool.connect()
  try {
    const targetActor = await loadActor(targetId)
    if (!targetActor) { client.release(); return res.status(404).json({ error: 'User not found' }) }
    if (!(await canManageUser(req.user, targetActor))) { client.release(); return res.status(403).json({ error: 'Forbidden' }) }

    // Validate every requested site is within the target user's department
    // universe (temporarily treat them as non-operator to get the full
    // universe rather than their current — about-to-be-replaced — grants).
    const { sites: universe } = await getVisibleSites({ ...targetActor, role: 'supervisor' })
    const universeIds = new Set(universe.map(s => s.id))
    const invalid = siteIds.filter(id => !universeIds.has(id))
    if (invalid.length > 0) {
      client.release()
      return res.status(400).json({ error: `Site(s) not in this user's department scope: ${invalid.join(', ')}` })
    }

    await client.query('BEGIN')
    await client.query('DELETE FROM site_visibility_grants WHERE user_id = $1', [targetId])
    for (const siteId of siteIds) {
      await client.query(
        'INSERT INTO site_visibility_grants (site_id, user_id, granted_by) VALUES ($1, $2, $3)',
        [siteId, targetId, req.user.id]
      )
    }
    await client.query('COMMIT')
    await audit(req.user, 'user.sites.update', 'user', targetId, { siteIds })
    res.json({ ok: true, siteIds })
  } catch (err) {
    await client.query('ROLLBACK')
    res.status(500).json({ error: err.message })
  } finally {
    client.release()
  }
})

// ── PATCH /api/users/:id — update name/role/active/department ───
router.patch('/:id', async (req, res) => {
  const targetId = Number(req.params.id)
  if (targetId === req.user.id) {
    return res.status(400).json({ error: 'You cannot modify your own account here — use the password change form' })
  }
  const { full_name, role, active, department_id } = req.body

  if (role !== undefined && !['super_admin', 'dept_admin', 'supervisor', 'operator'].includes(role)) {
    return res.status(400).json({ error: 'role must be super_admin, dept_admin, supervisor, or operator' })
  }
  if (department_id !== undefined && req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Only a super admin can move a user between departments' })
  }
  if (role === 'super_admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Only a super admin can grant the super admin role' })
  }

  try {
    const targetActor = await loadActor(targetId)
    if (!targetActor) return res.status(404).json({ error: 'User not found' })
    if (!(await canManageUser(req.user, targetActor))) return res.status(403).json({ error: 'Forbidden' })

    const sets = []
    const vals = []
    let i = 1
    if (full_name      !== undefined) { sets.push(`full_name = $${i++}`);     vals.push(full_name.trim()) }
    if (role           !== undefined) { sets.push(`role = $${i++}`);          vals.push(role) }
    if (active         !== undefined) { sets.push(`active = $${i++}`);        vals.push(!!active) }
    if (department_id  !== undefined) { sets.push(`department_id = $${i++}`); vals.push(department_id) }
    if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' })

    vals.push(targetId)
    const { rows } = await pool.query(
      `UPDATE users SET ${sets.join(', ')} WHERE id = $${i} RETURNING id, email, full_name, role, active, department_id`,
      vals
    )
    await audit(req.user, 'user.update', 'user', targetId, req.body)
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── PATCH /api/users/:id/password — reset a user's password ─────
router.patch('/:id/password', async (req, res) => {
  const { newPassword } = req.body
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' })
  }
  try {
    const targetActor = await loadActor(req.params.id)
    if (!targetActor) return res.status(404).json({ error: 'User not found' })
    if (!(await canManageUser(req.user, targetActor))) return res.status(403).json({ error: 'Forbidden' })

    const hash = await bcrypt.hash(newPassword, 10)
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.params.id])
    await audit(req.user, 'user.password_reset', 'user', req.params.id, null)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── DELETE /api/users/:id — remove a user ────────────────────────
router.delete('/:id', async (req, res) => {
  if (Number(req.params.id) === req.user.id) {
    return res.status(400).json({ error: 'You cannot delete your own account' })
  }
  try {
    const targetActor = await loadActor(req.params.id)
    if (!targetActor) return res.status(404).json({ error: 'User not found' })
    if (!(await canManageUser(req.user, targetActor))) return res.status(403).json({ error: 'Forbidden' })

    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id])
    await audit(req.user, 'user.delete', 'user', req.params.id, { email: targetActor.email })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
