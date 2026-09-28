import { useMemo } from "react"
import { Crosshair, SearchX, MapPinOff } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { SearchInput } from "@/components/ui/input"
import { ChipGroup } from "@/components/ui/tabs"
import { EmptyState } from "@/components/ui/empty-state"
import { SkeletonRows } from "@/components/ui/skeleton"
import { Tip } from "@/components/ui/tooltip"
import { SiteStateDot } from "@/components/sites/site-ui"
import { useNow } from "@/hooks/useNow"
import { timeAgo } from "@/lib/format"
import type { SiteData } from "@/hooks/useFirebaseData"
import { hasCoords } from "@/lib/sites"

/** Site list + filters, shared by the desktop floating panel and the mobile bottom sheet. */
export function SitePanel({
  sites, selectedId, onSelect, query, onQueryChange, dept, onDeptChange, departmentCodes, onFitAll, loading, className,
}: {
  sites: SiteData[]
  selectedId: string | null
  onSelect: (id: string) => void
  query: string
  onQueryChange: (q: string) => void
  dept: string | null
  onDeptChange: (d: string | null) => void
  departmentCodes: string[]
  onFitAll: () => void
  loading: boolean
  className?: string
}) {
  const now = useNow()

  const listed = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matched = q ? sites.filter((s) => s.label.toLowerCase().includes(q) || s.id.toLowerCase().includes(q)) : sites
    // Located sites first (alerts already sort to the top), then those with no fix
    return [...matched.filter(hasCoords), ...matched.filter((s) => !hasCoords(s))]
  }, [sites, query])

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="space-y-2.5 border-b border-border p-3">
        <div className="flex gap-2">
          <SearchInput value={query} onChange={onQueryChange} placeholder="Find a site…" />
          <Tip content="Show all sites">
            <Button variant="outline" size="icon" onClick={onFitAll} aria-label="Show all sites" className="shrink-0">
              <Crosshair />
            </Button>
          </Tip>
        </div>
        {departmentCodes.length > 1 && (
          <ChipGroup options={departmentCodes.map((c) => ({ value: c, label: c }))} value={dept} onChange={onDeptChange} />
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <SkeletonRows rows={6} className="p-4" />
        ) : sites.length === 0 ? (
          <EmptyState icon={MapPinOff} title="No sites to show" description="Sites you have access to will appear here." />
        ) : listed.length === 0 ? (
          <EmptyState icon={SearchX} title="No matching sites" />
        ) : (
          <ul className="p-1.5" role="listbox" aria-label="Sites">
            {listed.map((s) => {
              const located = hasCoords(s)
              const selected = s.id === selectedId
              return (
                <li key={s.id} role="option" aria-selected={selected}>
                  <button
                    type="button"
                    onClick={() => onSelect(s.id)}
                    disabled={!located}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                      selected ? "bg-primary/15" : "hover:bg-accent/60",
                      !located && "cursor-default opacity-60 hover:bg-transparent"
                    )}
                  >
                    <SiteStateDot site={s} />
                    <div className="min-w-0 flex-1">
                      <p className={cn("truncate text-sm font-medium", s.alert ? "text-danger" : "text-foreground")}>{s.label}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {s.department_code && <span className="font-mono">{s.department_code} · </span>}
                        {!s.reported ? "Awaiting first report" : located ? `GPS ${timeAgo(s.gps?.updated, now)}` : "No GPS fix"}
                      </p>
                    </div>
                    {s.alert && <span className="shrink-0 rounded bg-danger px-1.5 py-px text-2xs font-bold text-danger-foreground">ALERT</span>}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
