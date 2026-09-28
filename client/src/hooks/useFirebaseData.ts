import { useEffect, useState, useMemo } from "react"
import { ref, onValue, get, query, orderByKey, limitToLast } from "firebase/database"
import { db } from "@/lib/firebase"
import { useAuth } from "@/contexts/AuthContext"

export type SiteData = {
  id: string
  label: string
  alert: boolean
  status: string
  last_alert: string
  department_code?: string
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

  // Visible site set comes from the department access model (see
  // GET /api/auth/me), loaded once at login by AuthContext — not a
  // separate Firebase-read-only call.
  const { access } = useAuth()

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

  const isVisible = useMemo(() => {
    if (!access) return () => false
    if (access.allSites) return () => true
    const set = new Set(access.siteIds ?? [])
    return (siteId: string) => set.has(siteId)
  }, [access])

  // department_code lookup, so pages can group/filter by department without
  // a second round-trip — access.sites already carries it from GET /me.
  const deptCodeBySite = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of access?.sites ?? []) map.set(s.id, s.department_code)
    return map
  }, [access])

  const sites = useMemo(
    () => Object.values(sitesMap)
      .filter((s) => isVisible(s.id))
      .map((s) => ({ ...s, department_code: deptCodeBySite.get(s.id) })),
    [sitesMap, isVisible, deptCodeBySite]
  )

  // Distinct department codes among visible sites — pages use this to
  // decide whether a department filter is worth showing at all.
  const departmentCodes = useMemo(
    () => [...new Set(sites.map((s) => s.department_code).filter((c): c is string => !!c))].sort(),
    [sites]
  )

  const recentAlerts = useMemo<AlertEntry[]>(() => {
    const activeSites = new Set(
      Object.entries(sitesMap)
        .filter(([, s]) => s.alert)
        .map(([id]) => id)
    )

    const sorted = [...todayAlerts, ...pastAlerts]
      .filter((a) => isVisible(a.site_id))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    const seenSites = new Set<string>()
    return sorted.slice(0, 20).map((a) => {
      const isLatest = !seenSites.has(a.site_id)
      seenSites.add(a.site_id)
      const alertStatus: "active" | "resolved" =
        isLatest && activeSites.has(a.site_id) ? "active" : "resolved"
      return { ...a, alertStatus }
    })
  }, [todayAlerts, pastAlerts, sitesMap, isVisible])

  const activeAlertCount = sites.filter((s) => s.alert).length

  return { sites, recentAlerts, activeAlertCount, departmentCodes }
}
