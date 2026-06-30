require('dotenv').config()
const express = require('express')
const cors    = require('cors')
const path    = require('path')
const fs      = require('fs')

const authRouter    = require('./routes/auth')
const adminRouter   = require('./routes/admin')
const cameraRouter  = require('./routes/cameras')
const streamRouter  = require('./routes/streams')
const { startAlertRouter }     = require('./services/alertRouter')
const { syncRoutingToFirebase } = require('./services/routingSync')

const app  = express()
const PORT = process.env.PORT || 3001

// Ensure HLS segments directory exists
const STREAMS_DIR = path.join(__dirname, 'streams')
if (!fs.existsSync(STREAMS_DIR)) fs.mkdirSync(STREAMS_DIR, { recursive: true })

app.use(cors())
app.use(express.json())

// Serve HLS segments — no auth needed (segments are ephemeral, URL is unguessable in prod)
app.use('/streams', express.static(STREAMS_DIR, { maxAge: 0 }))

app.use('/api/auth',    authRouter)
app.use('/api/admin',   adminRouter)
app.use('/api/cameras', cameraRouter)
app.use('/api/streams', streamRouter)

app.get('/api/health', (_req, res) => res.json({ status: 'ok', streams: require('./services/streamManager').activeCount() }))

app.listen(PORT, async () => {
  console.log(`Falcon Eye API running on http://localhost:${PORT}`)
  startAlertRouter()
  // Ensure Firebase routing node matches PostgreSQL on every restart
  try {
    await syncRoutingToFirebase()
  } catch (err) {
    console.warn('[Startup] Routing sync skipped (DB may not be ready):', err.message)
  }
})
