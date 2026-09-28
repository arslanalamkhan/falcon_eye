// Preview (default) or apply the FMS alert-data repair.
// The server also runs this automatically on start, so you normally only
// need it to see what would change.
//
// Usage:
//   node server/scripts/fms_reconcile.js           # dry run — prints changes
//   node server/scripts/fms_reconcile.js --apply   # writes them to Firebase
require('dotenv').config({ quiet: true })
const pool = require('../db')
const { getFirebaseDb } = require('../services/firebase')
const { reconcileAlertHistory } = require('../services/fmsReconcile')

const apply = process.argv.includes('--apply')

;(async () => {
  const staleMs = (Number(process.env.FMS_STALE_AFTER_MIN) || 60) * 60_000
  const changes = await reconcileAlertHistory(getFirebaseDb(), { apply, staleMs })

  if (changes.length === 0) {
    console.log('Nothing to reconcile — FMS alert data is consistent.')
  } else {
    console.log(`${apply ? 'Applied' : 'Would apply'} ${changes.length} change(s):\n`)
    for (const c of changes) {
      console.log(`  [${c.site}] ${c.path}`)
      console.log(`      ${c.from} → ${c.to}   (${c.why})`)
    }
    if (!apply) console.log('\nRe-run with --apply to write these changes.')
  }
  await pool.end()
  process.exit(0)
})().catch((err) => {
  console.error('Reconcile failed:', err.message)
  process.exit(1)
})
