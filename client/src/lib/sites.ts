// Pure helpers for classifying live site state — shared by the dashboard,
// map and cameras pages (kept out of component files for fast refresh).
import { pluralize } from "@/lib/format"
import type { SiteData } from "@/hooks/useFirebaseData"

export type SiteState = "alert" | "live" | "fallback" | "unreported"

/** Single source of truth for how a site's live state is classified. */
export function siteState(site: SiteData): SiteState {
  if (!site.reported) return "unreported"
  if (site.alert) return "alert"
  return site.gps?.status === "live" ? "live" : "fallback"
}

export function hasCoords(site: SiteData): boolean {
  return !Number.isNaN(parseFloat(site.gps?.lat ?? "")) && !Number.isNaN(parseFloat(site.gps?.lng ?? ""))
}

const TYPE_LABEL = { train: "Train", mine: "Mining site", other: "Site" } as const

export function siteTypeLabel(type: SiteData["type"]): string {
  return TYPE_LABEL[type ?? "other"]
}

/** "12 sites · 1 alert" */
export function sitesSummary(sites: SiteData[]): string {
  const alerts = sites.filter((s) => s.alert).length
  const parts = [pluralize(sites.length, "site")]
  if (alerts) parts.push(pluralize(alerts, "alert"))
  return parts.join(" · ")
}
