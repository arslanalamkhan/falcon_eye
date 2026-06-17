import { useEffect, useState, useCallback } from "react"
import { useSearchParams, useNavigate } from "react-router-dom"
import { api } from "@/lib/api"
import { useFirebaseData } from "@/hooks/useFirebaseData"
import VideoPlayer from "@/components/ui/VideoPlayer"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Camera, Loader2, AlertCircle, ChevronDown, RefreshCw, VideoOff,
} from "lucide-react"

type CameraRow = {
  id: number
  site_id: string
  label: string
  ip: string
  port: number
  channel: number
  subtype: number
  active: boolean
}

export default function Cameras() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { sites } = useFirebaseData()

  const [selectedSiteId, setSelectedSiteId] = useState<string>(searchParams.get("site") ?? "")
  const [cameras, setCameras]               = useState<CameraRow[]>([])
  const [loading, setLoading]               = useState(false)
  const [error, setError]                   = useState("")
  const [streamKey, setStreamKey]           = useState(0)

  // Keep URL query in sync with selection
  useEffect(() => {
    if (selectedSiteId) setSearchParams({ site: selectedSiteId }, { replace: true })
    else setSearchParams({}, { replace: true })
  }, [selectedSiteId, setSearchParams])

  // Auto-select first site if URL has no param and sites loaded
  useEffect(() => {
    if (!selectedSiteId && sites.length > 0) {
      setSelectedSiteId(sites[0].id)
    }
  }, [sites, selectedSiteId])

  const loadCameras = useCallback(async (siteId: string) => {
    if (!siteId) return
    setLoading(true)
    setError("")
    setCameras([])
    try {
      const rows = await api.get<CameraRow[]>(`/api/cameras?siteId=${encodeURIComponent(siteId)}`)
      setCameras(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load cameras")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCameras(selectedSiteId)
  }, [selectedSiteId, loadCameras])

  const selectedSite = sites.find(s => s.id === selectedSiteId)

  function handleSiteChange(siteId: string) {
    setSelectedSiteId(siteId)
    setStreamKey(k => k + 1)  // force VideoPlayer remount to restart streams
  }

  function handleRefresh() {
    setStreamKey(k => k + 1)
    loadCameras(selectedSiteId)
  }

  return (
    <div className="flex flex-col gap-4 h-full">

      {/* Page header */}
      <div className="flex items-start justify-between shrink-0 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Camera Feeds</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Live RTSP surveillance feeds per site
          </p>
        </div>

        <div className="flex items-center gap-3">
          {selectedSite?.alert && (
            <Badge variant="danger" className="animate-pulse">
              ALERT ACTIVE
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Restart Streams
          </Button>
        </div>
      </div>

      {/* Site selector */}
      <div className="flex items-center gap-3 shrink-0 flex-wrap">
        <div className="relative">
          <select
            value={selectedSiteId}
            onChange={e => handleSiteChange(e.target.value)}
            className="h-9 min-w-[220px] appearance-none rounded-md border border-input bg-background pl-3 pr-8 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="" disabled>Select a site…</option>
            {sites.map(s => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        </div>

        {selectedSite && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className={`h-2 w-2 rounded-full ${selectedSite.alert ? "bg-red-400 animate-pulse" : "bg-emerald-400"}`} />
            {selectedSite.alert ? "Alert Active" : "Standby"}
          </div>
        )}

        {cameras.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {cameras.length} camera{cameras.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">

        {!selectedSiteId && (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
            <Camera className="h-8 w-8 opacity-40" />
            <p className="text-sm">Select a site to view camera feeds</p>
          </div>
        )}

        {selectedSiteId && loading && (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <p className="text-sm">Loading cameras…</p>
          </div>
        )}

        {selectedSiteId && error && (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <p className="text-sm">{error}</p>
            <Button variant="outline" size="sm" onClick={() => loadCameras(selectedSiteId)}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />Retry
            </Button>
          </div>
        )}

        {!loading && !error && selectedSiteId && cameras.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
            <VideoOff className="h-8 w-8 opacity-40" />
            <p className="text-sm">No cameras configured for this site</p>
            <button
              onClick={() => navigate("/admin")}
              className="text-xs text-primary hover:underline"
            >
              Add cameras in Admin panel
            </button>
          </div>
        )}

        {!loading && !error && cameras.length > 0 && (
          <div className={`grid gap-4 ${
            cameras.length === 1 ? "grid-cols-1 max-w-2xl" :
            cameras.length === 2 ? "grid-cols-1 md:grid-cols-2" :
            cameras.length <= 4  ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-2" :
                                   "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
          }`}>
            {cameras.map(cam => (
              <div key={`${cam.id}-${streamKey}`} className="rounded-lg border border-border bg-card overflow-hidden">
                <VideoPlayer cameraId={cam.id} label={cam.label} />
                <div className="px-3 py-2 border-t border-border bg-muted/20 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{cam.label}</p>
                    <p className="text-[10px] font-mono text-muted-foreground">{cam.ip}:{cam.port} — ch{cam.channel}</p>
                  </div>
                  <Badge variant="info" className="text-[10px] shrink-0 ml-2">RTSP</Badge>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
