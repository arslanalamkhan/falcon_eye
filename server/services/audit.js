// Fire-and-forget audit logging. Never throws — a logging failure must
// never fail the request it's describing.
const pool = require('../db')

// actor: the req.user object from requireAuth (may be null for system actions)
// action: short verb phrase, e.g. 'user.create', 'site.delete', 'route.enable'
// entityType: 'user' | 'site' | 'receiver' | 'camera' | 'route' | 'department'
// entityId: string identifier of the affected entity (site/receiver IDs are text, user/dept IDs are numbers)
// details: any JSON-serialisable extra context
async function audit(actor, action, entityType, entityId, details = null) {
  try {
    await pool.query(
      `INSERT INTO audit_log (actor_id, department_id, action, entity_type, entity_id, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [actor?.id ?? null, actor?.department_id ?? null, action, entityType, entityId != null ? String(entityId) : null, details]
    )
  } catch (err) {
    console.error('[Audit] Failed to write audit log entry:', err.message)
  }
}

module.exports = { audit }
