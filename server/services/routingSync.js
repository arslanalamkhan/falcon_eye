// Reads current routing from PostgreSQL and writes it to Firebase routing/ node.
// Call this after any change to site_receiver_routes in the DB.
const { getFirebaseDb } = require('./firebase')
const pool = require('../db')

async function syncRoutingToFirebase() {
  const { rows } = await pool.query(`
    SELECT r.site_id, r.receiver_id
    FROM   site_receiver_routes r
    JOIN   sites       s ON s.id = r.site_id     AND s.active = true
    JOIN   hq_receivers h ON h.id = r.receiver_id AND h.active = true
  `)

  // Build { site_id: { receiver_id: true } } object
  const routing = {}
  for (const { site_id, receiver_id } of rows) {
    if (!routing[site_id]) routing[site_id] = {}
    routing[site_id][receiver_id] = true
  }

  const rtdb = getFirebaseDb()
  await rtdb.ref('routing').set(routing)
  console.log(`[RoutingSync] Firebase routing updated (${rows.length} route(s))`)
}

module.exports = { syncRoutingToFirebase }
