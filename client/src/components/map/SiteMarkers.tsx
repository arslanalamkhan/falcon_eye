import { useEffect, useRef } from "react"
import { Link } from "react-router-dom"
import { Marker, Popup, Tooltip } from "react-leaflet"
import L from "leaflet"
import { Camera, Clock, Gauge, MapPin, Route, LocateFixed } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/contexts/AuthContext"
import { useFmsCommands } from "@/hooks/useFmsCommands"
import { FmsResetButton } from "@/components/sites/FmsResetButton"
import { Badge } from "@/components/ui/badge"
import { errorMessage } from "@/lib/utils"
import { isAdminRole } from "@/types/access"
import { SiteStatusBadge } from "@/components/sites/site-ui"
import { siteState } from "@/lib/sites"
import { formatCoords, timeAgo } from "@/lib/format"
import type { SiteData } from "@/hooks/useFirebaseData"

// One divIcon per visual state — reusing the instance means react-leaflet
// doesn't swap the marker DOM on every Firebase update (which would
// restart the alert pulse animation). Styles live in index.css.
const iconCache = new Map<string, L.DivIcon>()
function markerIcon(state: "alert" | "live" | "fallback", selected: boolean): L.DivIcon {
  const key = `${state}:${selected}`
  let icon = iconCache.get(key)
  if (!icon) {
    icon = L.divIcon({
      className: "",
      html: `<div class="fe-marker fe-marker--${state}${selected ? " fe-marker--selected" : ""}">${state === "alert" ? '<span class="fe-marker__pulse"></span>' : ""}<span class="fe-marker__dot"></span></div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
      popupAnchor: [0, -14],
      tooltipAnchor: [0, -12],
    })
    iconCache.set(key, icon)
  }
  return icon
}

/** Satellite-only popup extras (hooks can't run per-marker conditionally, so this is its own component). */
function FmsPopupActions({ site }: { site: SiteData }) {
  const { user } = useAuth()
  const admin = isAdminRole(user?.role)
  const { pendingPoll, pollPosition } = useFmsCommands(site.id, admin)

  const onPoll = async () => {
    try {
      await pollPosition()
      toast.success("Position requested", {
        description: "It appears on the map when the terminal reports, usually within a few minutes.",
      })
    } catch (err) {
      toast.error("Couldn't request position", { description: errorMessage(err) })
    }
  }

  return (
    <>
      {site.fms_test_mode && <Badge variant="warning" size="sm">Test mode</Badge>}
      {site.alert && (
        <FmsResetButton siteId={site.id} siteLabel={site.label} alert size="sm" className="w-full" />
      )}
      {admin && (
        <button
          type="button"
          onClick={onPoll}
          disabled={!!pendingPoll}
          className="flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-border bg-accent/50 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-60"
        >
          <LocateFixed className="h-3.5 w-3.5" /> {pendingPoll ? "Position requested…" : "Request position"}
        </button>
      )}
    </>
  )
}

export function SiteMarkers({ sites, selectedId, onSelect, onShowTrack }: {
  sites: SiteData[]
  selectedId: string | null
  onSelect: (id: string) => void
  /** Offered for satellite (FMS) sites, which keep a 15-day position history */
  onShowTrack: (id: string) => void
}) {
  const markers = useRef<Record<string, L.Marker | null>>({})

  // Open the selected site's popup (e.g. after arriving from an alert link)
  useEffect(() => {
    if (!selectedId) return
    const t = setTimeout(() => markers.current[selectedId]?.openPopup(), 650)
    return () => clearTimeout(t)
  }, [selectedId])

  return (
    <>
      {sites.map((site) => {
        const state = siteState(site)
        const lat = parseFloat(site.gps?.lat ?? "")
        const lng = parseFloat(site.gps?.lng ?? "")
        const speed = parseFloat(site.gps?.speed_kmh ?? "0")
        return (
          <Marker
            key={site.id}
            position={[lat, lng]}
            icon={markerIcon(state === "unreported" ? "fallback" : state, site.id === selectedId)}
            zIndexOffset={site.alert ? 1000 : site.id === selectedId ? 500 : 0}
            eventHandlers={{ click: () => onSelect(site.id) }}
            ref={(m) => { markers.current[site.id] = m }}
            keyboard
            title={site.label}
          >
            <Tooltip direction="top" className="fe-tooltip">{site.label}</Tooltip>
            <Popup minWidth={240} maxWidth={280}>
              <div className="space-y-3">
                <div>
                  <div className="flex items-start justify-between gap-2 pr-5">
                    <p className="text-sm font-semibold leading-tight text-foreground">{site.label}</p>
                    <SiteStatusBadge site={site} compact />
                  </div>
                  <p className="mt-0.5 font-mono text-2xs text-muted-foreground">
                    {site.id}{site.department_code ? ` · ${site.department_code}` : ""}
                  </p>
                </div>
                <dl className="space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <dd className="font-mono text-foreground/90">{formatCoords(lat, lng, 5)}</dd>
                  </div>
                  {speed > 0 && (
                    <div className="flex items-center gap-2">
                      <Gauge className="h-3.5 w-3.5 shrink-0" />
                      <dd>{speed.toFixed(0)} km/h</dd>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    <dd>GPS updated {timeAgo(site.gps?.updated)}</dd>
                  </div>
                </dl>
                <div className="flex gap-2">
                  <Link
                    to={`/cameras?site=${encodeURIComponent(site.id)}`}
                    className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md border border-border bg-accent/50 text-xs font-medium !text-foreground transition-colors hover:bg-accent"
                  >
                    <Camera className="h-3.5 w-3.5" /> Cameras
                  </Link>
                  {site.source === "satellite_fms" && (
                    <button
                      type="button"
                      onClick={() => onShowTrack(site.id)}
                      className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md border border-info/30 bg-info/10 text-xs font-medium text-info transition-colors hover:bg-info/20"
                    >
                      <Route className="h-3.5 w-3.5" /> 15-day track
                    </button>
                  )}
                </div>
                {site.source === "satellite_fms" && (
                  <div className="space-y-2"><FmsPopupActions site={site} /></div>
                )}
              </div>
            </Popup>
          </Marker>
        )
      })}
    </>
  )
}
