import { useEffect, useState } from "react"
import { Polyline, CircleMarker, Tooltip, useMap } from "react-leaflet"
import L from "leaflet"
import { toast } from "sonner"
import { api } from "@/lib/api"
import { errorMessage } from "@/lib/utils"
import { formatDateTime } from "@/lib/format"
import type { MapPadding } from "./MapController"

/** One row of GET /api/admin/sites/:id/history (newest first) */
type HistoryPoint = {
  reference_id: string
  lat: number
  lng: number
  speed_kmh: string
  report_type: string
  received_at: string
}

export type TrackSummary = { reports: number; alarms: number; from: string; to: string }

const KIND: Record<string, { key: string; label: string; radius: number }> = {
  Ship_Security_Alert:        { key: "alert", label: "Panic alarm",       radius: 6 },
  SSAS_Reset_Acknowledgement: { key: "reset", label: "Alarm reset",       radius: 6 },
  SSAS_Test:                  { key: "test",  label: "SSAS test",         radius: 5 },
}
const POSITION = { key: "position", label: "Position report", radius: 4 }

/**
 * 15-day path of a satellite (FMS) site from fms_position_history.
 * Styling lives in index.css (.fe-track-*) — Leaflet SVG attributes can't
 * read CSS variables, but CSS properties on the class can.
 */
export function TrackLayer({ siteId, padding, onLoaded }: {
  siteId: string
  padding: MapPadding
  onLoaded: (summary: TrackSummary | null) => void
}) {
  const map = useMap()
  const [points, setPoints] = useState<HistoryPoint[]>([])

  useEffect(() => {
    let cancelled = false
    api.get<HistoryPoint[]>(`/api/admin/sites/${encodeURIComponent(siteId)}/history`)
      .then((rows) => {
        if (cancelled) return
        const ordered = [...rows].reverse() // oldest → newest for the line
        setPoints(ordered)
        if (ordered.length === 0) {
          onLoaded(null)
          return
        }
        onLoaded({
          reports: ordered.length,
          alarms: ordered.filter((p) => p.report_type === "Ship_Security_Alert").length,
          from: ordered[0].received_at,
          to: ordered[ordered.length - 1].received_at,
        })
        map.closePopup() // the site popup would sit on top of the track
        const bounds = L.latLngBounds(ordered.map((p) => [p.lat, p.lng] as L.LatLngTuple))
        map.flyToBounds(bounds, { paddingTopLeft: padding.topLeft, paddingBottomRight: padding.bottomRight, maxZoom: 15, duration: 0.8 })
      })
      .catch((err) => {
        if (cancelled) return
        toast.error("Couldn't load track", { description: errorMessage(err) })
        onLoaded(null)
      })
    return () => { cancelled = true }
  // Load once per site; padding/onLoaded changes shouldn't refetch
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId])

  if (points.length === 0) return null

  return (
    <>
      {points.length > 1 && (
        <Polyline positions={points.map((p) => [p.lat, p.lng] as L.LatLngTuple)} pathOptions={{ className: "fe-track-line" }} />
      )}
      {points.map((p) => {
        const kind = KIND[p.report_type] ?? POSITION
        return (
          <CircleMarker
            key={p.reference_id}
            center={[p.lat, p.lng]}
            radius={kind.radius}
            pathOptions={{ className: `fe-track-point fe-track-point--${kind.key}` }}
          >
            <Tooltip className="fe-tooltip" direction="top">
              {kind.label} · {formatDateTime(p.received_at)}
              {parseFloat(p.speed_kmh) > 0 && ` · ${parseFloat(p.speed_kmh).toFixed(0)} km/h`}
            </Tooltip>
          </CircleMarker>
        )
      })}
    </>
  )
}
