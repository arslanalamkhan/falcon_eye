const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const pool = require('../db')

const router = express.Router()

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' })
  }

  try {
    const { rows } = await pool.query(
      'SELECT id, email, password_hash, role, full_name FROM users WHERE email = $1',
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

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    )

    res.json({
      token,
      user: { id: user.id, email: user.email, role: user.role, full_name: user.full_name },
    })
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/auth/me  (verify token + return user)
router.get('/me', require('../middleware/auth').requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, email, role, full_name FROM users WHERE id = $1',
      [req.user.id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'User not found' })
    res.json({ user: rows[0] })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

module.exports = router
