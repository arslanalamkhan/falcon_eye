require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') })
const { Pool } = require('pg')

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

async function run() {
  const client = await pool.connect()
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS cameras (
        id         SERIAL PRIMARY KEY,
        site_id    TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
        label      TEXT NOT NULL DEFAULT 'Camera',
        ip         TEXT NOT NULL,
        port       INTEGER NOT NULL DEFAULT 554,
        username   TEXT NOT NULL,
        password   TEXT NOT NULL,
        channel    INTEGER NOT NULL DEFAULT 1,
        subtype    INTEGER NOT NULL DEFAULT 0,
        active     BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)
    console.log('cameras table created (or already exists)')
  } finally {
    client.release()
    await pool.end()
  }
}

run().catch(err => { console.error(err); process.exit(1) })
