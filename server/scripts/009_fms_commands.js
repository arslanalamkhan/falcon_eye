// DB migration: remote satellite-terminal commands (FMS v2).
//
// fms_commands is the audit/progress trail for commands sent to a terminal
// through the FMS API: SSAS alarm reset, position poll, and SSAS test mode
// on/off. reset and poll_position are asynchronous on FMS's side (they return
// a ForwardMessageID); the tracker in services/fmsCommands.js polls their
// status until delivered, failed, or timed out, so it reads the 'pending'
// rows straight from this table and survives server restarts.
// fms_assets gains the terminal's current SSAS test-mode flag.
//
// Idempotent. Usage: node server/scripts/009_fms_commands.js
require('dotenv').config()
const pool = require('../db')

async function migrate() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`
      ALTER TABLE fms_assets ADD COLUMN IF NOT EXISTS test_mode BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE fms_assets ADD COLUMN IF NOT EXISTS test_mode_changed_at TIMESTAMPTZ;

      CREATE TABLE IF NOT EXISTS fms_commands (
        id                 SERIAL PRIMARY KEY,
        site_id            TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
        mobile_id          TEXT NOT NULL,
        kind               TEXT NOT NULL,      -- 'reset' | 'poll_position' | 'test_mode_on' | 'test_mode_off'
        status             TEXT NOT NULL,      -- 'pending' | 'completed' | 'failed' | 'timed_out'
        forward_message_id BIGINT,             -- reset / poll_position only
        forward_status     TEXT,               -- last normalised ForwardMessageStatus name
        error_code         TEXT,               -- FMS code on failure
        description        TEXT,               -- human-readable outcome, shown in UI
        requested_by       INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at       TIMESTAMPTZ
      );

      CREATE INDEX IF NOT EXISTS idx_fms_commands_site_created ON fms_commands (site_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_fms_commands_pending ON fms_commands (status) WHERE status = 'pending';
    `)
    await client.query('COMMIT')
    console.log('009_fms_commands: migration complete')
    console.log('  table: fms_commands')
    console.log('  columns: fms_assets.test_mode, fms_assets.test_mode_changed_at')
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
