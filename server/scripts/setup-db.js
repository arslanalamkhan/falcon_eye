require('dotenv').config()
const { Client } = require('pg')
const bcrypt = require('bcryptjs')

async function setup() {
  // Connect to postgres (default db) to create falcon_eye if needed
  const adminClient = new Client({
    connectionString: process.env.DATABASE_URL.replace('/falcon_eye', '/postgres'),
  })

  await adminClient.connect()

  const { rows } = await adminClient.query(
    "SELECT 1 FROM pg_database WHERE datname = 'falcon_eye'"
  )

  if (rows.length === 0) {
    await adminClient.query('CREATE DATABASE falcon_eye')
    console.log('✓ Created database: falcon_eye')
  } else {
    console.log('✓ Database falcon_eye already exists')
  }

  await adminClient.end()

  // Now connect to falcon_eye to create tables + seed
  const { Client: Client2 } = require('pg')
  const db = new Client2({ connectionString: process.env.DATABASE_URL })
  await db.connect()

  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id          SERIAL PRIMARY KEY,
      email       TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name   TEXT NOT NULL DEFAULT '',
      role        TEXT NOT NULL DEFAULT 'operator',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  console.log('✓ Table users ready')

  const adminEmail = 'admin@nacta.gov.pk'
  const { rows: existing } = await db.query(
    'SELECT id FROM users WHERE email = $1',
    [adminEmail]
  )

  if (existing.length === 0) {
    const hash = await bcrypt.hash('test123', 10)
    await db.query(
      'INSERT INTO users (email, password_hash, full_name, role) VALUES ($1, $2, $3, $4)',
      [adminEmail, hash, 'System Administrator', 'admin']
    )
    console.log(`✓ Admin user created: ${adminEmail}`)
  } else {
    console.log(`✓ Admin user already exists: ${adminEmail}`)
  }

  await db.end()
  console.log('\nSetup complete. You can now start the server.')
}

setup().catch((err) => {
  console.error('Setup failed:', err.message)
  process.exit(1)
})
