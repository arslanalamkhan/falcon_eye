const jwt = require('jsonwebtoken')
const { loadActor } = require('../services/access')

// Deliberate exception to the "no DB in middleware" rule: role, active
// status and department changes must take effect on the very next request
// (deactivating a user or department, or changing a role, shouldn't wait
// out the JWT's 8h expiry). The JWT carries only the user id — everything
// else is loaded fresh from PostgreSQL on every request.
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  const token = authHeader.slice(7)
  let payload
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET)
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }

  try {
    const actor = await loadActor(payload.id)
    if (!actor || !actor.active || !actor.department.active) {
      return res.status(401).json({ error: 'Account is inactive or no longer exists' })
    }
    req.user = actor
    next()
  } catch (err) {
    console.error('[Auth] Failed to load actor:', err.message)
    res.status(500).json({ error: 'Server error' })
  }
}

// Usage: requireRole('super_admin') or requireRole('super_admin', 'dept_admin')
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    next()
  }
}

module.exports = {
  requireAuth,
  requireRole,
  superOnly: requireRole('super_admin'),
  adminOnly: requireRole('super_admin', 'dept_admin'),
}
