// DB migration: Falcon Mega Track (FMS) satellite integration
// Adds a source column (cellular vs satellite_fms) — orthogonal to site
// `type` (train/mine/other), since FMS terminals are being deployed on
// ground assets, not vessels, despite FMS's API being maritime-shaped —
// plus a MobileID -> site_id mapping table, and a cursor table for the
// FMS ReferenceID-based polling API.
//
// MobileID (the terminal's own hardware serial, e.g. "01398397SKY12AE")
// is the primary match key — confirmed against a live API response.
// It isn't in FMS's documented schema but is present on every message.
// IMO/MMSI are kept as optional secondary fields only: for these ground
// terminals FMS returns junk placeholders for them ("0" / "undefined"),
// not real values, so they can't be relied on for matching.
// Usage: node server/scripts/006_fms_integration_schema.js
require('dotenv').config()
const pool = require('../db')

async function migrate() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    await client.query(`
      ALTER TABLE sites ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'cellular'
        CHECK (source IN ('cellular', 'satellite_fms'));

      CREATE TABLE IF NOT EXISTS fms_assets (
        site_id    TEXT PRIMARY KEY REFERENCES sites(id) ON DELETE CASCADE,
        mobile_id  TEXT NOT NULL UNIQUE,
        imo        TEXT UNIQUE,
        mmsi       TEXT UNIQUE,
        asset_name TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS fms_sync_cursor (
        id                INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
        next_reference_id BIGINT NOT NULL DEFAULT 0,
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      INSERT INTO fms_sync_cursor (id, next_reference_id) VALUES (1, 0)
        ON CONFLICT (id) DO NOTHING;

      -- Location history for FMS-tracked sites. A rolling 15-day window is
      -- enforced by fmsSync (deletes rows older than 15 days on every tick)
      -- rather than a DB-level TTL, since Postgres has no built-in one.
      CREATE TABLE IF NOT EXISTS fms_position_history (
        id           BIGSERIAL PRIMARY KEY,
        site_id      TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
        reference_id BIGINT NOT NULL UNIQUE,
        lat          DOUBLE PRECISION NOT NULL,
        lng          DOUBLE PRECISION NOT NULL,
        speed_kmh    NUMERIC(6,1) NOT NULL DEFAULT 0,
        report_type  TEXT NOT NULL,
        received_at  TIMESTAMPTZ NOT NULL,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_fms_position_history_site_received
        ON fms_position_history (site_id, received_at DESC);
    `)

    await client.query('COMMIT')
    console.log('006_fms_integration_schema: migration complete')
    console.log('  sites.source column added (cellular | satellite_fms)')
    console.log('  tables: fms_assets, fms_sync_cursor, fms_position_history')
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
