import { useEffect, useState, useMemo } from "react"
import { ref, onValue, get, query, orderByKey, limitToLast } from "firebase/database"
import { db } from "@/lib/firebase"
import { useAuth } from "@/contexts/AuthContext"
import type { SiteType, SiteSource } from "@/types/access"

export type SiteGps = {
  lat: string
  lng: string
  status: string
  speed_kmh: string
  updated: string
}

export type SiteData = {
  id: string
  label: string
  type?: SiteType
  /** 'satellite_fms' sites have a 15-day position history (map track) */
  source?: SiteSource
  department_code?: string
  /**
   * false when the site is registered (PostgreSQL) but its device has
   * never written to Firebase — shown as "Awaiting first report" rather
   * than silently omitted.
   */
  reported: boolean
  alert: boolean
  status: string
  last_alert: string
  gps?: SiteGps
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
type FirebaseSite = { label?: string; alert: boolean; status: string; last_alert: string; gps?: SiteGps }

function todayStr(): string {
  return new Date().toISOString().split("T")[0]
}

function parseAlertEntries(data: Record<string, Record<string, unknown>>): RawAlert[] {
  return Object.entries(data)
    .filter(([, v]) => v?.event === "alert")
    .map(([k, entry]) => ({
      id: k,
      site_id: entry.site_id as string,
      site_label: entry.site_label as string,
      timestamp: entry.timestamp as string,
      lat: entry.lat as string | undefined,
      lng: entry.lng as string | undefined,
      gps_status: entry.gps_status as string | undefined,
    }))
}

export function useFirebaseData() {
  const [fbSites, setFbSites] = useState<Record<string, FirebaseSite>>({})
  const [fbLoaded, setFbLoaded] = useState(false)
  const [todayAlerts, setTodayAlerts] = useState<RawAlert[]>([])
  const [todayLoaded, setTodayLoaded] = useState(false)
  const [pastAlerts, setPastAlerts] = useState<RawAlert[]>([])
  const [pastLoaded, setPastLoaded] = useState(false)

  // Visible site set comes from the department access model (GET /api/auth/me)
  const { access } = useAuth()

  // Live: sites node
  useEffect(() => {
    return onValue(ref(db, "sites"), (snap) => {
      const data = (snap.exists() ? snap.val() : {}) as Record<string, Record<string, unknown>>
      const parsed: Record<string, FirebaseSite> = {}
      for (const [id, v] of Object.entries(data)) {
        if (!v || typeof v !== "object") continue
        parsed[id] = {
          label: v.label as string | undefined,
          alert: v.alert === "true",
          status: v.status as string,
          last_alert: v.last_alert as string,
          gps: v.gps as SiteGps | undefined,
        }
      }
      setFbSites(parsed)
      setFbLoaded(true)
    }, () => setFbLoaded(true))
  }, [])

  // Live: today's logs (catches new alerts in real-time)
  useEffect(() => {
    return onValue(ref(db, `logs/${todayStr()}`), (snap) => {
      setTodayAlerts(snap.exists() ? parseAlertEntries(snap.val() as Record<string, Record<string, unknown>>) : [])
      setTodayLoaded(true)
    }, () => setTodayLoaded(true))
  }, [])

  // One-time: past logs (last 90 date-keyed buckets, excludes today)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const today = todayStr()
        const snap = await get(query(ref(db, "logs"), orderByKey(), limitToLast(90)))
        if (!snap.exists() || cancelled) return
        const raw = snap.val() as Record<string, Record<string, Record<string, unknown>>>
        const entries: RawAlert[] = []
        for (const [dateKey, dayData] of Object.entries(raw)) {
          // Skip non-date keys (e.g. "sample") and today (covered by the live listener)
          if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || dateKey === today) continue
          entries.push(...parseAlertEntries(dayData))
        }
        setPastAlerts(entries)
      } catch {
        /* history is best-effort — the live feed still works */
      } finally {
        if (!cancelled) setPastLoaded(true)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Merge the access list (PostgreSQL — source of truth for which sites
  // exist and who may see them) with live Firebase state.
  const sites = useMemo<SiteData[]>(() => {
    if (!access) return []
    const merged = new Map<string, SiteData>()

    for (const s of access.sites) {
      const fb = fbSites[s.id]
      merged.set(s.id, {
        id: s.id,
        label: s.label || fb?.label || s.id,
        type: s.type,
        source: s.source,
        department_code: s.department_code,
        reported: !!fb,
        alert: fb?.alert ?? false,
        status: fb?.status ?? "",
        last_alert: fb?.last_alert ?? "",
        gps: fb?.gps,
      })
    }

    // All-sites viewers also see Firebase nodes with no PostgreSQL row
    // (legacy/test devices), exactly as before.
    if (access.allSites) {
      for (const [id, fb] of Object.entries(fbSites)) {
        if (merged.has(id)) continue
        merged.set(id, {
          id,
          label: fb.label || id,
          reported: true,
          alert: fb.alert,
          status: fb.status,
          last_alert: fb.last_alert,
          gps: fb.gps,
        })
      }
    }

    return [...merged.values()].sort((a, b) =>
      Number(b.alert) - Number(a.alert) || a.label.localeCompare(b.label)
    )
  }, [access, fbSites])

  const visibleIds = useMemo(() => new Set(sites.map((s) => s.id)), [sites])

  const recentAlerts = useMemo<AlertEntry[]>(() => {
    const activeSites = new Set(sites.filter((s) => s.alert).map((s) => s.id))
    const sorted = [...todayAlerts, ...pastAlerts]
      .filter((a) => visibleIds.has(a.site_id))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    const seenSites = new Set<string>()
    return sorted.slice(0, 25).map((a) => {
      const isLatest = !seenSites.has(a.site_id)
      seenSites.add(a.site_id)
      return { ...a, alertStatus: isLatest && activeSites.has(a.site_id) ? "active" : "resolved" }
    })
  }, [todayAlerts, pastAlerts, sites, visibleIds])

  // Distinct department codes among visible sites — pages use this to
  // decide whether a department filter is worth showing at all.
  const departmentCodes = useMemo(
    () => [...new Set(sites.map((s) => s.department_code).filter((c): c is string => !!c))].sort(),
    [sites]
  )

  const alertSites = useMemo(() => sites.filter((s) => s.alert), [sites])
  const todayAlertCount = useMemo(
    () => todayAlerts.filter((a) => visibleIds.has(a.site_id)).length,
    [todayAlerts, visibleIds]
  )

  return {
    sites,
    alertSites,
    recentAlerts,
    activeAlertCount: alertSites.length,
    todayAlertCount,
    departmentCodes,
    sitesLoaded: fbLoaded && access !== null,
    alertsLoaded: todayLoaded && pastLoaded,
  }
}
