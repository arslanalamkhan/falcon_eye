require('dotenv').config()
const express = require('express')
const cors = require('cors')

const authRouter = require('./routes/auth')

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors({ origin: 'http://localhost:5173', credentials: true }))
app.use(express.json())

app.use('/api/auth', authRouter)

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))

app.listen(PORT, () => {
  console.log(`Falcon Eye API running on http://localhost:${PORT}`)
})
