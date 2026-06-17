// DB migration: add sites, hq_receivers, site_receiver_routes tables
// Usage: node server/scripts/002_routing_schema.js
require('dotenv').config()
const pool = require('../db')

async function migrate() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    await client.query(`
      CREATE TABLE IF NOT EXISTS sites (
        id         TEXT PRIMARY KEY,
        label      TEXT NOT NULL,
        type       TEXT NOT NULL DEFAULT 'train'   CHECK (type IN ('train', 'mine', 'other')),
        region     TEXT NOT NULL DEFAULT '',
        active     BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS hq_receivers (
        id         TEXT PRIMARY KEY,
        label      TEXT NOT NULL,
        lea        TEXT NOT NULL DEFAULT '',
        city       TEXT NOT NULL DEFAULT '',
        active     BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS site_receiver_routes (
        site_id     TEXT NOT NULL REFERENCES sites(id)        ON DELETE CASCADE,
        receiver_id TEXT NOT NULL REFERENCES hq_receivers(id) ON DELETE CASCADE,
        PRIMARY KEY (site_id, receiver_id),
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)

    // ── Seed sites ───────────────────────────────────────────────
    await client.query(`
      INSERT INTO sites (id, label, type, region) VALUES
        ('jaffer_express', 'Jaffer Express',     'train', 'Balochistan/Punjab'),
        ('lahore_express', 'Lahore Express',     'train', 'Sindh/Punjab'),
        ('khyber_mail',    'Khyber Mail',        'train', 'KP/Punjab'),
        ('khewra_mine',    'Khewra Salt Mine',   'mine',  'Punjab'),
        ('saindak_mine',   'Saindak Copper Mine','mine',  'Balochistan')
      ON CONFLICT (id) DO NOTHING;
    `)

    // ── Seed hq_receivers ────────────────────────────────────────
    await client.query(`
      INSERT INTO hq_receivers (id, label, lea, city) VALUES
        ('nacta_islamabad',      'NACTA HQ Islamabad',        'NACTA',         'Islamabad'),
        ('fc_quetta',            'Frontier Corps HQ Quetta',  'Frontier Corps','Quetta'),
        ('punjab_police_lahore', 'Punjab Police HQ Lahore',   'Punjab Police', 'Lahore'),
        ('rangers_karachi',      'Rangers HQ Karachi',        'Rangers',       'Karachi')
      ON CONFLICT (id) DO NOTHING;
    `)

    // ── Seed routing (matches Firebase seed) ─────────────────────
    await client.query(`
      INSERT INTO site_receiver_routes (site_id, receiver_id) VALUES
        ('jaffer_express', 'nacta_islamabad'),
        ('jaffer_express', 'fc_quetta'),
        ('lahore_express', 'nacta_islamabad'),
        ('lahore_express', 'punjab_police_lahore'),
        ('khyber_mail',    'nacta_islamabad'),
        ('khyber_mail',    'punjab_police_lahore'),
        ('khewra_mine',    'nacta_islamabad'),
        ('khewra_mine',    'punjab_police_lahore'),
        ('saindak_mine',   'nacta_islamabad'),
        ('saindak_mine',   'fc_quetta')
      ON CONFLICT DO NOTHING;
    `)

    await client.query('COMMIT')
    console.log('Migration complete.')
    console.log('  ✓ tables: sites, hq_receivers, site_receiver_routes')
    console.log('  ✓ seeded: 5 sites, 4 receivers, 10 routes')
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
