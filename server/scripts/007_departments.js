// DB migration: department-based multi-tenant access model.
//
// Introduces `departments` as the tenancy boundary: every site, receiver
// and user belongs to exactly one department. A department's `view_scope`
// controls whether it sees only its own sites ('own'), every department's
// sites ('all' — used by NACTA), or a hand-picked set of other departments
// ('selected', backed by `department_oversight`).
//
// Roles move from a flat admin/supervisor/operator to
// super_admin/dept_admin/supervisor/operator. The existing NACTA admin
// (admin@nacta.gov.pk) becomes the one super_admin; every other existing
// 'admin' becomes a dept_admin of the (seeded) NACTA department, since
// that's the only department that exists pre-migration.
//
// `site_visibility_grants` is repurposed as the per-operator site
// allow-list (now scoped within a department rather than per-owner).
// `receiver_visibility_grants` is dropped — receiver visibility is now a
// department-level concern, not a per-user grant.
//
// Idempotent — safe to run more than once.
// Usage: node server/scripts/007_departments.js
require('dotenv').config()
const pool = require('../db')

async function migrate() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // ── Core tables ──────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id         SERIAL PRIMARY KEY,
        code       TEXT NOT NULL UNIQUE,
        name       TEXT NOT NULL,
        view_scope TEXT NOT NULL DEFAULT 'own' CHECK (view_scope IN ('own', 'all', 'selected')),
        is_head    BOOLEAN NOT NULL DEFAULT false,
        active     BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS department_oversight (
        viewer_department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
        target_department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
        created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (viewer_department_id, target_department_id),
        CHECK (viewer_department_id <> target_department_id)
      );

      CREATE TABLE IF NOT EXISTS audit_log (
        id            BIGSERIAL PRIMARY KEY,
        actor_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
        department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
        action        TEXT NOT NULL,
        entity_type   TEXT NOT NULL,
        entity_id     TEXT,
        details       JSONB,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_audit_log_department_created
        ON audit_log (department_id, created_at DESC);
    `)

    // ── Seed NACTA (the head department) ────────────────────────
    await client.query(`
      INSERT INTO departments (code, name, view_scope, is_head)
      VALUES ('NACTA', 'National Counter Terrorism Authority', 'all', true)
      ON CONFLICT (code) DO NOTHING;
    `)
    const { rows: nactaRows } = await client.query(`SELECT id FROM departments WHERE code = 'NACTA'`)
    const nactaId = nactaRows[0].id

    // ── New columns (nullable for now — backfilled below) ───────
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS department_id INTEGER REFERENCES departments(id) ON DELETE RESTRICT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS active        BOOLEAN NOT NULL DEFAULT true;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by    INTEGER REFERENCES users(id) ON DELETE SET NULL;

      ALTER TABLE sites ADD COLUMN IF NOT EXISTS department_id INTEGER REFERENCES departments(id) ON DELETE RESTRICT;
      ALTER TABLE hq_receivers ADD COLUMN IF NOT EXISTS department_id INTEGER REFERENCES departments(id) ON DELETE RESTRICT;

      ALTER TABLE site_visibility_grants ADD COLUMN IF NOT EXISTS granted_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
    `)

    // ── Backfill everything that pre-dates departments to NACTA ─
    await client.query(`UPDATE users        SET department_id = $1 WHERE department_id IS NULL`, [nactaId])
    await client.query(`UPDATE sites        SET department_id = $1 WHERE department_id IS NULL`, [nactaId])
    await client.query(`UPDATE hq_receivers SET department_id = $1 WHERE department_id IS NULL`, [nactaId])

    // ── Role migration: admin -> super_admin (NACTA login) or dept_admin ─
    await client.query(`UPDATE users SET role = 'super_admin' WHERE role = 'admin' AND email = 'admin@nacta.gov.pk'`)
    await client.query(`UPDATE users SET role = 'dept_admin'  WHERE role = 'admin'`)

    // Postgres has no "ADD CONSTRAINT IF NOT EXISTS" for CHECK constraints,
    // so guard it with a DO block that swallows the duplicate-object error.
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE users ADD CONSTRAINT users_role_check
          CHECK (role IN ('super_admin', 'dept_admin', 'supervisor', 'operator'));
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `)

    // ── Lock down NOT NULL now that every row has a department ──
    await client.query(`
      ALTER TABLE users        ALTER COLUMN department_id SET NOT NULL;
      ALTER TABLE sites        ALTER COLUMN department_id SET NOT NULL;
      ALTER TABLE hq_receivers ALTER COLUMN department_id SET NOT NULL;
    `)

    // ── Receiver visibility is now department-scoped, not per-grant ─
    await client.query(`DROP TABLE IF EXISTS receiver_visibility_grants`)

    await client.query('COMMIT')
    console.log('007_departments: migration complete')
    console.log(`  seeded department: NACTA (id ${nactaId}, view_scope=all, is_head=true)`)
    console.log('  tables: departments, department_oversight, audit_log')
    console.log('  columns: users.department_id/active/created_by, sites.department_id, hq_receivers.department_id, site_visibility_grants.granted_by')
    console.log('  dropped: receiver_visibility_grants')
    console.log('  admin@nacta.gov.pk -> super_admin; other admins -> dept_admin (NACTA)')
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
