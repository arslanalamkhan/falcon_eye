import { useEffect, useState } from "react"
import { ref, onValue } from "firebase/database"
import { db } from "@/lib/firebase"

export type ConnectionState = "connecting" | "online" | "offline"

// `.info/connected` reports false until the first handshake completes, so
// a naive check flashes "Offline" on every page load. Treat the first few
// seconds as "connecting" and only report "offline" after that, or after
// a connection that was previously up drops.
const GRACE_MS = 6000

export function useFirebaseConnection(): ConnectionState {
  const [state, setState] = useState<ConnectionState>("connecting")

  useEffect(() => {
    let everConnected = false
    let graceOver = false
    let connected = false

    const timer = setTimeout(() => {
      graceOver = true
      if (!connected) setState("offline")
    }, GRACE_MS)

    const unsubscribe = onValue(ref(db, ".info/connected"), (snap) => {
      connected = snap.val() === true
      if (connected) {
        everConnected = true
        setState("online")
      } else if (everConnected || graceOver) {
        setState("offline")
      }
    })

    return () => { clearTimeout(timer); unsubscribe() }
  }, [])

  return state
}
