const admin = require('firebase-admin')
const path = require('path')

let rtdb = null

function initFirebase() {
  if (admin.apps.length) {
    rtdb = admin.database()
    return
  }
  const serviceAccount = require(path.join(__dirname, '..', 'falcon-eye-c03a4-firebase-adminsdk-fbsvc-2267d36e35.json'))
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  })
  rtdb = admin.database()
}

async function dispatchToReceivers(siteId, siteLabel) {
  const routingSnap = await rtdb.ref(`routing/${siteId}`).get()
  if (!routingSnap.exists()) {
    console.log(`[AlertRouter] No routing config for: ${siteId}`)
    return
  }

  const routing = routingSnap.val()
  const receivers = Object.keys(routing).filter((k) => routing[k] === true)
  if (receivers.length === 0) return

  const updates = {}
  for (const receiverId of receivers) {
    updates[`hq_receivers/${receiverId}/alert`]              = 'true'
    updates[`hq_receivers/${receiverId}/triggered_by_site`]  = siteId
    updates[`hq_receivers/${receiverId}/triggered_by_label`] = siteLabel
    updates[`hq_receivers/${receiverId}/last_triggered`]     = new Date().toISOString()
  }

  await rtdb.ref().update(updates)
  console.log(`[AlertRouter] ${siteId} → dispatched to: ${receivers.join(', ')}`)
}

async function clearReceivers(siteId) {
  const routingSnap = await rtdb.ref(`routing/${siteId}`).get()
  if (!routingSnap.exists()) return

  const routing = routingSnap.val()
  const receivers = Object.keys(routing).filter((k) => routing[k] === true)
  if (receivers.length === 0) return

  const updates = {}
  for (const receiverId of receivers) {
    updates[`hq_receivers/${receiverId}/alert`]              = 'false'
    updates[`hq_receivers/${receiverId}/triggered_by_site`]  = ''
    updates[`hq_receivers/${receiverId}/triggered_by_label`] = ''
  }

  await rtdb.ref().update(updates)
  console.log(`[AlertRouter] ${siteId} cleared → silenced: ${receivers.join(', ')}`)
}

function startAlertRouter() {
  try {
    initFirebase()
  } catch (err) {
    console.error('[AlertRouter] Firebase init failed:', err.message)
    return
  }

  // Track previous alert states to detect transitions only (not every heartbeat)
  const prevAlertState = {}

  // Seed initial states on startup so we don't false-trigger on boot
  rtdb.ref('sites').once('value', (snap) => {
    if (!snap.exists()) return
    snap.forEach((child) => {
      prevAlertState[child.key] = child.val().alert === 'true'
    })
    console.log(`[AlertRouter] Watching ${snap.numChildren()} site(s)`)
  })

  // Live listener — fires whenever any child of sites/ changes
  rtdb.ref('sites').on('child_changed', async (snap) => {
    const siteId   = snap.key
    const siteData = snap.val()
    const wasAlert = prevAlertState[siteId] ?? false
    const isAlert  = siteData.alert === 'true'

    // Only act on a state transition, ignore GPS/heartbeat updates
    if (isAlert === wasAlert) return
    prevAlertState[siteId] = isAlert

    if (isAlert) {
      await dispatchToReceivers(siteId, siteData.label || siteId)
    } else {
      await clearReceivers(siteId)
    }
  })

  // Also watch for new sites added dynamically
  rtdb.ref('sites').on('child_added', (snap) => {
    const siteId = snap.key
    if (prevAlertState[siteId] === undefined) {
      prevAlertState[siteId] = snap.val().alert === 'true'
    }
  })
}

module.exports = { startAlertRouter }
