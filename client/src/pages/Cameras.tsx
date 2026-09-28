import { useEffect, useMemo, useState, useCallback } from "react"
import { Link, useSearchParams } from "react-router-dom"
import {
  Camera, RefreshCw, VideoOff, CircleAlert, Square, Columns2, Columns3, Siren, MapPinOff, SearchX,
} from "lucide-react"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
import { useFirebaseData, type SiteData } from "@/hooks/useFirebaseData"
import { usePersistentState } from "@/hooks/usePersistentState"
import { useAuth } from "@/contexts/AuthContext"
import { isAdminRole } from "@/types/access"
import VideoPlayer from "@/components/ui/VideoPlayer"
import { PageHeader } from "@/components/layout/PageHeader"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { SearchInput, Select } from "@/components/ui/input"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton, SkeletonRows } from "@/components/ui/skeleton"
import { Tip } from "@/components/ui/tooltip"
import { SiteStateDot, SiteStatusBadge } from "@/components/sites/site-ui"
import { pluralize } from "@/lib/format"

type CameraRow = {
  id: number
  site_id: string
  label: string
  ip: string | null
  port: number
  channel: number
  subtype: number
  active: boolean
  stream_type: string
  imou_device_id: string | null
  imou_channel_id: string
}

type Cols = "1" | "2" | "3"
const GRID: Record<Cols, string> = {
  "1": "grid-cols-1 max-w-4xl",
  "2": "grid-cols-1 md:grid-cols-2",
  "3": "grid-cols-1 md:grid-cols-2 2xl:grid-cols-3",
}

export default function Cameras() {
  const { user } = useAuth()
  const { sites, sitesLoaded } = useFirebaseData()
  const [params, setParams] = useSearchParams()
  // Default to the first site (alerts sort first) when none is in the URL
  const siteId = params.get("site") || sites[0]?.id || ""

  const [cameras, setCameras]     = useState<CameraRow[]>([])
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState("")
  const [streamKey, setStreamKey] = useState(0)
  const [cols, setCols]           = usePersistentState<Cols>("fe.cameras.cols", "2")

  const selectSite = useCallback((id: string) => {
    setParams(id ? { site: id } : {}, { replace: true })
    setStreamKey((k) => k + 1)
  }, [setParams])

  const loadCameras = useCallback(async (id: string) => {
    if (!id) return
    setLoading(true)
    setError("")
    setCameras([])
    try {
      setCameras(await api.get<CameraRow[]>(`/api/cameras?siteId=${encodeURIComponent(id)}`))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load cameras")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadCameras(siteId) }, [siteId, loadCameras])

  const selected = sites.find((s) => s.id === siteId)
  const restart = () => { setStreamKey((k) => k + 1); loadCameras(siteId) }

  return (
    <>
      <PageHeader
        title="Camera feeds"
        description="Live video from on-site cameras"
        actions={
          <>
            <div className="hidden items-center rounded-lg border border-border bg-card/60 p-0.5 md:flex" role="group" aria-label="Grid layout">
              {([["1", Square, "Single column"], ["2", Columns2, "Two columns"], ["3", Columns3, "Three columns"]] as const).map(([value, Icon, label]) => (
                <Tip key={value} content={label}>
                  <button
                    type="button"
                    onClick={() => setCols(value)}
                    aria-pressed={cols === value}
                    aria-label={label}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                      cols === value ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                </Tip>
              ))}
            </div>
            <Button variant="outline" onClick={restart} disabled={!siteId || loading}>
              <RefreshCw className={cn(loading && "animate-spin")} /> Restart streams
            </Button>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <SitePicker sites={sites} loading={!sitesLoaded} selectedId={siteId} onSelect={selectSite} />

        <div className="min-w-0 space-y-4">
          {/* Compact picker for phones/tablets */}
          <div className="lg:hidden">
            <Select value={siteId} onChange={(e) => selectSite(e.target.value)} aria-label="Site" disabled={sites.length === 0}>
              {sites.length === 0 && <option value="">No sites available</option>}
              {sites.map((s) => (
                <option key={s.id} value={s.id}>{s.alert ? "⚠ " : ""}{s.label}{s.department_code ? ` (${s.department_code})` : ""}</option>
              ))}
            </Select>
          </div>

          {selected && <SelectedSiteHeader site={selected} count={loading ? null : cameras.length} />}

          {!sitesLoaded ? (
            <div className={cn("grid gap-4", GRID[cols])}>
              {[0, 1].map((i) => <Skeleton key={i} className="aspect-video rounded-xl" />)}
            </div>
          ) : sites.length === 0 ? (
            <Card><EmptyState icon={MapPinOff} title="No sites available" description="Cameras appear here once you have access to a site." /></Card>
          ) : loading ? (
            <div className={cn("grid gap-4", GRID[cols])}>
              {[0, 1].map((i) => <Skeleton key={i} className="aspect-video rounded-xl" />)}
            </div>
          ) : error ? (
            <Card>
              <EmptyState
                icon={CircleAlert}
                tone="danger"
                title="Couldn't load cameras"
                description={error}
                action={<Button variant="outline" onClick={() => loadCameras(siteId)}><RefreshCw /> Try again</Button>}
              />
            </Card>
          ) : cameras.length === 0 ? (
            <Card>
              <EmptyState
                icon={VideoOff}
                title="No cameras at this site"
                description="Cameras attached to this site will stream here automatically."
                action={isAdminRole(user?.role) ? (
                  <Button asChild variant="outline"><Link to="/admin?tab=cameras"><Camera /> Add a camera</Link></Button>
                ) : undefined}
              />
            </Card>
          ) : (
            <div className={cn("grid gap-4", GRID[cols])}>
              {cameras.map((cam) => (
                <Card key={`${cam.id}-${streamKey}`} className="overflow-hidden">
                  <VideoPlayer cameraId={cam.id} label={cam.label} />
                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{cam.label}</p>
                      <p className="truncate font-mono text-xs text-muted-foreground">
                        {cam.stream_type === "imou"
                          ? `${cam.imou_device_id} · ch${cam.imou_channel_id}`
                          : `${cam.ip}:${cam.port} · ch${cam.channel}`}
                      </p>
                    </div>
                    <Badge variant={cam.stream_type === "imou" ? "success" : "info"} size="sm">
                      {cam.stream_type === "imou" ? "IMOU Cloud" : "RTSP"}
                    </Badge>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function SelectedSiteHeader({ site, count }: { site: SiteData; count: number | null }) {
  if (site.alert) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-danger/50 bg-danger/10 px-4 py-3 shadow-glow-danger">
        <Siren className="h-5 w-5 shrink-0 text-danger animate-alert-flash" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-danger">{site.label} — panic alert active</p>
          <p className="text-xs text-danger/80">{count === null ? "Loading cameras…" : pluralize(count, "camera")}</p>
        </div>
        <Button asChild size="sm" className="bg-danger text-danger-foreground hover:bg-danger/90">
          <Link to={`/map?site=${encodeURIComponent(site.id)}`}>Locate on map</Link>
        </Button>
      </div>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <h2 className="text-base font-semibold">{site.label}</h2>
      <SiteStatusBadge site={site} compact />
      <span className="text-xs text-muted-foreground">
        <span className="font-mono">{site.department_code ?? site.id}</span>
        {count !== null && <> · {pluralize(count, "camera")}</>}
      </span>
    </div>
  )
}

function SitePicker({ sites, loading, selectedId, onSelect }: {
  sites: SiteData[]
  loading: boolean
  selectedId: string
  onSelect: (id: string) => void
}) {
  const [query, setQuery] = useState("")
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? sites.filter((s) => s.label.toLowerCase().includes(q) || s.id.toLowerCase().includes(q)) : sites
  }, [sites, query])

  return (
    <Card className="sticky top-[calc(var(--topbar-h)+1.5rem)] hidden max-h-[calc(100dvh-var(--topbar-h)-3rem)] flex-col overflow-hidden lg:flex">
      <div className="border-b border-border p-3">
        <SearchInput value={query} onChange={setQuery} placeholder="Find a site…" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {loading ? (
          <SkeletonRows rows={6} className="p-2.5" />
        ) : filtered.length === 0 ? (
          <EmptyState icon={SearchX} title="No sites" className="py-8" />
        ) : (
          <ul role="listbox" aria-label="Sites">
            {filtered.map((s) => {
              const active = s.id === selectedId
              return (
                <li key={s.id} role="option" aria-selected={active}>
                  <button
                    type="button"
                    onClick={() => onSelect(s.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                      active ? "bg-primary/15" : "hover:bg-accent/60"
                    )}
                  >
                    <SiteStateDot site={s} />
                    <div className="min-w-0 flex-1">
                      <p className={cn("truncate text-sm font-medium", s.alert ? "text-danger" : active ? "text-foreground" : "text-foreground/90")}>{s.label}</p>
                      <p className="truncate font-mono text-2xs text-muted-foreground">{s.department_code ?? s.id}</p>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Card>
  )
}
