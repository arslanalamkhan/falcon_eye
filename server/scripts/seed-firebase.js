// ================================================================
//  Firebase seed script — run once to populate test data
//  Usage: node server/scripts/seed-firebase.js
// ================================================================
require('dotenv').config()
const { initializeApp, cert } = require('firebase-admin/app')
const { getDatabase }         = require('firebase-admin/database')
const path = require('path')

initializeApp({
  credential:  cert(require(path.join(__dirname, '..', 'falcon-eye-c03a4-firebase-adminsdk-fbsvc-2267d36e35.json'))),
  databaseURL: process.env.FIREBASE_DATABASE_URL,
})

const db = getDatabase()
const now = new Date().toISOString().slice(0, 19)

// ── helpers ──────────────────────────────────────────────────────
function ts(dateStr, timeStr) { return `${dateStr}T${timeStr}` }

async function pushLog(date, entry) {
  await db.ref(`logs/${date}`).push({ date, ...entry })
}


// ================================================================
//  SITES  (panic button locations)
// ================================================================
const SITES = {
  jaffer_express: {
    label:      'Jaffer Express',
    alert:      'false',
    reset:      'false',
    status:     'standby',
    last_alert: ts('2026-06-17', '11:36:16'),
    gps: {
      lat:        '30.1575',
      lng:        '71.5249',
      status:     'live',
      speed_kmh:  '87.3',
      satellites: '8',
      updated:    now,
    },
  },
  lahore_express: {
    label:      'Lahore Express',
    alert:      'false',
    reset:      'false',
    status:     'standby',
    last_alert: ts('2026-06-16', '14:22:10'),
    gps: {
      lat:        '27.6703',
      lng:        '68.8966',
      status:     'live',
      speed_kmh:  '102.1',
      satellites: '11',
      updated:    now,
    },
  },
  khyber_mail: {
    label:      'Khyber Mail',
    alert:      'false',
    reset:      'false',
    status:     'standby',
    last_alert: ts('2026-06-15', '09:15:44'),
    gps: {
      lat:        '33.7215',
      lng:        '72.9781',
      status:     'fallback',
      speed_kmh:  '0',
      satellites: '0',
      updated:    now,
    },
  },
  khewra_mine: {
    label:      'Khewra Salt Mine',
    alert:      'false',
    reset:      'false',
    status:     'standby',
    last_alert: ts('2026-06-14', '16:40:02'),
    gps: {
      lat:        '32.6519',
      lng:        '73.0065',
      status:     'live',
      speed_kmh:  '0',
      satellites: '9',
      updated:    now,
    },
  },
  saindak_mine: {
    label:      'Saindak Copper Mine',
    alert:      'false',
    reset:      'false',
    status:     'standby',
    last_alert: ts('2026-06-13', '11:05:33'),
    gps: {
      lat:        '29.5698',
      lng:        '62.3434',
      status:     'live',
      speed_kmh:  '0',
      satellites: '7',
      updated:    now,
    },
  },
}


// ================================================================
//  HQ RECEIVERS  (buzzer box locations)
// ================================================================
const HQ_RECEIVERS = {
  nacta_islamabad: {
    label:              'NACTA HQ Islamabad',
    status:             'online',
    last_seen:          now,
    alert:              'false',
    triggered_by_site:  '',
    triggered_by_label: '',
  },
  fc_quetta: {
    label:              'Frontier Corps HQ Quetta',
    status:             'online',
    last_seen:          now,
    alert:              'false',
    triggered_by_site:  '',
    triggered_by_label: '',
  },
  punjab_police_lahore: {
    label:              'Punjab Police HQ Lahore',
    status:             'online',
    last_seen:          now,
    alert:              'false',
    triggered_by_site:  '',
    triggered_by_label: '',
  },
  rangers_karachi: {
    label:              'Rangers HQ Karachi',
    status:             'online',
    last_seen:          now,
    alert:              'false',
    triggered_by_site:  '',
    triggered_by_label: '',
  },
}


// ================================================================
//  ROUTING  (site → which receivers buzz)
// ================================================================
const ROUTING = {
  jaffer_express:  { nacta_islamabad: true, fc_quetta: true },
  lahore_express:  { nacta_islamabad: true, punjab_police_lahore: true },
  khyber_mail:     { nacta_islamabad: true, punjab_police_lahore: true },
  khewra_mine:     { nacta_islamabad: true, punjab_police_lahore: true },
  saindak_mine:    { nacta_islamabad: true, fc_quetta: true },
}


// ================================================================
//  HQ status
// ================================================================
const HQ = { status: 'online', last_seen: now }


// ================================================================
//  LOGS  (alert history — newest first when displayed)
// ================================================================
const LOG_ENTRIES = [
  // ── 2026-06-17 ─────────────────────────────────────────────────
  {
    date: '2026-06-17', time: '11:36:16',
    site_id: 'jaffer_express', site_label: 'Jaffer Express',
    event: 'alert', lat: '30.1575', lng: '71.5249', gps_status: 'live',
  },
  {
    date: '2026-06-17', time: '11:36:26',
    site_id: 'jaffer_express', site_label: 'Jaffer Express',
    event: 'reset', lat: '30.1575', lng: '71.5249', gps_status: 'live',
  },
  {
    date: '2026-06-17', time: '11:36:28',
    site_id: 'jaffer_express', site_label: 'Jaffer Express',
    event: 'reset_acknowledged', lat: '30.1575', lng: '71.5249', gps_status: 'live',
  },
  {
    date: '2026-06-17', time: '09:02:45',
    site_id: 'lahore_express', site_label: 'Lahore Express',
    event: 'alert', lat: '27.6703', lng: '68.8966', gps_status: 'live',
  },
  {
    date: '2026-06-17', time: '09:03:30',
    site_id: 'lahore_express', site_label: 'Lahore Express',
    event: 'reset', lat: '27.6703', lng: '68.8966', gps_status: 'live',
  },
  {
    date: '2026-06-17', time: '09:03:33',
    site_id: 'lahore_express', site_label: 'Lahore Express',
    event: 'reset_acknowledged', lat: '27.6703', lng: '68.8966', gps_status: 'live',
  },

  // ── 2026-06-16 ─────────────────────────────────────────────────
  {
    date: '2026-06-16', time: '14:22:10',
    site_id: 'lahore_express', site_label: 'Lahore Express',
    event: 'alert', lat: '27.3998', lng: '68.3763', gps_status: 'live',
  },
  {
    date: '2026-06-16', time: '14:22:58',
    site_id: 'lahore_express', site_label: 'Lahore Express',
    event: 'reset', lat: '27.3998', lng: '68.3763', gps_status: 'live',
  },
  {
    date: '2026-06-16', time: '14:23:01',
    site_id: 'lahore_express', site_label: 'Lahore Express',
    event: 'reset_acknowledged', lat: '27.3998', lng: '68.3763', gps_status: 'live',
  },
  {
    date: '2026-06-16', time: '08:47:22',
    site_id: 'khewra_mine', site_label: 'Khewra Salt Mine',
    event: 'alert', lat: '32.6519', lng: '73.0065', gps_status: 'live',
  },
  {
    date: '2026-06-16', time: '08:48:05',
    site_id: 'khewra_mine', site_label: 'Khewra Salt Mine',
    event: 'reset', lat: '32.6519', lng: '73.0065', gps_status: 'live',
  },
  {
    date: '2026-06-16', time: '08:48:08',
    site_id: 'khewra_mine', site_label: 'Khewra Salt Mine',
    event: 'reset_acknowledged', lat: '32.6519', lng: '73.0065', gps_status: 'live',
  },
  {
    date: '2026-06-16', time: '21:15:40',
    site_id: 'jaffer_express', site_label: 'Jaffer Express',
    event: 'alert', lat: '29.5431', lng: '67.8765', gps_status: 'fallback',
  },
  {
    date: '2026-06-16', time: '21:16:10',
    site_id: 'jaffer_express', site_label: 'Jaffer Express',
    event: 'reset', lat: '29.5431', lng: '67.8765', gps_status: 'fallback',
  },
  {
    date: '2026-06-16', time: '21:16:13',
    site_id: 'jaffer_express', site_label: 'Jaffer Express',
    event: 'reset_acknowledged', lat: '29.5431', lng: '67.8765', gps_status: 'fallback',
  },

  // ── 2026-06-15 ─────────────────────────────────────────────────
  {
    date: '2026-06-15', time: '09:15:44',
    site_id: 'khyber_mail', site_label: 'Khyber Mail',
    event: 'alert', lat: '33.7215', lng: '72.9781', gps_status: 'fallback',
  },
  {
    date: '2026-06-15', time: '09:16:30',
    site_id: 'khyber_mail', site_label: 'Khyber Mail',
    event: 'reset', lat: '33.7215', lng: '72.9781', gps_status: 'fallback',
  },
  {
    date: '2026-06-15', time: '09:16:32',
    site_id: 'khyber_mail', site_label: 'Khyber Mail',
    event: 'reset_acknowledged', lat: '33.7215', lng: '72.9781', gps_status: 'fallback',
  },
  {
    date: '2026-06-15', time: '17:44:09',
    site_id: 'saindak_mine', site_label: 'Saindak Copper Mine',
    event: 'alert', lat: '29.5698', lng: '62.3434', gps_status: 'live',
  },
  {
    date: '2026-06-15', time: '17:45:02',
    site_id: 'saindak_mine', site_label: 'Saindak Copper Mine',
    event: 'reset', lat: '29.5698', lng: '62.3434', gps_status: 'live',
  },
  {
    date: '2026-06-15', time: '17:45:05',
    site_id: 'saindak_mine', site_label: 'Saindak Copper Mine',
    event: 'reset_acknowledged', lat: '29.5698', lng: '62.3434', gps_status: 'live',
  },

  // ── 2026-06-14 ─────────────────────────────────────────────────
  {
    date: '2026-06-14', time: '16:40:02',
    site_id: 'khewra_mine', site_label: 'Khewra Salt Mine',
    event: 'alert', lat: '32.6519', lng: '73.0065', gps_status: 'live',
  },
  {
    date: '2026-06-14', time: '16:40:55',
    site_id: 'khewra_mine', site_label: 'Khewra Salt Mine',
    event: 'reset', lat: '32.6519', lng: '73.0065', gps_status: 'live',
  },
  {
    date: '2026-06-14', time: '16:40:58',
    site_id: 'khewra_mine', site_label: 'Khewra Salt Mine',
    event: 'reset_acknowledged', lat: '32.6519', lng: '73.0065', gps_status: 'live',
  },

  // ── 2026-06-13 ─────────────────────────────────────────────────
  {
    date: '2026-06-13', time: '11:05:33',
    site_id: 'saindak_mine', site_label: 'Saindak Copper Mine',
    event: 'alert', lat: '29.5698', lng: '62.3434', gps_status: 'live',
  },
  {
    date: '2026-06-13', time: '11:06:14',
    site_id: 'saindak_mine', site_label: 'Saindak Copper Mine',
    event: 'reset', lat: '29.5698', lng: '62.3434', gps_status: 'live',
  },
  {
    date: '2026-06-13', time: '11:06:17',
    site_id: 'saindak_mine', site_label: 'Saindak Copper Mine',
    event: 'reset_acknowledged', lat: '29.5698', lng: '62.3434', gps_status: 'live',
  },
  {
    date: '2026-06-13', time: '22:30:05',
    site_id: 'jaffer_express', site_label: 'Jaffer Express',
    event: 'alert', lat: '28.9034', lng: '70.0115', gps_status: 'live',
  },
  {
    date: '2026-06-13', time: '22:30:48',
    site_id: 'jaffer_express', site_label: 'Jaffer Express',
    event: 'reset', lat: '28.9034', lng: '70.0115', gps_status: 'live',
  },
  {
    date: '2026-06-13', time: '22:30:51',
    site_id: 'jaffer_express', site_label: 'Jaffer Express',
    event: 'reset_acknowledged', lat: '28.9034', lng: '70.0115', gps_status: 'live',
  },
]


// ================================================================
//  MAIN
// ================================================================
async function seed() {
  console.log('Seeding Firebase database...\n')

  // Main nodes — use set() for clean overwrite
  await db.ref('sites').set(SITES)
  console.log(`✓ sites        — ${Object.keys(SITES).length} entries`)

  await db.ref('hq').set(HQ)
  console.log('✓ hq           — status: online')

  await db.ref('hq_receivers').set(HQ_RECEIVERS)
  console.log(`✓ hq_receivers — ${Object.keys(HQ_RECEIVERS).length} entries`)

  await db.ref('routing').set(ROUTING)
  console.log(`✓ routing      — ${Object.keys(ROUTING).length} site configs`)

  // Logs — use push() so each entry gets a real Firebase key
  await db.ref('logs').remove()
  let logCount = 0
  for (const entry of LOG_ENTRIES) {
    await db.ref(`logs/${entry.date}`).push({
      ...entry,
      timestamp: ts(entry.date, entry.time),
    })
    logCount++
  }
  console.log(`✓ logs         — ${logCount} entries across ${[...new Set(LOG_ENTRIES.map(e => e.date))].length} dates`)

  console.log('\nDone. Firebase is ready.')
  process.exit(0)
}

seed().catch(err => {
  console.error('Seed failed:', err.message)
  process.exit(1)
})
