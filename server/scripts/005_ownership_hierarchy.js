// DB migration: ownership + visibility grants for sites and hq_receivers
// Usage: node server/scripts/005_ownership_hierarchy.js
require('dotenv').config()
const pool = require('../db')

async function migrate() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    await client.query(`
      ALTER TABLE sites        ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
      ALTER TABLE hq_receivers ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

      CREATE TABLE IF NOT EXISTS site_visibility_grants (
        site_id     TEXT    NOT NULL REFERENCES sites(id)   ON DELETE CASCADE,
        user_id     INTEGER NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
        granted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (site_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS receiver_visibility_grants (
        receiver_id TEXT    NOT NULL REFERENCES hq_receivers(id) ON DELETE CASCADE,
        user_id     INTEGER NOT NULL REFERENCES users(id)        ON DELETE CASCADE,
        granted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (receiver_id, user_id)
      );
    `)

    // Backfill existing rows to the first admin so nothing becomes orphaned/invisible
    const { rows: adminRows } = await client.query(
      `SELECT id FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1`
    )
    if (adminRows[0]) {
      const adminId = adminRows[0].id
      await client.query(`UPDATE sites        SET owner_id = $1 WHERE owner_id IS NULL`, [adminId])
      await client.query(`UPDATE hq_receivers SET owner_id = $1 WHERE owner_id IS NULL`, [adminId])
      console.log(`  backfilled existing sites/receivers to admin user #${adminId}`)
    } else {
      console.log('  no admin user found — skipped owner_id backfill')
    }

    await client.query('COMMIT')
    console.log('005_ownership_hierarchy: migration complete')
    console.log('  tables: site_visibility_grants, receiver_visibility_grants')
    console.log('  columns: sites.owner_id, hq_receivers.owner_id')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
    await pool.end()
  }
}

migrate().catch(err => {
  console.error('Migration failed:', err.message)
  process.exit(1)
})
