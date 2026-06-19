require('dotenv').config()
const pool = require('../db')

async function run() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Make RTSP-only fields nullable so IMOU cameras don't need them
    await client.query(`ALTER TABLE cameras ALTER COLUMN ip       DROP NOT NULL`)
    await client.query(`ALTER TABLE cameras ALTER COLUMN username DROP NOT NULL`)
    await client.query(`ALTER TABLE cameras ALTER COLUMN password DROP NOT NULL`)

    // Add IMOU-specific columns
    await client.query(`
      ALTER TABLE cameras
        ADD COLUMN IF NOT EXISTS stream_type    TEXT NOT NULL DEFAULT 'rtsp',
        ADD COLUMN IF NOT EXISTS imou_device_id TEXT,
        ADD COLUMN IF NOT EXISTS imou_channel_id TEXT NOT NULL DEFAULT '0'
    `)

    await client.query('COMMIT')
    console.log('004_imou_schema: migration complete')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
    await pool.end()
  }
}

run().catch(err => { console.error(err); process.exit(1) })
