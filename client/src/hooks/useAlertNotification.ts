import { useState, useEffect, useRef } from "react"
import { ref, onValue } from "firebase/database"
import { db } from "@/lib/firebase"

export type AlertEvent = {
  siteId:     string
  siteLabel:  string
  lat?:       string
  lng?:       string
  gpsStatus?: string
  speed?:     string
  triggeredAt: string
}

export function useAlertNotification() {
  const [queue, setQueue]       = useState<AlertEvent[]>([])
  // Tracks sites whose current alert cycle we've already notified about
  const notified = useRef<Set<string>>(new Set())

  useEffect(() => {
    const sitesRef = ref(db, 'sites')
    return onValue(sitesRef, (snap) => {
      if (!snap.exists()) return

      snap.forEach((child) => {
        const id   = child.key as string
        const site = child.val()
        const isAlert = site.alert === 'true'

        if (isAlert && !notified.current.has(id)) {
          // New alert (first-load existing OR live transition)
          notified.current.add(id)
          const event: AlertEvent = {
            siteId:      id,
            siteLabel:   site.label  ?? id,
            lat:         site.gps?.lat,
            lng:         site.gps?.lng,
            gpsStatus:   site.gps?.status,
            speed:       site.gps?.speed_kmh,
            triggeredAt: new Date().toISOString(),
          }
          setQueue(prev => [...prev, event])
        }

        if (!isAlert) {
          // Alert cleared — allow future alerts on this site to trigger again
          notified.current.delete(id)
        }
      })
    })
  }, [])

  const dismiss = () => setQueue(prev => prev.slice(1))

  return { activeAlert: queue[0] ?? null, queueLength: queue.length, dismiss }
}
