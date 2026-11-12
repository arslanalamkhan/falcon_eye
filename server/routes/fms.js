// Remote satellite-terminal commands (FMS): alarm reset, position poll, test mode.
// Business logic lives in services/fmsCommands.js.
const express = require('express')
const { requireAuth, superOnly } = require('../middleware/auth')
const { getVisibleSiteIds, canManageSite } = require('../services/access')
const { fmsBudget } = require('../services/fmsClient')
const cmds = require('../services/fmsCommands')

const router = express.Router()
router.use(requireAuth)

// Map service/client errors to HTTP. Unknown errors are 500.
function sendError(res, err) {
  if (err instanceof cmds.CommandError) return res.status(err.status).json({ error: err.message })
  if (cmds.isFmsApiError(err)) {
    if (err.kind === 'rate_limit') {
      const retry = Math.max(1, Math.ceil((fmsBudget.retryAfterMs() || 0) / 1000))
      return res.status(429).json({ error: err.message, retry_after_s: retry })
    }
    if (err.kind === 'busy') return res.status(409).json({ error: err.message })
    return res.status(502).json({ error: err.message })
  }
  console.error('[FMS] Command route error:', err.message)
  return res.status(500).json({ error: 'Server error' })
}

// Not visible looks exactly like not existing.
async function requireVisibleSite(req, res, next) {
  try {
    const visible = await getVisibleSiteIds(req.user)
    if (visible !== null && !visible.includes(req.params.siteId)) {
      return res.status(404).json({ error: 'Satellite site not found' })
    }
    next()
  } catch (err) {
    sendError(res, err)
  }
}

router.get('/sites/:siteId/commands', requireVisibleSite, async (req, res) => {
  try {
    res.json(await cmds.listSiteCommands(req.params.siteId))
  } catch (err) {
    sendError(res, err)
  }
})

router.post('/sites/:siteId/reset', requireVisibleSite, async (req, res) => {
  try {
    res.status(202).json(await cmds.requestReset(req.user, req.params.siteId))
  } catch (err) {
    sendError(res, err)
  }
})

router.post('/sites/:siteId/poll-position', requireVisibleSite, async (req, res) => {
  try {
    if (!(await canManageSite(req.user, req.params.siteId))) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    res.status(202).json(await cmds.requestPositionPoll(req.user, req.params.siteId))
  } catch (err) {
    sendError(res, err)
  }
})

router.post('/sites/:siteId/test-mode', superOnly, async (req, res) => {
  try {
    const enabled = req.body?.enabled
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled must be true or false' })
    }
    res.json(await cmds.setTestMode(req.user, req.params.siteId, enabled))
  } catch (err) {
    sendError(res, err)
  }
})

module.exports = router
