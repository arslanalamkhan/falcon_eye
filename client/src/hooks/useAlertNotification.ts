import { useState, useEffect, useRef, useMemo } from "react"
import { ref, onValue } from "firebase/database"
import { db } from "@/lib/firebase"
import { useAuth } from "@/contexts/AuthContext"
import type { SiteSource } from "@/types/access"

export type AlertEvent = {
  siteId:     string
  siteLabel:  string
  department?: string
  source?:    SiteSource
  lat?:       string
  lng?:       string
  gpsStatus?: string
  speed?:     string
  triggeredAt: string
}

/**
 * Watches visible sites for panic alerts.
 * - `activeAlerts`: every visible site currently in alert (drives the bell,
 *   nav badges and the tab title).
 * - `activeAlert` / `dismiss`: a queue of *newly seen* alerts for the
 *   full-screen popup — each alert cycle pops up once per session.
 */
export function useAlertNotification() {
  const [queue, setQueue]               = useState<AlertEvent[]>([])
  const [activeAlerts, setActiveAlerts] = useState<AlertEvent[]>([])
  // Sites whose current alert cycle we've already queued a popup for
  const notified = useRef<Set<string>>(new Set())
  const { access } = useAuth()

  const siteMeta = useMemo(() => {
    const map = new Map<string, { label: string; department: string; source: SiteSource }>()
    for (const s of access?.sites ?? []) map.set(s.id, { label: s.label, department: s.department_code, source: s.source })
    return map
  }, [access])

  useEffect(() => {
    // Wait for access rather than notifying on sites we may not be allowed to see
    if (!access) return
    const isVisible = access.allSites ? () => true : (id: string) => siteMeta.has(id)

    return onValue(ref(db, "sites"), (snap) => {
      const nowActive: AlertEvent[] = []
      const fresh: AlertEvent[] = []

      snap.forEach((child) => {
        const id = child.key as string
        if (!isVisible(id)) return
        const site = child.val()
        if (site?.alert !== "true") {
          // Alert cleared — allow a future alert on this site to pop up again
          notified.current.delete(id)
          return
        }
        const meta = siteMeta.get(id)
        const event: AlertEvent = {
          siteId:      id,
          siteLabel:   meta?.label ?? site.label ?? id,
          department:  meta?.department,
        source:      meta?.source,
          lat:         site.gps?.lat,
          lng:         site.gps?.lng,
          gpsStatus:   site.gps?.status,
          speed:       site.gps?.speed_kmh,
          triggeredAt: site.last_alert || new Date().toISOString(),
        }
        nowActive.push(event)
        if (!notified.current.has(id)) {
          notified.current.add(id)
          fresh.push(event)
        }
      })

      nowActive.sort((a, b) => b.triggeredAt.localeCompare(a.triggeredAt))
      setActiveAlerts(nowActive)
      if (fresh.length) setQueue((prev) => [...prev, ...fresh])
      // Drop queued popups for alerts that have since been reset at the receiver
      setQueue((prev) => prev.filter((q) => nowActive.some((a) => a.siteId === q.siteId)))
    })
  }, [access, siteMeta])

  const dismiss = () => setQueue((prev) => prev.slice(1))

  return { activeAlert: queue[0] ?? null, queueLength: queue.length, dismiss, activeAlerts }
}
