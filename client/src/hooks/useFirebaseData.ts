import { useEffect, useState, useMemo } from "react"
import { ref, onValue, get, query, orderByKey, limitToLast } from "firebase/database"
import { db } from "@/lib/firebase"

export type SiteData = {
  id: string
  label: string
  alert: boolean
  status: string
  last_alert: string
  gps: {
    lat: string
    lng: string
    status: string
    speed_kmh: string
    updated: string
  }
}

export type AlertEntry = {
  id: string
  site_id: string
  site_label: string
  timestamp: string
  lat?: string
  lng?: string
  gps_status?: string
  alertStatus: "active" | "resolved"
}

type RawAlert = Omit<AlertEntry, "alertStatus">

export type HQData = {
  status: string
  last_seen: string
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0]
}

function parseAlertEntries(data: Record<string, Record<string, unknown>>): RawAlert[] {
  return Object.entries(data)
    .filter(([, v]) => (v as Record<string, unknown>).event === "alert")
    .map(([k, v]) => {
      const entry = v as Record<string, unknown>
      return {
        id: k,
        site_id: entry.site_id as string,
        site_label: entry.site_label as string,
        timestamp: entry.timestamp as string,
        lat: entry.lat as string | undefined,
        lng: entry.lng as string | undefined,
        gps_status: entry.gps_status as string | undefined,
      }
    })
}

export function useFirebaseData() {
  const [sitesMap, setSitesMap] = useState<Record<string, SiteData>>({})
  const [todayAlerts, setTodayAlerts] = useState<RawAlert[]>([])
  const [pastAlerts, setPastAlerts] = useState<RawAlert[]>([])
  const [hq, setHQ] = useState<HQData | null>(null)

  // Live: sites node
  useEffect(() => {
    const r = ref(db, "sites")
    return onValue(r, (snap) => {
      if (!snap.exists()) return
      const data = snap.val() as Record<string, Record<string, unknown>>
      const parsed: Record<string, SiteData> = {}
      for (const [id, v] of Object.entries(data)) {
        parsed[id] = {
          id,
          label: v.label as string,
          alert: v.alert === "true",
          status: v.status as string,
          last_alert: v.last_alert as string,
          gps: v.gps as SiteData["gps"],
        }
      }
      setSitesMap(parsed)
    })
  }, [])

  // Live: HQ node
  useEffect(() => {
    const r = ref(db, "hq")
    return onValue(r, (snap) => {
      if (snap.exists()) setHQ(snap.val() as HQData)
    })
  }, [])

  // Live: today's logs (catches new alerts in real-time)
  useEffect(() => {
    const today = todayStr()
    const r = ref(db, `logs/${today}`)
    return onValue(r, (snap) => {
      if (!snap.exists()) {
        setTodayAlerts([])
        return
      }
      setTodayAlerts(parseAlertEntries(snap.val() as Record<string, Record<string, unknown>>))
    })
  }, [])

  // One-time: past logs (last 90 date-keyed buckets, excludes today)
  useEffect(() => {
    async function fetchPast() {
      const today = todayStr()
      const q = query(ref(db, "logs"), orderByKey(), limitToLast(90))
      const snap = await get(q)
      if (!snap.exists()) return

      const raw = snap.val() as Record<string, Record<string, Record<string, unknown>>>
      const entries: RawAlert[] = []

      for (const [dateKey, dayData] of Object.entries(raw)) {
        // Skip non-date keys (e.g. "sample") and today (covered by the live listener)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || dateKey === today) continue
        entries.push(...parseAlertEntries(dayData))
      }

      setPastAlerts(entries)
    }
    fetchPast()
  }, [])

  const recentAlerts = useMemo<AlertEntry[]>(() => {
    const activeSites = new Set(
      Object.entries(sitesMap)
        .filter(([, s]) => s.alert)
        .map(([id]) => id)
    )

    const sorted = [...todayAlerts, ...pastAlerts].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )

    const seenSites = new Set<string>()
    return sorted.slice(0, 20).map((a) => {
      const isLatest = !seenSites.has(a.site_id)
      seenSites.add(a.site_id)
      const alertStatus: "active" | "resolved" =
        isLatest && activeSites.has(a.site_id) ? "active" : "resolved"
      return { ...a, alertStatus }
    })
  }, [todayAlerts, pastAlerts, sitesMap])

  const sites = Object.values(sitesMap)
  const activeAlertCount = sites.filter((s) => s.alert).length

  return { sites, recentAlerts, hq, activeAlertCount }
}
