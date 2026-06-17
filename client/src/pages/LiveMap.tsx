import { useEffect } from "react"
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet"
import { useNavigate } from "react-router-dom"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { Badge } from "@/components/ui/badge"
import { MapPin, Satellite, Clock, Gauge, Loader2, Camera } from "lucide-react"
import { useFirebaseData, type SiteData } from "@/hooks/useFirebaseData"

// ── Custom marker icon using inline SVG / div ────────────────────
function createMarkerIcon(isAlert: boolean) {
  const color   = isAlert ? "#ef4444" : "#10b981"
  const outline = isAlert ? "rgba(239,68,68,0.35)" : "transparent"
  const pulse   = isAlert
    ? `<div style="position:absolute;inset:-7px;border-radius:9999px;background:${outline};animation:map-ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>`
    : ""
  return L.divIcon({
    className: "",
    html: `
      <div style="position:relative;width:18px;height:18px;">
        ${pulse}
        <div style="
          position:absolute;inset:0;
          border-radius:9999px;
          background:${color};
          border:2.5px solid white;
          box-shadow:0 0 0 1px rgba(0,0,0,0.25), 0 2px 8px rgba(0,0,0,0.5);
        "></div>
      </div>`,
    iconSize:    [18, 18],
    iconAnchor:  [9, 9],
    popupAnchor: [0, -12],
  })
}

// ── Helpers ──────────────────────────────────────────────────────
function timeAgo(iso?: string): string {
  if (!iso) return "—"
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  return `${hrs}h ${mins % 60}m ago`
}

function fmtCoord(v: string, dir: "N" | "E") {
  return `${parseFloat(v).toFixed(5)}° ${dir}`
}

// ── Auto-fit map to sites on first load ──────────────────────────
function MapAutoFit({ sites }: { sites: SiteData[] }) {
  const map = useMap()

  useEffect(() => {
    const valid = sites.filter(s => s.gps?.lat && s.gps?.lng)
    if (valid.length === 0) return

    if (valid.length === 1) {
      map.setView(
        [parseFloat(valid[0].gps.lat), parseFloat(valid[0].gps.lng)],
        9,
        { animate: true }
      )
      return
    }

    const bounds = L.latLngBounds(
      valid.map(s => [parseFloat(s.gps.lat), parseFloat(s.gps.lng)] as [number, number])
    )
    map.fitBounds(bounds, { padding: [60, 60], animate: true })
  }, [sites.length, map])

  return null
}

// ── Main component ───────────────────────────────────────────────
export default function LiveMap() {
  const { sites, activeAlertCount } = useFirebaseData()
  const navigate = useNavigate()

  return (
    <div className="flex flex-col gap-4" style={{ height: "calc(100vh - 6.5rem)" }}>

      {/* Page header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold text-foreground">Live Map</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Real-time GPS tracking across all active sites
          </p>
        </div>
        <div className="flex items-center gap-3">
          {activeAlertCount > 0 && (
            <Badge variant="danger" className="animate-pulse">
              {activeAlertCount} Active Alert{activeAlertCount !== 1 ? "s" : ""}
            </Badge>
          )}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            {sites.length} site{sites.length !== 1 ? "s" : ""} tracked
          </div>
        </div>
      </div>

      {/* Map + sidebar */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 flex-1 min-h-0">

        {/* Map */}
        <div className="xl:col-span-3 rounded-lg overflow-hidden border border-border">
          <MapContainer
            center={[30.3753, 69.3451]}
            zoom={5}
            style={{ height: "100%", width: "100%" }}
            zoomControl
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank">CARTO</a>'
              subdomains="abcd"
              maxZoom={19}
            />

            <MapAutoFit sites={sites} />

            {sites.map((site) => {
              const lat = parseFloat(site.gps?.lat ?? "")
              const lng = parseFloat(site.gps?.lng ?? "")
              if (isNaN(lat) || isNaN(lng)) return null

              return (
                <Marker
                  key={site.id}
                  position={[lat, lng]}
                  icon={createMarkerIcon(site.alert)}
                >
                  <Popup minWidth={220}>
                    <div className="space-y-2.5">

                      {/* Title row */}
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-semibold text-foreground leading-tight">
                          {site.label}
                        </span>
                        <Badge
                          variant={site.alert ? "danger" : "success"}
                          className="text-[10px] shrink-0"
                        >
                          {site.alert ? "ALERT" : "Standby"}
                        </Badge>
                      </div>

                      {/* Details */}
                      <div className="space-y-1.5 text-[11px] text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Satellite className="h-3 w-3 shrink-0" />
                          GPS status:&nbsp;
                          <span className={
                            site.gps?.status === "live"
                              ? "text-emerald-400 font-medium"
                              : "text-amber-400 font-medium"
                          }>
                            {site.gps?.status ?? "unknown"}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {fmtCoord(site.gps?.lat ?? "0", "N")},&nbsp;
                          {fmtCoord(site.gps?.lng ?? "0", "E")}
                        </div>

                        {site.gps?.speed_kmh && parseFloat(site.gps.speed_kmh) > 0 && (
                          <div className="flex items-center gap-1.5">
                            <Gauge className="h-3 w-3 shrink-0" />
                            {parseFloat(site.gps.speed_kmh).toFixed(0)} km/h
                          </div>
                        )}

                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3 shrink-0" />
                          GPS updated {timeAgo(site.gps?.updated)}
                        </div>
                      </div>

                      {/* Site ID chip + cameras link */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="text-[10px] font-mono text-muted-foreground border border-border rounded px-1.5 py-0.5">
                          {site.id}
                        </p>
                        <button
                          onClick={() => navigate(`/cameras?site=${site.id}`)}
                          className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 transition-colors font-medium"
                        >
                          <Camera className="h-3 w-3" />
                          View Cameras
                        </button>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              )
            })}
          </MapContainer>
        </div>

        {/* Site list panel */}
        <div className="rounded-lg border border-border bg-card flex flex-col min-h-0">

          {/* Panel header */}
          <div className="px-4 py-3 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Sites</span>
              <span className="ml-auto text-[10px] text-muted-foreground">
                {sites.length} total
              </span>
            </div>
          </div>

          {/* Site rows */}
          <div className="flex-1 overflow-y-auto divide-y divide-border min-h-0">
            {sites.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 h-24 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-xs">Connecting…</span>
              </div>
            ) : (
              sites.map((site) => (
                <div
                  key={site.id}
                  className="px-4 py-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start gap-2.5">
                    <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                      site.alert ? "bg-red-400 animate-pulse" : "bg-emerald-400"
                    }`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-foreground truncate">
                        {site.label}
                      </p>
                      <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                        {site.id}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <span className={`text-[10px] ${
                          site.gps?.status === "live"
                            ? "text-emerald-400"
                            : "text-amber-400"
                        }`}>
                          GPS {site.gps?.status ?? "—"}
                        </span>
                        <button
                          onClick={() => navigate(`/cameras?site=${site.id}`)}
                          className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 transition-colors"
                        >
                          <Camera className="h-2.5 w-2.5" />
                          Cameras
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Legend */}
          <div className="px-4 py-3 border-t border-border shrink-0 space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              Legend
            </p>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
              Standby
            </div>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span className="h-2 w-2 shrink-0 rounded-full bg-red-400 animate-pulse" />
              Active Alert
            </div>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" />
              GPS Fallback (last known)
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
