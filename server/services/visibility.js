const pool = require('../db')

// Returns null for admins (meaning "no filter — sees everything"),
// otherwise the array of site IDs the user owns or has been granted.
async function getVisibleSiteIds(user) {
  if (user.role === 'admin') return null
  const { rows } = await pool.query(
    `SELECT id FROM sites WHERE owner_id = $1
     UNION
     SELECT site_id FROM site_visibility_grants WHERE user_id = $1`,
    [user.id]
  )
  return rows.map(r => r.id)
}

// Returns null for admins, otherwise the array of receiver IDs the user
// owns or has been granted.
async function getVisibleReceiverIds(user) {
  if (user.role === 'admin') return null
  const { rows } = await pool.query(
    `SELECT id FROM hq_receivers WHERE owner_id = $1
     UNION
     SELECT receiver_id FROM receiver_visibility_grants WHERE user_id = $1`,
    [user.id]
  )
  return rows.map(r => r.id)
}

async function canManageSite(user, siteId) {
  if (user.role === 'admin') return true
  const { rows } = await pool.query('SELECT owner_id FROM sites WHERE id = $1', [siteId])
  return rows[0]?.owner_id === user.id
}

async function canManageReceiver(user, receiverId) {
  if (user.role === 'admin') return true
  const { rows } = await pool.query('SELECT owner_id FROM hq_receivers WHERE id = $1', [receiverId])
  return rows[0]?.owner_id === user.id
}

async function canManageCamera(user, cameraId) {
  if (user.role === 'admin') return true
  const { rows } = await pool.query(
    `SELECT s.owner_id FROM cameras c JOIN sites s ON s.id = c.site_id WHERE c.id = $1`,
    [cameraId]
  )
  return rows[0]?.owner_id === user.id
}

module.exports = {
  getVisibleSiteIds,
  getVisibleReceiverIds,
  canManageSite,
  canManageReceiver,
  canManageCamera,
}
