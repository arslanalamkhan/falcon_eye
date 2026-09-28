import { useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { MapContainer, TileLayer, LayersControl, ZoomControl } from "react-leaflet"
import { ChevronUp, PanelLeftClose, PanelLeftOpen, MapPinned, Route, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Tip } from "@/components/ui/tooltip"
import { useFirebaseData } from "@/hooks/useFirebaseData"
import { usePageTitle } from "@/hooks/usePageTitle"
import { usePersistentState } from "@/hooks/usePersistentState"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import { SiteMarkers } from "@/components/map/SiteMarkers"
import { MapController, type FocusRequest } from "@/components/map/MapController"
import { SitePanel } from "@/components/map/SitePanel"
import { TrackLayer, type TrackSummary } from "@/components/map/TrackLayer"
import { formatDateTime, pluralize } from "@/lib/format"
import { hasCoords, sitesSummary } from "@/lib/sites"

const PAKISTAN_CENTER: [number, number] = [30.3753, 69.3451]

export default function LiveMap() {
  usePageTitle("Live Map")
  const { sites, departmentCodes, sitesLoaded } = useFirebaseData()
  const [params, setParams] = useSearchParams()
  const selectedId = params.get("site")
  const isDesktop = useMediaQuery("(min-width: 768px)")

  const [dept, setDept]               = useState<string | null>(null)
  const [query, setQuery]             = useState("")
  const [panelOpen, setPanelOpen]     = usePersistentState("fe.map.panelOpen", true)
  const [sheetOpen, setSheetOpen]     = useState(false)
  const [fitNonce, setFitNonce]       = useState(0)
  // Fly-to requests. Seeded from ?site= so alert/bell/search links land on the site.
  const [focus, setFocus]             = useState<FocusRequest | null>(() => (selectedId ? { id: selectedId, nonce: 1 } : null))
  const fromMarkerClick               = useRef<string | null>(null)
  const [trackSiteId, setTrackSiteId] = useState<string | null>(null)
  const [trackSummary, setTrackSummary] = useState<TrackSummary | null | undefined>(undefined)

  // Follow ?site= changes made from outside the map (bell, command palette)
  useEffect(() => {
    if (!selectedId) return
    if (fromMarkerClick.current === selectedId) { fromMarkerClick.current = null; return }
    setFocus((f) => (f?.id === selectedId ? f : { id: selectedId, nonce: (f?.nonce ?? 0) + 1 }))
  }, [selectedId])

  const deptSites = useMemo(() => (dept ? sites.filter((s) => s.department_code === dept) : sites), [sites, dept])
  const located = useMemo(() => deptSites.filter(hasCoords), [deptSites])
  const alertCount = deptSites.filter((s) => s.alert).length

  // From the list: always fly, even when re-selecting the current site
  const select = (id: string) => {
    setParams({ site: id }, { replace: true })
    setFocus((f) => ({ id, nonce: (f?.nonce ?? 0) + 1 }))
    setSheetOpen(false)
  }

  // From a marker: just select (the popup opens in place) — no jarring zoom
  const selectFromMarker = (id: string) => {
    fromMarkerClick.current = id
    setParams({ site: id }, { replace: true })
  }

  // Keep fly-to targets clear of the floating panel (desktop) or bottom sheet (mobile)
  const padding = isDesktop
    ? { topLeft: [panelOpen ? 368 : 32, 32] as [number, number], bottomRight: [32, 32] as [number, number] }
    : { topLeft: [24, 24] as [number, number], bottomRight: [24, 96] as [number, number] }

  const panel = (
    <SitePanel
      sites={deptSites}
      selectedId={selectedId}
      onSelect={select}
      query={query}
      onQueryChange={setQuery}
      dept={dept}
      onDeptChange={setDept}
      departmentCodes={departmentCodes}
      onFitAll={() => { setParams({}, { replace: true }); setFocus(null); setFitNonce((n) => n + 1) }}
      loading={!sitesLoaded}
      className="flex-1"
    />
  )

  return (
    <div className="relative h-full w-full">
      <MapContainer center={PAKISTAN_CENTER} zoom={5} zoomControl={false} className="z-0 h-full w-full" worldCopyJump>
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Satellite">
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution='Tiles &copy; <a href="https://www.esri.com" target="_blank" rel="noreferrer">Esri</a> — Esri, Maxar, Earthstar Geographics'
              maxZoom={19}
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Dark">
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
              attribution='Tiles &copy; <a href="https://www.esri.com" target="_blank" rel="noreferrer">Esri</a> — Esri, HERE, Garmin, FAO, NOAA, USGS'
              maxZoom={16}
              maxNativeZoom={16}
            />
          </LayersControl.BaseLayer>
          <LayersControl.Overlay checked name="Place labels">
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
              attribution=""
              maxZoom={19}
            />
          </LayersControl.Overlay>
        </LayersControl>
        <ZoomControl position="topright" />
        <MapController sites={located} focus={focus} fitNonce={fitNonce} padding={padding} />
        {trackSiteId && (
          <TrackLayer key={trackSiteId} siteId={trackSiteId} padding={padding} onLoaded={setTrackSummary} />
        )}
        <SiteMarkers
          sites={located}
          selectedId={selectedId}
          onSelect={selectFromMarker}
          onShowTrack={(id) => { setTrackSummary(undefined); setTrackSiteId(id) }}
        />
      </MapContainer>

      {/* ── Satellite track summary ───────────────────────────── */}
      {trackSiteId && (
        <div className="absolute left-1/2 top-3 z-10 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center gap-3 rounded-xl border border-info/30 bg-popover/95 py-2 pl-3.5 pr-2 shadow-pop backdrop-blur-xl md:top-4">
          <Route className="h-4 w-4 shrink-0 text-info" />
          <div className="min-w-0 text-xs leading-tight">
            <p className="truncate font-semibold text-foreground">
              {sites.find((s) => s.id === trackSiteId)?.label ?? trackSiteId} — 15-day track
            </p>
            <p className="truncate text-muted-foreground">
              {trackSummary === undefined
                ? "Loading…"
                : trackSummary === null
                  ? "No reports in the last 15 days"
                  : `${pluralize(trackSummary.reports, "report")} · ${pluralize(trackSummary.alarms, "alarm message")} · ${formatDateTime(trackSummary.from)} → ${formatDateTime(trackSummary.to)}`}
            </p>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={() => setTrackSiteId(null)} aria-label="Hide track">
            <X />
          </Button>
        </div>
      )}

      {/* ── Desktop floating panel ─────────────────────────────── */}
      {panelOpen ? (
        <aside className="absolute bottom-4 left-4 top-4 z-10 hidden w-80 flex-col overflow-hidden rounded-xl border border-border bg-popover/90 shadow-pop backdrop-blur-xl md:flex">
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <MapPinned className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-sm font-semibold">Live Map</h1>
              <p className={cn("text-xs", alertCount ? "font-medium text-danger" : "text-muted-foreground")}>{sitesSummary(deptSites)}</p>
            </div>
            <Tip content="Hide panel">
              <Button variant="ghost" size="icon-sm" onClick={() => setPanelOpen(false)} aria-label="Hide site panel">
                <PanelLeftClose />
              </Button>
            </Tip>
          </div>
          {panel}
        </aside>
      ) : (
        <Button
          variant="outline"
          onClick={() => setPanelOpen(true)}
          className="absolute left-4 top-4 z-10 hidden bg-popover/90 shadow-pop backdrop-blur-xl md:inline-flex"
        >
          <PanelLeftOpen /> Sites
          <span className={cn("rounded-full px-1.5 font-mono text-2xs", alertCount ? "bg-danger text-danger-foreground" : "bg-muted")}>
            {alertCount || deptSites.length}
          </span>
        </Button>
      )}

      {/* ── Mobile bottom sheet ────────────────────────────────── */}
      <div className="absolute inset-x-2 bottom-2 z-10 md:hidden">
        <div className="flex max-h-[62dvh] flex-col overflow-hidden rounded-2xl border border-border bg-popover/95 shadow-pop backdrop-blur-xl">
          <button
            type="button"
            onClick={() => setSheetOpen((o) => !o)}
            className="flex shrink-0 flex-col items-center gap-2 px-4 pb-3 pt-2"
            aria-expanded={sheetOpen}
            aria-controls="map-sheet"
          >
            <span className="h-1 w-10 rounded-full bg-muted-foreground/30" aria-hidden />
            <span className="flex w-full items-center gap-3">
              <MapPinned className="h-4 w-4 text-primary" />
              <span className={cn("flex-1 text-left text-sm font-medium", alertCount && "text-danger")}>{sitesSummary(deptSites)}</span>
              <ChevronUp className={cn("h-4 w-4 text-muted-foreground transition-transform", sheetOpen && "rotate-180")} />
            </span>
          </button>
          {sheetOpen && (
            <div id="map-sheet" className="flex min-h-0 flex-1 flex-col border-t border-border animate-in fade-in-0 slide-in-from-bottom-2">
              {panel}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
