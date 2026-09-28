const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const pool = require('../db')
const { requireAuth } = require('../middleware/auth')
const { getVisibleSites } = require('../services/access')

const router = express.Router()

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' })
  }

  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.password_hash, u.role, u.full_name, u.active AS user_active,
              d.active AS department_active
         FROM users u JOIN departments d ON d.id = u.department_id
        WHERE u.email = $1`,
      [email.toLowerCase().trim()]
    )

    const user = rows[0]
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    if (!user.user_active || !user.department_active) {
      return res.status(401).json({ error: 'This account has been deactivated' })
    }

    // JWT carries only the id — role/department/active are always loaded
    // fresh from the DB on each request (see middleware/auth.js) so
    // revocation is immediate, not bound by the 8h token lifetime.
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '8h' })

    res.json({
      token,
      user: { id: user.id, email: user.email, role: user.role, full_name: user.full_name },
    })
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// PATCH /api/auth/password  (change own password — requires current password)
router.patch('/password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword and newPassword are required' })
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' })
  }
  try {
    const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id])
    if (!rows[0]) return res.status(404).json({ error: 'User not found' })

    const valid = await bcrypt.compare(currentPassword, rows[0].password_hash)
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' })

    const hash = await bcrypt.hash(newPassword, 10)
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user.id])
    res.json({ ok: true })
  } catch (err) {
    console.error('Password change error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/auth/me  (verify token + return user, department, and visible-site access)
router.get('/me', requireAuth, async (req, res) => {
  try {
    const { allSites, siteIds, sites } = await getVisibleSites(req.user)
    res.json({
      user: {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role,
        full_name: req.user.full_name,
      },
      department: req.user.department,
      access: { allSites, siteIds, sites },
    })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

module.exports = router
