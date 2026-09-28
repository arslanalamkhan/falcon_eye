// DB migration: keep FMS reports from terminals that aren't registered yet.
//
// Previously fmsSync logged a warning and dropped these messages while the
// cursor moved past them, so a terminal's history was lost until someone
// noticed and registered it. Now they're parked here (15-day rolling
// window, like fms_position_history). When a site is registered with that
// MobileID, fmsSync adopts them into fms_position_history on its next tick,
// and super admins see the pending terminals in Admin → Sites.
//
// Idempotent. Usage: node server/scripts/008_fms_unmatched_messages.js
require('dotenv').config()
const pool = require('../db')

async function migrate() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`
      CREATE TABLE IF NOT EXISTS fms_unmatched_messages (
        reference_id BIGINT PRIMARY KEY,
        mobile_id    TEXT NOT NULL,
        asset_name   TEXT NOT NULL DEFAULT '',
        report_type  TEXT NOT NULL,
        lat          DOUBLE PRECISION NOT NULL,
        lng          DOUBLE PRECISION NOT NULL,
        speed_kmh    NUMERIC(6,1) NOT NULL DEFAULT 0,
        received_at  TIMESTAMPTZ NOT NULL,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_fms_unmatched_mobile_received
        ON fms_unmatched_messages (mobile_id, received_at DESC);
    `)
    await client.query('COMMIT')
    console.log('008_fms_unmatched_messages: migration complete')
    console.log('  table: fms_unmatched_messages')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
    await pool.end()
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message)
  process.exit(1)
})
