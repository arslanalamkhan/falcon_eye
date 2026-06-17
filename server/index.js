require('dotenv').config()
const express = require('express')
const cors    = require('cors')

const authRouter  = require('./routes/auth')
const adminRouter = require('./routes/admin')
const { startAlertRouter }     = require('./services/alertRouter')
const { syncRoutingToFirebase } = require('./services/routingSync')

const app  = express()
const PORT = process.env.PORT || 3001

app.use(cors({ origin: 'http://localhost:5173', credentials: true }))
app.use(express.json())

app.use('/api/auth',  authRouter)
app.use('/api/admin', adminRouter)

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))

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
