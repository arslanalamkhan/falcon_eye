import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { Radar, Camera, SearchX, MapPinOff } from "lucide-react"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { SearchInput } from "@/components/ui/input"
import { ChipGroup } from "@/components/ui/tabs"
import { EmptyState } from "@/components/ui/empty-state"
import { SkeletonRows } from "@/components/ui/skeleton"
import { Tip } from "@/components/ui/tooltip"
import { SiteTypeIcon, SiteStatusBadge } from "@/components/sites/site-ui"
import { useNow } from "@/hooks/useNow"
import { timeAgo } from "@/lib/format"
import type { SiteData } from "@/hooks/useFirebaseData"

export function SiteStatusList({ sites, departmentCodes, loading, emptyHint, className }: {
  sites: SiteData[]
  departmentCodes: string[]
  loading: boolean
  emptyHint: string
  className?: string
}) {
  const now = useNow()
  const [query, setQuery] = useState("")
  const [dept, setDept]   = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return sites.filter((s) =>
      (!dept || s.department_code === dept) &&
      (!q || s.label.toLowerCase().includes(q) || s.id.toLowerCase().includes(q))
    )
  }, [sites, query, dept])

  const clear = sites.filter((s) => s.reported && !s.alert).length

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle icon={Radar}>Site status</CardTitle>
        {!loading && <span className="text-xs text-muted-foreground tabular-nums">{clear}/{sites.length} clear</span>}
      </CardHeader>

      {!loading && sites.length > 0 && (
        <div className="space-y-2.5 border-b border-border px-4 py-3 sm:px-5">
          {sites.length > 6 && <SearchInput value={query} onChange={setQuery} placeholder="Filter sites…" />}
          {departmentCodes.length > 1 && (
            <ChipGroup options={departmentCodes.map((c) => ({ value: c, label: c }))} value={dept} onChange={setDept} />
          )}
        </div>
      )}

      {loading ? (
        <SkeletonRows rows={6} className="p-5" />
      ) : sites.length === 0 ? (
        <EmptyState icon={MapPinOff} title="No sites assigned" description={emptyHint} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={SearchX} title="No matching sites" description="Try a different name or department." />
      ) : (
        <ul className="max-h-[32rem] divide-y divide-border overflow-y-auto">
          {filtered.map((s) => (
            <li key={s.id} className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/40 sm:px-5">
              <SiteTypeIcon site={s} />
              <Link to={`/map?site=${encodeURIComponent(s.id)}`} className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground group-hover:text-primary">{s.label}</p>
                <p className="truncate text-xs text-muted-foreground">
                  <span className="font-mono">{s.department_code ?? s.id}</span>
                  {s.reported && <> · GPS {timeAgo(s.gps?.updated, now)}</>}
                </p>
              </Link>
              <SiteStatusBadge site={s} compact />
              <Tip content="View cameras">
                <Link
                  to={`/cameras?site=${encodeURIComponent(s.id)}`}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  aria-label={`Cameras at ${s.label}`}
                >
                  <Camera className="h-4 w-4" />
                </Link>
              </Tip>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
