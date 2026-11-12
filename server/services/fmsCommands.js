// Remote commands to Falcon Mega Track satellite terminals: SSAS alarm reset,
// position poll, SSAS test mode. See fmsClient.js for the API wrapper.
//
// reset / poll_position are asynchronous on FMS's side: the API returns a
// ForwardMessageID and the message is delivered to the terminal over the
// satellite link (typically 1-3 min). We store a 'pending' row and a
// DB-driven tracker polls GetForwardMessageStatus until a final status or the
// deadline. Being DB-driven, it survives server restarts.
//
// When a reset completes we write the same Firebase fields a terminal-side
// reset would (alert=false, status=standby) so alertRouter silences the
// routed receivers with no changes of its own.
const pool = require('../db')
const { getFirebaseDb } = require('./firebase')
const { audit } = require('./audit')
const fmsClient = require('./fmsClient')

const TRACK_INTERVAL_MS = 30_000

// Injectable for tests
const deps = { pool, getFirebaseDb, audit, client: fmsClient, now: () => Date.now() }

class CommandError extends Error {
  constructor(status, message) {
    super(message)
    this.name = 'CommandError'
    this.status = status
  }
}

function isFmsApiError(err) {
  return !!err && (err.name === 'FmsApiError' || (typeof err.kind === 'string' && err.fmsCode !== undefined))
}

function commandTimeoutMs() {
  return Number(process.env.FMS_COMMAND_TIMEOUT_MS) || 180_000
}

// ── Pure helpers ─────────────────────────────────────────────────────
const FINAL_FAILED = new Set(['ERROR', 'DELIVERY_FAILED', 'TIMED_OUT', 'CANCELLED', 'NA'])

// ForwardMessageStatus name → what the command should do next.
function outcomeForForwardStatus(name) {
  if (name === 'RECEIVED') return 'completed'
  if (name && FINAL_FAILED.has(name)) return 'failed'
  return 'pending' // SUBMITTED, WAITING, TRANSMITTED, unknown/null
}

const STATUS_DESCRIPTIONS = {
  RECEIVED: 'Delivered to terminal',
  ERROR: 'The satellite network reported an error delivering the command',
  DELIVERY_FAILED: 'The satellite network could not deliver the command to the terminal',
  TIMED_OUT: 'The satellite network timed out delivering the command',
  CANCELLED: 'The command was cancelled before delivery',
  NA: 'The satellite network reported the command as not applicable to this terminal',
}

function describeForwardStatus(name) {
  return STATUS_DESCRIPTIONS[name] || 'Waiting for the terminal to confirm'
}

const TIMEOUT_DESCRIPTIONS = {
  reset: 'Terminal did not confirm within 3 minutes — the alarm clears automatically if the terminal acknowledges',
  poll_position: 'Terminal did not confirm within 3 minutes — a position report will still arrive if the terminal receives the request',
}

// The single Firebase multi-path update applied when a remote reset lands.
function buildResetUpdate({ siteId, commandId, siteLabel, gps, nowIso }) {
  const date = nowIso.slice(0, 10)
  const g = gps || {}
  return {
    [`sites/${siteId}/alert`]: 'false',
    [`sites/${siteId}/status`]: 'standby',
    [`sites/${siteId}/fms_reset_at`]: nowIso,
    [`logs/${date}/fmsreset_${commandId}`]: {
      site_id: siteId,
      site_label: siteLabel || siteId,
      event: 'reset_remote',
      timestamp: nowIso,
      lat: g.lat != null ? String(g.lat) : '',
      lng: g.lng != null ? String(g.lng) : '',
      gps_status: g.status != null ? String(g.status) : '',
    },
  }
}

function iso(v) {
  return v == null ? null : new Date(v).toISOString()
}

function serializeCommand(row) {
  return {
    id: Number(row.id),
    site_id: row.site_id,
    kind: row.kind,
    status: row.status,
    forward_message_id: row.forward_message_id != null ? Number(row.forward_message_id) : null,
    forward_status: row.forward_status ?? null,
    error_code: row.error_code ?? null,
    description: row.description ?? null,
    requested_by_name: row.requested_by_name ?? null,
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
    completed_at: iso(row.completed_at),
  }
}

// What the tracker should do with one pending row, given the latest FMS
// status (or null when it could not be fetched). null = leave it pending.
function decideTransition(row, forwardStatus, nowMs, timeoutMs) {
  const expired = nowMs - new Date(row.created_at).getTime() >= timeoutMs
  if (forwardStatus) {
    const outcome = outcomeForForwardStatus(forwardStatus)
    if (outcome === 'completed') return { status: 'completed', description: describeForwardStatus(forwardStatus) }
    if (outcome === 'failed') return { status: 'failed', description: describeForwardStatus(forwardStatus) }
  }
  if (expired) return { status: 'timed_out', description: TIMEOUT_DESCRIPTIONS[row.kind] || 'Terminal did not confirm in time' }
  return null
}

// ── DB helpers ───────────────────────────────────────────────────────
const COMMAND_SELECT = `
  SELECT c.*, u.full_name AS requested_by_name
    FROM fms_commands c LEFT JOIN users u ON u.id = c.requested_by`

async function getCommand(id) {
  const { rows } = await deps.pool.query(`${COMMAND_SELECT} WHERE c.id = $1`, [id])
  return rows[0] ? serializeCommand(rows[0]) : null
}

async function lookupSatelliteSite(siteId) {
  const { rows } = await deps.pool.query(
    `SELECT s.id, s.label, s.source, fa.mobile_id, fa.test_mode
       FROM sites s LEFT JOIN fms_assets fa ON fa.site_id = s.id
      WHERE s.id = $1`,
    [siteId]
  )
  const row = rows[0]
  if (!row || row.source !== 'satellite_fms' || !row.mobile_id) {
    throw new CommandError(404, 'Satellite site not found')
  }
  return row
}

async function assertNoPending(siteId, kind, label) {
  const { rows } = await deps.pool.query(
    "SELECT 1 FROM fms_commands WHERE site_id = $1 AND kind = $2 AND status = 'pending' LIMIT 1",
    [siteId, kind]
  )
  if (rows.length > 0) throw new CommandError(409, `A ${label} is already in progress for this site`)
}

async function insertCommand({ siteId, mobileId, kind, status, forwardMessageId = null, errorCode = null, description, actor }) {
  const { rows } = await deps.pool.query(
    `INSERT INTO fms_commands
       (site_id, mobile_id, kind, status, forward_message_id, error_code, description, requested_by, completed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CASE WHEN $4 = 'pending' THEN NULL ELSE NOW() END)
     RETURNING id`,
    [siteId, mobileId, kind, status, forwardMessageId, errorCode, description, actor?.id ?? null]
  )
  return rows[0].id
}

// Record a request-time API failure, then rethrow it for the route.
// Our own budget running dry (fmsCode 429) is not a command — no row.
async function failRequest(actor, site, kind, err) {
  if (isFmsApiError(err) && !(err.kind === 'rate_limit' && err.fmsCode === 429)) {
    const commandId = await insertCommand({
      siteId: site.id, mobileId: site.mobile_id, kind, status: 'failed',
      errorCode: String(err.fmsCode ?? ''), description: err.message, actor,
    })
    await deps.audit(actor, `fms.${kind}`, 'site', site.id, { commandId, mobileId: site.mobile_id, outcome: 'failed' })
  }
  throw err
}

// ── Public API ───────────────────────────────────────────────────────
async function requestAsync(actor, siteId, kind, label, call) {
  const site = await lookupSatelliteSite(siteId)
  await assertNoPending(siteId, kind, label)
  let result
  try {
    result = await call(site.mobile_id)
  } catch (err) {
    return failRequest(actor, site, kind, err)
  }
  const commandId = await insertCommand({
    siteId, mobileId: site.mobile_id, kind, status: 'pending',
    forwardMessageId: result.forwardMessageId ?? null,
    description: result.description || 'Sent to the satellite network — waiting for the terminal to confirm',
    actor,
  })
  await deps.audit(actor, `fms.${kind}`, 'site', siteId, { commandId, mobileId: site.mobile_id, outcome: 'pending' })
  return { command: await getCommand(commandId) }
}

async function siteInAlert(siteId) {
  const snap = await deps.getFirebaseDb().ref(`sites/${siteId}/alert`).get()
  return snap.val() === 'true'
}

async function requestReset(actor, siteId) {
  if (actor.role !== 'super_admin') {
    await lookupSatelliteSite(siteId) // 404 before 409
    if (!(await siteInAlert(siteId))) throw new CommandError(409, 'This site has no active alarm')
  }
  return requestAsync(actor, siteId, 'reset', 'reset', (mobileId) =>
    deps.client.resetSsasToNormal(mobileId, { priority: 'command' }))
}

async function requestPositionPoll(actor, siteId) {
  return requestAsync(actor, siteId, 'poll_position', 'position request', (mobileId) =>
    deps.client.pollCurrentPosition(mobileId, { priority: 'command' }))
}

async function setTestMode(actor, siteId, enabled) {
  const site = await lookupSatelliteSite(siteId)
  const kind = enabled ? 'test_mode_on' : 'test_mode_off'
  let result
  try {
    result = await deps.client.setSsasTestMode(site.mobile_id, enabled, { priority: 'command' })
  } catch (err) {
    return failRequest(actor, site, kind, err)
  }
  const commandId = await insertCommand({
    siteId, mobileId: site.mobile_id, kind, status: 'completed',
    description: result?.description || (enabled ? 'SSAS test mode switched on' : 'SSAS test mode switched off'),
    actor,
  })
  await deps.pool.query(
    'UPDATE fms_assets SET test_mode = $2, test_mode_changed_at = NOW() WHERE site_id = $1',
    [siteId, enabled]
  )
  await deps.audit(actor, `fms.${kind}`, 'site', siteId, { commandId, mobileId: site.mobile_id, outcome: 'completed' })
  return { command: await getCommand(commandId), test_mode: enabled }
}

async function listSiteCommands(siteId) {
  const site = await lookupSatelliteSite(siteId)
  const { rows } = await deps.pool.query(
    `${COMMAND_SELECT}
      WHERE c.site_id = $1 AND c.created_at > NOW() - INTERVAL '24 hours'
      ORDER BY c.created_at DESC, c.id DESC
      LIMIT 20`,
    [siteId]
  )
  return {
    site_id: siteId,
    mobile_id: site.mobile_id,
    test_mode: !!site.test_mode,
    commands: rows.map(serializeCommand),
  }
}

// ── Tracker ──────────────────────────────────────────────────────────
// Only moves a row that is still pending, so two passes can never both win.
async function finishCommand(row, transition) {
  const { rows } = await deps.pool.query(
    `UPDATE fms_commands
        SET status = $2, description = $3, forward_status = COALESCE($4, forward_status),
            updated_at = NOW(), completed_at = NOW()
      WHERE id = $1 AND status = 'pending'
      RETURNING id`,
    [row.id, transition.status, transition.description, transition.forwardStatus ?? null]
  )
  return rows.length > 0
}

async function auditResetOutcome(row, transition) {
  await deps.audit(null, transition.status === 'completed' ? 'fms.reset.completed' : 'fms.reset.failed',
    'site', row.site_id, { commandId: Number(row.id), mobileId: row.mobile_id, outcome: transition.status })
}

async function applyResetToFirebase(row) {
  const rtdb = deps.getFirebaseDb()
  const site = (await rtdb.ref(`sites/${row.site_id}`).get()).val() || {}
  const update = buildResetUpdate({
    siteId: row.site_id,
    commandId: row.id,
    siteLabel: site.label || row.site_label,
    gps: site.gps,
    nowIso: new Date(deps.now()).toISOString(),
  })
  await rtdb.ref().update(update)
}

async function trackOne(row, timeoutMs) {
  let forwardStatus = null
  let budgetShort = false
  try {
    const res = await deps.client.getForwardMessageStatus(row.mobile_id, row.forward_message_id, { priority: 'status' })
    forwardStatus = res?.status ?? null
  } catch (err) {
    if (isFmsApiError(err) && err.kind === 'rate_limit') budgetShort = true
    else console.warn(`[FMS] Status check failed for command ${row.id}: ${err.message}`)
  }

  const transition = decideTransition(row, forwardStatus, deps.now(), timeoutMs)
  if (!transition) {
    if (forwardStatus) {
      await deps.pool.query(
        "UPDATE fms_commands SET forward_status = $2, updated_at = NOW() WHERE id = $1 AND status = 'pending'",
        [row.id, forwardStatus]
      )
    }
    return { budgetShort }
  }
  transition.forwardStatus = forwardStatus

  if (row.kind === 'reset' && transition.status === 'completed') {
    try {
      await applyResetToFirebase(row)
    } catch (err) {
      // Stay pending and retry next pass; if the deadline has passed, give up.
      console.error(`[FMS] Reset ${row.id} delivered but Firebase update failed:`, err.message)
      if (decideTransition(row, null, deps.now(), timeoutMs)) {
        await finishCommand(row, {
          status: 'timed_out', forwardStatus,
          description: 'Delivered to terminal, but updating the alarm state failed — it clears when the terminal acknowledges',
        })
      }
      return { budgetShort }
    }
  }

  if ((await finishCommand(row, transition)) && row.kind === 'reset') await auditResetOutcome(row, transition)
  return { budgetShort }
}

// One pass over every pending reset / poll command. Returns how many it saw.
async function runTrackerPass() {
  const timeoutMs = commandTimeoutMs()
  const { rows } = await deps.pool.query(
    `SELECT c.*, s.label AS site_label
       FROM fms_commands c JOIN sites s ON s.id = c.site_id
      WHERE c.status = 'pending'
      ORDER BY c.created_at`
  )
  let budgetShort = false
  for (const row of rows) {
    try {
      // The budget said no — stop asking, but still expire overdue rows.
      // Same for a row FMS gave no ForwardMessageID (nothing to ask about):
      // it must not stay pending forever and block the next reset.
      if (budgetShort || row.forward_message_id == null) {
        const t = decideTransition(row, null, deps.now(), timeoutMs)
        if (t && (await finishCommand(row, t)) && row.kind === 'reset') await auditResetOutcome(row, t)
        continue
      }
      const r = await trackOne(row, timeoutMs)
      if (r.budgetShort) budgetShort = true
    } catch (err) {
      console.error(`[FMS] Tracking command ${row.id} failed:`, err.message)
    }
  }
  return rows.length
}

function startFmsCommandTracker() {
  if (!process.env.FMS_API_KEY) {
    console.log('[FMS] FMS_API_KEY not set — remote command tracking disabled')
    return
  }
  const loop = async () => {
    try {
      await runTrackerPass()
    } catch (err) {
      console.error('[FMS] Command tracker pass failed:', err.message)
    }
    setTimeout(loop, TRACK_INTERVAL_MS)
  }
  console.log(`[FMS] Command tracker started — checking pending commands every ${TRACK_INTERVAL_MS / 1000}s`)
  loop()
}

module.exports = {
  CommandError,
  isFmsApiError,
  outcomeForForwardStatus,
  buildResetUpdate,
  serializeCommand,
  decideTransition,
  requestReset,
  requestPositionPoll,
  setTestMode,
  listSiteCommands,
  runTrackerPass,
  startFmsCommandTracker,
  _deps: deps, // test seam
}
