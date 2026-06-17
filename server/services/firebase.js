// Shared Firebase Admin singleton — import this instead of calling initializeApp directly
require('dotenv').config()
const { initializeApp, cert, getApps, getApp } = require('firebase-admin/app')
const { getDatabase } = require('firebase-admin/database')
const path = require('path')

function getFirebaseDb() {
  if (!getApps().length) {
    initializeApp({
      credential:  cert(require(path.join(__dirname, '..', 'falcon-eye-c03a4-firebase-adminsdk-fbsvc-2267d36e35.json'))),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    })
  }
  return getDatabase(getApp())
}

module.exports = { getFirebaseDb }
