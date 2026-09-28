import { useCallback, useEffect, useState } from "react"
import { SatelliteDish, Plus, Siren } from "lucide-react"
import { api } from "@/lib/api"
import { slugify } from "@/lib/utils"
import { timeAgo, pluralize, formatCoords } from "@/lib/format"
import { useNow } from "@/hooks/useNow"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { SitePrefill } from "./AddSiteDialog"
import type { UnregisteredTerminal } from "./types"

/**
 * Super-admin callout: FMS terminals that are reporting but not linked to a
 * site. fmsSync keeps their reports for 15 days and imports them into the
 * site's history as soon as it's registered with the same MobileID.
 * Renders nothing when there are none.
 */
export function UnregisteredTerminals({ onRegister, refreshKey }: {
  onRegister: (prefill: SitePrefill) => void
  /** Bump to re-fetch (e.g. after a site is registered) */
  refreshKey: number
}) {
  const now = useNow()
  const [terminals, setTerminals] = useState<UnregisteredTerminal[]>([])

  const load = useCallback(() => {
    api.get<UnregisteredTerminal[]>("/api/admin/fms/unregistered")
      .then(setTerminals)
      .catch(() => setTerminals([])) // informational only — never block the Sites tab
  }, [])

  useEffect(() => { load() }, [load, refreshKey])

  if (terminals.length === 0) return null
  const alarming = terminals.some((t) => t.alarm_recent)

  return (
    <Card className={alarming ? "mb-4 border-danger/50 shadow-glow-danger" : "mb-4 border-warning/40"}>
      <div className="flex items-start gap-3 border-b border-border px-4 py-3 sm:px-5">
        <div className={alarming
          ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-danger/30 bg-danger/15 text-danger"
          : "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-warning/30 bg-warning/10 text-warning"}
        >
          {alarming ? <Siren className="h-4 w-4" /> : <SatelliteDish className="h-4 w-4" />}
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">
            {pluralize(terminals.length, "unregistered satellite terminal")} reporting
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {alarming
              ? "A terminal is raising a panic alarm but no site is linked to it — it can't reach any receiver until you register it."
              : "These terminals send reports to Falcon Mega Track but aren't linked to a site. Their reports are kept for 15 days and imported when you register them."}
          </p>
        </div>
      </div>
      <ul className="divide-y divide-border">
        {terminals.map((t) => (
          <li key={t.mobile_id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate font-medium">{t.asset_name || "Unnamed terminal"}</p>
                {t.alarm_recent && <Badge variant="danger" size="sm" dot="pulse">Alarm</Badge>}
              </div>
              <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                <span className="font-mono">{t.mobile_id}</span>
                <span>Last report {timeAgo(t.last_seen, now)}</span>
                <span>{pluralize(t.report_count, "report")} waiting</span>
                <span>{formatCoords(t.lat, t.lng)}</span>
              </p>
            </div>
            <Button
              size="sm"
              variant={t.alarm_recent ? "destructive" : "outline"}
              onClick={() => onRegister({
                label: t.asset_name || t.mobile_id,
                id: slugify(t.asset_name || t.mobile_id),
                source: "satellite_fms",
                mobile_id: t.mobile_id,
              })}
            >
              <Plus /> Register
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  )
}
