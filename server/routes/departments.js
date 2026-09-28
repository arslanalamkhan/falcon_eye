const express = require('express')
const bcrypt  = require('bcryptjs')
const pool    = require('../db')
const { requireAuth, superOnly } = require('../middleware/auth')
const { audit } = require('../services/audit')

const router = express.Router()

// Department management is super_admin only — a dept admin never sees
// other departments' management surface, only their own department's data
// (via /api/admin/data, filtered by services/access.js).
router.use(requireAuth)
router.use(superOnly)

// ── GET /api/departments — list with counts + oversight targets ─────
router.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT d.*,
             (SELECT COUNT(*) FROM users u        WHERE u.department_id = d.id) AS user_count,
             (SELECT COUNT(*) FROM sites s         WHERE s.department_id = d.id) AS site_count,
             (SELECT COUNT(*) FROM hq_receivers r  WHERE r.department_id = d.id) AS receiver_count,
             COALESCE((
               SELECT json_agg(json_build_object('id', t.id, 'code', t.code, 'name', t.name))
                 FROM department_oversight o
                 JOIN departments t ON t.id = o.target_department_id
                WHERE o.viewer_department_id = d.id
             ), '[]') AS oversight_targets
        FROM departments d
       ORDER BY d.is_head DESC, d.name
    `)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/departments — create a department + its first admin ──
router.post('/', async (req, res) => {
  const { code, name, view_scope, target_ids, admin } = req.body
  if (!code || !name) return res.status(400).json({ error: 'code and name are required' })
  if (!['own', 'all', 'selected'].includes(view_scope)) {
    return res.status(400).json({ error: 'view_scope must be own, all, or selected' })
  }
  if (!admin?.email || !admin?.full_name || !admin?.password) {
    return res.status(400).json({ error: 'admin.email, admin.full_name, and admin.password are required' })
  }
  if (admin.password.length < 8) {
    return res.status(400).json({ error: 'admin.password must be at least 8 characters' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const { rows: deptRows } = await client.query(
      `INSERT INTO departments (code, name, view_scope) VALUES ($1, $2, $3) RETURNING *`,
      [code.trim().toUpperCase(), name.trim(), view_scope]
    )
    const dept = deptRows[0]

    if (view_scope === 'selected' && Array.isArray(target_ids) && target_ids.length > 0) {
      for (const targetId of target_ids) {
        await client.query(
          `INSERT INTO department_oversight (viewer_department_id, target_department_id) VALUES ($1, $2)`,
          [dept.id, targetId]
        )
      }
    }

    const hash = await bcrypt.hash(admin.password, 10)
    const { rows: userRows } = await client.query(
      `INSERT INTO users (email, full_name, password_hash, role, department_id, created_by)
       VALUES ($1, $2, $3, 'dept_admin', $4, $5)
       RETURNING id, email, full_name, role, department_id, created_at`,
      [admin.email.toLowerCase().trim(), admin.full_name.trim(), hash, dept.id, req.user.id]
    )

    await client.query('COMMIT')
    await audit(req.user, 'department.create', 'department', dept.id, { code: dept.code, admin_email: userRows[0].email })
    res.status(201).json({ department: dept, admin: userRows[0] })
  } catch (err) {
    await client.query('ROLLBACK')
    if (err.code === '23505') return res.status(409).json({ error: 'Department code or admin email already exists' })
    res.status(500).json({ error: err.message })
  } finally {
    client.release()
  }
})

// ── PATCH /api/departments/:id — update scope, targets, active, name ─
router.patch('/:id', async (req, res) => {
  const deptId = Number(req.params.id)
  const { name, view_scope, target_ids, active } = req.body

  if (view_scope !== undefined && !['own', 'all', 'selected'].includes(view_scope)) {
    return res.status(400).json({ error: 'view_scope must be own, all, or selected' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const { rows: existingRows } = await client.query('SELECT * FROM departments WHERE id = $1', [deptId])
    const existing = existingRows[0]
    if (!existing) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Department not found' }) }

    if (existing.is_head && active === false) {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'The head department (NACTA) cannot be deactivated' })
    }

    const sets = []
    const vals = []
    let i = 1
    if (name       !== undefined) { sets.push(`name = $${i++}`);       vals.push(name.trim()) }
    if (view_scope !== undefined) { sets.push(`view_scope = $${i++}`); vals.push(view_scope) }
    if (active     !== undefined) { sets.push(`active = $${i++}`);     vals.push(!!active) }

    let dept = existing
    if (sets.length > 0) {
      vals.push(deptId)
      const { rows } = await client.query(
        `UPDATE departments SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
        vals
      )
      dept = rows[0]
    }

    if (target_ids !== undefined) {
      await client.query('DELETE FROM department_oversight WHERE viewer_department_id = $1', [deptId])
      const targets = Array.isArray(target_ids) ? target_ids.filter(t => Number(t) !== deptId) : []
      for (const targetId of targets) {
        await client.query(
          `INSERT INTO department_oversight (viewer_department_id, target_department_id) VALUES ($1, $2)`,
          [deptId, targetId]
        )
      }
    }

    await client.query('COMMIT')
    await audit(req.user, 'department.update', 'department', deptId, req.body)
    res.json(dept)
  } catch (err) {
    await client.query('ROLLBACK')
    res.status(500).json({ error: err.message })
  } finally {
    client.release()
  }
})

// ── DELETE /api/departments/:id — only when empty and not the head ──
router.delete('/:id', async (req, res) => {
  const deptId = Number(req.params.id)
  try {
    const { rows } = await pool.query('SELECT is_head FROM departments WHERE id = $1', [deptId])
    if (!rows[0]) return res.status(404).json({ error: 'Department not found' })
    if (rows[0].is_head) return res.status(400).json({ error: 'The head department (NACTA) cannot be deleted' })

    const { rows: counts } = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM users u       WHERE u.department_id = $1) AS user_count,
        (SELECT COUNT(*) FROM sites s       WHERE s.department_id = $1) AS site_count,
        (SELECT COUNT(*) FROM hq_receivers r WHERE r.department_id = $1) AS receiver_count
    `, [deptId])
    const { user_count, site_count, receiver_count } = counts[0]
    if (Number(user_count) > 0 || Number(site_count) > 0 || Number(receiver_count) > 0) {
      return res.status(409).json({ error: 'Department still has users, sites, or receivers — remove them first' })
    }

    await pool.query('DELETE FROM departments WHERE id = $1', [deptId])
    await audit(req.user, 'department.delete', 'department', deptId, null)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
