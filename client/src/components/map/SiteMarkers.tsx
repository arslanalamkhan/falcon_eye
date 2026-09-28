import { useEffect, useRef } from "react"
import { Link } from "react-router-dom"
import { Marker, Popup, Tooltip } from "react-leaflet"
import L from "leaflet"
import { Camera, Clock, Gauge, MapPin } from "lucide-react"
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

export function SiteMarkers({ sites, selectedId, onSelect }: {
  sites: SiteData[]
  selectedId: string | null
  onSelect: (id: string) => void
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
                <Link
                  to={`/cameras?site=${encodeURIComponent(site.id)}`}
                  className="flex h-8 items-center justify-center gap-1.5 rounded-md border border-border bg-accent/50 text-xs font-medium !text-foreground transition-colors hover:bg-accent"
                >
                  <Camera className="h-3.5 w-3.5" /> View cameras
                </Link>
              </div>
            </Popup>
          </Marker>
        )
      })}
    </>
  )
}
