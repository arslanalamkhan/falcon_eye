// Department-scoped access control. Replaces the old per-owner
// services/visibility.js now that every site, receiver and user belongs
// to a department.
//
// Core idea: a department's "universe" is its own data plus (depending on
// view_scope) other departments' data. A user's visible set is their
// department's universe — narrowed to an explicit grant list for
// operators. Management rights (create/edit/delete) are always limited to
// the actor's own department, except for super_admin.
const pool = require('../db')

// ── Actor loading ────────────────────────────────────────────────────
// Loads the user + their department in one shot. Used by requireAuth on
// every request so role/active/department changes take effect immediately
// (not just on next login) — see server/middleware/auth.js.
async function loadActor(userId) {
  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.full_name, u.role, u.active AS user_active,
            d.id AS department_id, d.code AS department_code, d.name AS department_name,
            d.view_scope, d.is_head, d.active AS department_active
       FROM users u JOIN departments d ON d.id = u.department_id
      WHERE u.id = $1`,
    [userId]
  )
  const row = rows[0]
  if (!row) return null
  return {
    id: row.id,
    email: row.email,
    full_name: row.full_name,
    role: row.role,
    active: row.user_active,
    department_id: row.department_id,
    department: {
      id: row.department_id,
      code: row.department_code,
      name: row.department_name,
      view_scope: row.view_scope,
      is_head: row.is_head,
      active: row.department_active,
    },
  }
}

// ── Department scope ────────────────────────────────────────────────
// Returns null for "no filter — every department", otherwise an array of
// department IDs that make up the actor's universe (own + overseen).
async function getScopeDepartmentIds(actor) {
  if (actor.role === 'super_admin' || actor.department.view_scope === 'all') return null
  if (actor.department.view_scope === 'own') return [actor.department_id]

  // 'selected' — own department plus explicitly overseen targets
  const { rows } = await pool.query(
    'SELECT target_department_id FROM department_oversight WHERE viewer_department_id = $1',
    [actor.department_id]
  )
  return [actor.department_id, ...rows.map(r => r.target_department_id)]
}

// ── Visible sites ────────────────────────────────────────────────────
// Returns { allSites: boolean, siteIds: string[] | null, sites: [{id, department_id, department_code}] }
// allSites/siteIds=null means "no filter". Operators are narrowed to their
// granted subset of the department universe.
async function getVisibleSites(actor) {
  const scopeDeptIds = await getScopeDepartmentIds(actor)

  const baseQuery = scopeDeptIds === null
    ? pool.query(
        `SELECT s.id, s.department_id, d.code AS department_code
           FROM sites s JOIN departments d ON d.id = s.department_id`
      )
    : pool.query(
        `SELECT s.id, s.department_id, d.code AS department_code
           FROM sites s JOIN departments d ON d.id = s.department_id
          WHERE s.department_id = ANY($1)`,
        [scopeDeptIds]
      )

  const { rows } = await baseQuery

  if (actor.role !== 'operator') {
    return { allSites: scopeDeptIds === null, siteIds: scopeDeptIds === null ? null : rows.map(r => r.id), sites: rows }
  }

  // Operator: narrow the universe to explicit grants
  const { rows: grantRows } = await pool.query(
    'SELECT site_id FROM site_visibility_grants WHERE user_id = $1',
    [actor.id]
  )
  const granted = new Set(grantRows.map(r => r.site_id))
  const narrowed = rows.filter(r => granted.has(r.id))
  return { allSites: false, siteIds: narrowed.map(r => r.id), sites: narrowed }
}

// Convenience wrapper — returns null for "no filter" or an array of site IDs.
async function getVisibleSiteIds(actor) {
  const { allSites, siteIds } = await getVisibleSites(actor)
  return allSites ? null : siteIds
}

// ── Visible receivers ────────────────────────────────────────────────
// Receiver visibility is department-scoped only (no per-user grants) —
// operators don't manage routing, so they get the same set as their
// department's admin/supervisor.
async function getVisibleReceiverIds(actor) {
  const scopeDeptIds = await getScopeDepartmentIds(actor)
  if (scopeDeptIds === null) return null
  const { rows } = await pool.query(
    'SELECT id FROM hq_receivers WHERE department_id = ANY($1)',
    [scopeDeptIds]
  )
  return rows.map(r => r.id)
}

// ── Management checks (own department only, except super_admin) ────
async function canManageSite(actor, siteId) {
  if (actor.role === 'super_admin') return true
  if (actor.role !== 'dept_admin') return false
  const { rows } = await pool.query('SELECT department_id FROM sites WHERE id = $1', [siteId])
  return rows[0]?.department_id === actor.department_id
}

async function canManageReceiver(actor, receiverId) {
  if (actor.role === 'super_admin') return true
  if (actor.role !== 'dept_admin') return false
  const { rows } = await pool.query('SELECT department_id FROM hq_receivers WHERE id = $1', [receiverId])
  return rows[0]?.department_id === actor.department_id
}

async function canManageCamera(actor, cameraId) {
  if (actor.role === 'super_admin') return true
  if (actor.role !== 'dept_admin') return false
  const { rows } = await pool.query(
    `SELECT s.department_id FROM cameras c JOIN sites s ON s.id = c.site_id WHERE c.id = $1`,
    [cameraId]
  )
  return rows[0]?.department_id === actor.department_id
}

// A dept_admin may only manage users in their own department, and never
// super_admins. A user may never manage themselves via these admin routes
// (self-role-change / self-delete / self-deactivate) — callers should
// check that separately since it applies even to super_admin.
async function canManageUser(actor, targetUser) {
  if (actor.role === 'super_admin') return true
  if (actor.role !== 'dept_admin') return false
  if (targetUser.role === 'super_admin') return false
  return targetUser.department_id === actor.department_id
}

// A route may be created between a site and receiver only if both belong
// to the actor's own department, unless the actor is super_admin (who may
// route across departments).
async function canRoute(actor, siteId, receiverId) {
  if (actor.role === 'super_admin') return true
  if (actor.role !== 'dept_admin') return false
  const { rows } = await pool.query(
    `SELECT
       (SELECT department_id FROM sites WHERE id = $1)        AS site_dept,
       (SELECT department_id FROM hq_receivers WHERE id = $2) AS receiver_dept`,
    [siteId, receiverId]
  )
  const row = rows[0]
  return row?.site_dept === actor.department_id && row?.receiver_dept === actor.department_id
}

module.exports = {
  loadActor,
  getScopeDepartmentIds,
  getVisibleSites,
  getVisibleSiteIds,
  getVisibleReceiverIds,
  canManageSite,
  canManageReceiver,
  canManageCamera,
  canManageUser,
  canRoute,
}
