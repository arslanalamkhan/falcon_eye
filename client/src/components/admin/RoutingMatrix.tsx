import { cn } from "@/lib/utils"
import { Train, HardHat, Radio, Check, X, Loader2 } from "lucide-react"
import type { Site, Receiver, RouteKey } from "./types"
import { rk } from "./types"

const SITE_TYPE_ICON = { train: Train, mine: HardHat, other: Radio }
function siteIcon(type: string) {
  const Icon = SITE_TYPE_ICON[type as keyof typeof SITE_TYPE_ICON] ?? Radio
  return <Icon className="h-3.5 w-3.5" />
}

export function RoutingMatrix({ sites, receivers, activeRoutes, busyCells, onToggle, isSuper, currentDeptId }: {
  sites: Site[]; receivers: Receiver[]
  activeRoutes: Set<RouteKey>; busyCells: Set<RouteKey>
  onToggle: (siteId: string, receiverId: string) => void
  isSuper: boolean; currentDeptId: number
}) {
  const activeCount = activeRoutes.size

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Click a cell to enable or disable that route. Changes sync to Firebase immediately.&nbsp;
        <span className="text-foreground font-medium">{activeCount} active route{activeCount !== 1 ? 's' : ''}</span>.
        {!isSuper && <span> You can only route your own department's sites to your own department's receivers.</span>}
      </p>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">

          <thead className="bg-muted/30">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground w-52">
                Site → Receiver
              </th>
              {receivers.map(r => (
                <th key={r.id} className="px-3 py-3 text-center min-w-[130px]">
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-xs font-semibold text-foreground truncate max-w-[120px]">{r.label}</span>
                    <span className="text-[10px] text-muted-foreground">{r.city} · {r.department_code}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-border">
            {sites.map((site, i) => (
              <tr key={site.id} className={i % 2 === 0 ? '' : 'bg-muted/10'}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{siteIcon(site.type)}</span>
                    <div>
                      <p className="text-xs font-medium text-foreground">{site.label}</p>
                      <p className="text-[10px] font-mono text-muted-foreground">{site.id} · {site.department_code}</p>
                    </div>
                  </div>
                </td>

                {receivers.map(r => {
                  const key     = rk(site.id, r.id)
                  const enabled = activeRoutes.has(key)
                  const busy    = busyCells.has(key)
                  const canEdit = isSuper || (site.department_id === currentDeptId && r.department_id === currentDeptId)
                  return (
                    <td key={r.id} className="px-3 py-3 text-center">
                      <button
                        onClick={() => onToggle(site.id, r.id)}
                        disabled={busy || !canEdit}
                        title={!canEdit ? 'Cross-department routing can only be managed by the super admin' : enabled ? 'Click to disable route' : 'Click to enable route'}
                        className={cn(
                          "mx-auto flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all",
                          enabled
                            ? "border-emerald-500 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
                            : "border-border bg-transparent text-muted-foreground/40 hover:border-muted-foreground hover:text-muted-foreground",
                          busy && "opacity-60 cursor-wait",
                          !canEdit && "opacity-40 cursor-not-allowed"
                        )}
                      >
                        {busy
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : enabled
                            ? <Check className="h-3.5 w-3.5" />
                            : <X className="h-3 w-3" />
                        }
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
