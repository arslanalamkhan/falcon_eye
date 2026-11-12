import { useCallback, useEffect, useMemo, useState } from "react"
import {
  RefreshCw, ScrollText, SearchX, CircleAlert, MapPin, Radio, User, Building2, GitBranch, Video, Activity,
} from "lucide-react"
import { api } from "@/lib/api"
import { cn, errorMessage } from "@/lib/utils"
import { timeAgo, formatDateTime } from "@/lib/format"
import { useNow } from "@/hooks/useNow"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { SearchInput } from "@/components/ui/input"
import { EmptyState } from "@/components/ui/empty-state"
import { DepartmentBadge, PanelSkeleton, PanelToolbar } from "./shared"
import type { AuditEntry } from "./types"

const ENTITY_ICON: Record<string, React.ElementType> = {
  site: MapPin, receiver: Radio, user: User, department: Building2, route: GitBranch, camera: Video,
}

const VERBS: Record<string, string> = {
  create: "Created", delete: "Deleted", update: "Updated", enable: "Enabled", disable: "Disabled",
}

// "user.sites.update" → "Updated site access", "route.enable" → "Enabled route"
function describe(action: string): { text: string; tone: "danger" | "success" | "default" } {
  if (action === "user.sites.update")    return { text: "Updated site access for user", tone: "default" }
  if (action === "user.password_reset")  return { text: "Reset password for user", tone: "default" }
  if (action === "fms.reset")            return { text: "Sent remote alarm reset to site", tone: "default" }
  if (action === "fms.reset.completed")  return { text: "Remote alarm reset delivered to site", tone: "success" }
  if (action === "fms.reset.failed")     return { text: "Remote alarm reset failed for site", tone: "danger" }
  if (action === "fms.poll_position")    return { text: "Requested position from site", tone: "default" }
  if (action === "fms.test_mode_on")     return { text: "Turned SSAS test mode on for site", tone: "default" }
  if (action === "fms.test_mode_off")    return { text: "Turned SSAS test mode off for site", tone: "default" }
  const [entity, verb] = action.split(".")
  const text = `${VERBS[verb] ?? verb ?? "Changed"} ${entity}`
  return { text, tone: verb === "delete" || verb === "disable" ? "danger" : verb === "create" || verb === "enable" ? "success" : "default" }
}

// Prefer a human name stored in the entry's details over a numeric ID
function entityName(e: AuditEntry): string | null {
  const d = e.details
  if (d && typeof d === "object") {
    const rec = d as Record<string, unknown>
    for (const key of ["code", "email", "label"]) {
      if (typeof rec[key] === "string" && rec[key]) return rec[key] as string
    }
  }
  return e.entity_id
}

function dayLabel(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return "Today"
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday"
  return d.toLocaleDateString("en-PK", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
}

export function AuditPanel({ isSuper }: { isSuper: boolean }) {
  const now = useNow()
  const [entries, setEntries]   = useState<AuditEntry[]>([])
  const [loading, setLoading]   = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError]       = useState("")
  const [query, setQuery]       = useState("")

  const load = useCallback(async () => {
    setError("")
    try {
      setEntries(await api.get<AuditEntry[]>("/api/admin/audit?limit=300"))
    } catch (err) {
      setError(errorMessage(err, "Couldn't load the audit log"))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q
      ? entries.filter((e) => [e.action, e.entity_type, e.entity_id, e.actor_name, e.actor_email, e.department_code, describe(e.action).text]
          .some((v) => v?.toLowerCase().includes(q)))
      : entries
    const map = new Map<string, AuditEntry[]>()
    for (const e of filtered) {
      const key = dayLabel(e.created_at)
      map.set(key, [...(map.get(key) ?? []), e])
    }
    return [...map.entries()]
  }, [entries, query])

  if (loading) return <PanelSkeleton />

  return (
    <>
      <PanelToolbar
        actions={
          <Button variant="outline" onClick={() => { setRefreshing(true); load() }} disabled={refreshing}>
            <RefreshCw className={cn(refreshing && "animate-spin")} /> Refresh
          </Button>
        }
      >
        <div className="w-full sm:max-w-xs">
          <SearchInput value={query} onChange={setQuery} placeholder="Search activity…" />
        </div>
        <p className="text-xs text-muted-foreground">{isSuper ? "System-wide activity" : "Your department's activity"}</p>
      </PanelToolbar>

      {error ? (
        <Card><EmptyState icon={CircleAlert} tone="danger" title="Couldn't load activity" description={error} /></Card>
      ) : entries.length === 0 ? (
        <Card><EmptyState icon={ScrollText} title="No activity yet" description="Changes to departments, users, sites, cameras and routing are recorded here." /></Card>
      ) : groups.length === 0 ? (
        <Card><EmptyState icon={SearchX} title="No matching activity" /></Card>
      ) : (
        <div className="space-y-6">
          {groups.map(([day, items]) => (
            <section key={day}>
              <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{day}</h3>
              <Card>
                <ul className="divide-y divide-border">
                  {items.map((e) => {
                    const Icon = ENTITY_ICON[e.entity_type] ?? Activity
                    const d = describe(e.action)
                    return (
                      <li key={e.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                        <div className={cn(
                          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                          d.tone === "danger"  && "border-danger/25 bg-danger/10 text-danger",
                          d.tone === "success" && "border-success/25 bg-success/10 text-success",
                          d.tone === "default" && "border-border bg-muted/60 text-muted-foreground"
                        )}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm">
                            <span className={cn("font-medium", e.actor_id === null ? "italic text-muted-foreground" : "text-foreground")}>
                              {e.actor_name || e.actor_email || "Removed user"}
                            </span>{" "}
                            <span className="text-muted-foreground">{d.text.charAt(0).toLowerCase() + d.text.slice(1)}</span>{" "}
                            {entityName(e) && <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">{entityName(e)}</code>}
                          </p>
                          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <time dateTime={e.created_at} title={formatDateTime(e.created_at)}>{timeAgo(e.created_at, now)}</time>
                            {isSuper && e.department_code && <DepartmentBadge code={e.department_code} />}
                          </p>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </Card>
            </section>
          ))}
        </div>
      )}
    </>
  )
}
