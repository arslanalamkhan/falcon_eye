import { useEffect, useLayoutEffect, useRef } from "react"
import { useMap } from "react-leaflet"
import L from "leaflet"
import type { SiteData } from "@/hooks/useFirebaseData"

export type MapPadding = { topLeft: [number, number]; bottomRight: [number, number] }
/** A request to fly to a site. `nonce` lets the same site be re-focused. */
export type FocusRequest = { id: string; nonce: number }

function toLatLng(s: SiteData): L.LatLngTuple {
  return [parseFloat(s.gps?.lat ?? ""), parseFloat(s.gps?.lng ?? "")]
}

/**
 * Imperative camera moves driven by props:
 * - first load: fit every located site (unless deep-linked to one)
 * - `fitNonce` change: fit every located site again ("Show all")
 * - `focus` change: fly to that site
 * Padding keeps targets clear of the floating panel / bottom sheet.
 */
export function MapController({ sites, focus, fitNonce, padding }: {
  sites: SiteData[]
  focus: FocusRequest | null
  fitNonce: number
  padding: MapPadding
}) {
  const map = useMap()
  const didInitialFit = useRef(false)
  const paddingRef = useRef(padding)
  useLayoutEffect(() => { paddingRef.current = padding })

  const fitAll = (animate: boolean) => {
    if (sites.length === 0) return
    if (sites.length === 1) {
      map.setView(toLatLng(sites[0]), 10, { animate })
      return
    }
    map.fitBounds(L.latLngBounds(sites.map(toLatLng)), {
      paddingTopLeft: paddingRef.current.topLeft,
      paddingBottomRight: paddingRef.current.bottomRight,
      maxZoom: 11,
      animate,
    })
  }

  useEffect(() => {
    if (didInitialFit.current || sites.length === 0) return
    didInitialFit.current = true
    if (!focus) fitAll(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sites.length])

  useEffect(() => {
    if (fitNonce > 0) fitAll(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitNonce])

  // Fly when a focus request arrives — or once its site first gets a GPS fix.
  // Deliberately not re-run on GPS ticks, so a moving train doesn't yank the view.
  const target = focus ? sites.find((s) => s.id === focus.id) : undefined
  const targetLocated = target !== undefined
  useEffect(() => {
    if (!target) return
    const p = L.latLng(toLatLng(target))
    map.flyToBounds(L.latLngBounds(p, p), {
      paddingTopLeft: paddingRef.current.topLeft,
      paddingBottomRight: paddingRef.current.bottomRight,
      maxZoom: Math.max(map.getZoom(), 12),
      duration: 0.8,
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.nonce, focus?.id, targetLocated])

  return null
}
