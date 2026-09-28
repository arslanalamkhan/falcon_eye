import { useMemo, useState } from "react"
import { Check, Loader2, Lock, GitBranch, SearchX, Info } from "lucide-react"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { SearchInput } from "@/components/ui/input"
import { EmptyState } from "@/components/ui/empty-state"
import { pluralize } from "@/lib/format"
import { PanelToolbar } from "./shared"
import type { Site, Receiver, RouteKey } from "./types"
import { rk } from "./types"

type CellProps = { enabled: boolean; busy: boolean; locked: boolean }

export function RoutingMatrix({ sites, receivers, activeRoutes, busyCells, onToggle, isSuper, currentDeptId }: {
  sites: Site[]; receivers: Receiver[]
  activeRoutes: Set<RouteKey>; busyCells: Set<RouteKey>
  onToggle: (siteId: string, receiverId: string) => void
  isSuper: boolean; currentDeptId: number
}) {
  const [query, setQuery]   = useState("")
  const [hoverCol, setHoverCol] = useState<string | null>(null)

  const filteredSites = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? sites.filter((s) => s.label.toLowerCase().includes(q) || s.id.toLowerCase().includes(q)) : sites
  }, [sites, query])

  const cell = (site: Site, r: Receiver): CellProps => {
    const key = rk(site.id, r.id)
    return {
      enabled: activeRoutes.has(key),
      busy: busyCells.has(key),
      locked: !(isSuper || (site.department_id === currentDeptId && r.department_id === currentDeptId)),
    }
  }

  if (sites.length === 0 || receivers.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={GitBranch}
          title={sites.length === 0 ? "No sites to route" : "No receivers to route to"}
          description="Routing connects a site's panic button to the HQ receivers that should buzz. Add sites and receivers first."
        />
      </Card>
    )
  }

  return (
    <>
      <PanelToolbar>
        <div className="w-full sm:max-w-xs">
          <SearchInput value={query} onChange={setQuery} placeholder="Filter sites…" />
        </div>
        <p className="text-xs text-muted-foreground sm:ml-auto">
          <span className="font-medium text-foreground">{pluralize(activeRoutes.size, "active route")}</span> · changes sync to receivers instantly
        </p>
      </PanelToolbar>

      {!isSuper && (
        <p className="mb-3 flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <Info className="mt-px h-3.5 w-3.5 shrink-0" />
          You can route your department's sites to your department's receivers. Cross-department routes, marked <Lock className="mx-0.5 inline h-3 w-3 align-[-2px]" />, are managed by the NACTA super admin.
        </p>
      )}

      {filteredSites.length === 0 ? (
        <Card><EmptyState icon={SearchX} title="No matching sites" /></Card>
      ) : (
        <>
          {/* Desktop matrix */}
          <Card className="hidden overflow-hidden md:block">
            <div className="max-h-[70vh] overflow-auto">
              <table className="w-full border-separate border-spacing-0 text-sm">
                <thead>
                  <tr>
                    <th className="sticky left-0 top-0 z-20 min-w-[14rem] border-b border-r border-border bg-card px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                      Site ↓ &nbsp;/&nbsp; Receiver →
                    </th>
                    {receivers.map((r) => (
                      <th
                        key={r.id}
                        className={cn(
                          "sticky top-0 z-10 min-w-[8.5rem] border-b border-border bg-card px-3 py-3 text-center align-bottom transition-colors",
                          hoverCol === r.id && "bg-accent"
                        )}
                      >
                        <p className="mx-auto max-w-[8rem] truncate text-xs font-semibold text-foreground" title={r.label}>{r.label}</p>
                        <p className="mt-0.5 text-2xs text-muted-foreground">{r.city || "—"} · <span className="font-mono">{r.department_code}</span></p>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredSites.map((site) => (
                    <tr key={site.id} className="group">
                      <th scope="row" className="sticky left-0 z-10 border-b border-r border-border bg-card px-4 py-2.5 text-left font-normal group-hover:bg-accent">
                        <p className="truncate text-sm font-medium text-foreground">{site.label}</p>
                        <p className="truncate font-mono text-2xs text-muted-foreground">{site.id} · {site.department_code}</p>
                      </th>
                      {receivers.map((r) => {
                        const c = cell(site, r)
                        return (
                          <td
                            key={r.id}
                            onMouseEnter={() => setHoverCol(r.id)}
                            onMouseLeave={() => setHoverCol(null)}
                            className={cn("border-b border-border px-3 py-2.5 text-center transition-colors group-hover:bg-accent/40", hoverCol === r.id && "bg-accent/40")}
                          >
                            <RouteToggle {...c} label={`${site.label} → ${r.label}`} onClick={() => onToggle(site.id, r.id)} />
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Legend />
          </Card>

          {/* Mobile: one card per site with receiver chips */}
          <div className="space-y-3 md:hidden">
            {filteredSites.map((site) => {
              const count = receivers.filter((r) => activeRoutes.has(rk(site.id, r.id))).length
              return (
                <Card key={site.id} className="p-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{site.label}</p>
                      <p className="truncate font-mono text-xs text-muted-foreground">{site.id} · {site.department_code}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-2xs font-medium text-muted-foreground">
                      {pluralize(count, "route")}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {receivers.map((r) => {
                      const c = cell(site, r)
                      return (
                        <button
                          key={r.id}
                          type="button"
                          role="switch"
                          aria-checked={c.enabled}
                          disabled={c.busy || c.locked}
                          onClick={() => onToggle(site.id, r.id)}
                          className={cn(
                            "flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                            c.enabled ? "border-success/40 bg-success/15 text-success" : "border-border bg-card text-muted-foreground",
                            c.locked && "opacity-60"
                          )}
                        >
                          {c.busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : c.locked ? <Lock className="h-3 w-3" /> : c.enabled ? <Check className="h-3.5 w-3.5" /> : null}
                          {r.label}
                        </button>
                      )
                    })}
                  </div>
                </Card>
              )
            })}
          </div>
        </>
      )}
    </>
  )
}

function RouteToggle({ enabled, busy, locked, label, onClick }: CellProps & { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={label}
      title={locked ? "Cross-department routes are managed by the super admin" : enabled ? "Route active — click to disable" : "Click to route alerts here"}
      onClick={onClick}
      disabled={busy || locked}
      className={cn(
        "mx-auto flex h-8 w-8 items-center justify-center rounded-lg border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        enabled
          ? "border-success/50 bg-success/20 text-success hover:bg-success/30"
          : "border-dashed border-border text-transparent hover:border-muted-foreground/60 hover:text-muted-foreground",
        busy && "cursor-wait",
        locked && "cursor-not-allowed opacity-50 hover:border-border"
      )}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        : locked && !enabled ? <Lock className="h-3 w-3 text-muted-foreground" />
        : <Check className="h-4 w-4" />}
    </button>
  )
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
      <span className="flex items-center gap-2"><span className="flex h-5 w-5 items-center justify-center rounded border border-success/50 bg-success/20 text-success"><Check className="h-3 w-3" /></span> Routed</span>
      <span className="flex items-center gap-2"><span className="h-5 w-5 rounded border border-dashed border-border" /> Not routed</span>
      <span className="flex items-center gap-2"><Lock className="h-3.5 w-3.5" /> Managed by super admin</span>
    </div>
  )
}
