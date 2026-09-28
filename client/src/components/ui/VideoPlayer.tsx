import { useEffect, useRef, useState, useCallback } from "react"
import Hls from "hls.js"
import { Loader2, VideoOff, RefreshCw, Maximize2, Minimize2 } from "lucide-react"
import { api, BASE } from "@/lib/api"
import { cn } from "@/lib/utils"

type Phase = "idle" | "starting" | "playing" | "error"

const HEARTBEAT_INTERVAL = 25_000

// IMOU HLS URLs are absolute; RTSP HLS paths are server-relative
function resolveUrl(url: string) {
  return url.startsWith("http") ? url : `${BASE}${url}`
}

export default function VideoPlayer({ cameraId, label }: { cameraId: number; label: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef     = useRef<HTMLVideoElement>(null)
  const hlsRef       = useRef<Hls | null>(null)
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [phase, setPhase] = useState<Phase>("idle")
  const [error, setError] = useState("")
  const [fullscreen, setFullscreen] = useState(false)

  const destroyHls = useCallback(() => {
    hlsRef.current?.destroy()
    hlsRef.current = null
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current)
      heartbeatRef.current = null
    }
  }, [])

  const attachHls = useCallback((hlsUrl: string) => {
    const video = videoRef.current
    if (!video) return

    if (Hls.isSupported()) {
      const hls = new Hls({ lowLatencyMode: true, backBufferLength: 0 })
      hlsRef.current = hls
      hls.loadSource(resolveUrl(hlsUrl))
      hls.attachMedia(video)
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {})
        setPhase("playing")
      })
      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (data.fatal) {
          setPhase("error")
          setError("The stream dropped. Check the camera's connection and retry.")
          destroyHls()
        }
      })
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari native HLS
      video.src = resolveUrl(hlsUrl)
      video.play().catch(() => {})
      setPhase("playing")
    } else {
      setPhase("error")
      setError("This browser can't play HLS video.")
    }
  }, [destroyHls])

  const startStream = useCallback(async () => {
    destroyHls()
    setPhase("starting")
    setError("")
    try {
      const { url } = await api.post<{ url: string; status: string }>(`/api/streams/${cameraId}/start`, {})
      attachHls(url)
      // Keep the server-side stream alive while the player is mounted
      heartbeatRef.current = setInterval(() => {
        api.get(`/api/streams/${cameraId}/status`).catch(() => {})
      }, HEARTBEAT_INTERVAL)
    } catch (err) {
      setPhase("error")
      setError(err instanceof Error ? err.message : "Failed to start stream")
    }
  }, [cameraId, attachHls, destroyHls])

  const stopStream = useCallback(async () => {
    destroyHls()
    try { await api.delete(`/api/streams/${cameraId}`) } catch { /* best effort */ }
  }, [cameraId, destroyHls])

  // Auto-start on mount, clean up on unmount
  useEffect(() => {
    startStream()
    return () => { stopStream() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraId])

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === containerRef.current)
    document.addEventListener("fullscreenchange", onChange)
    return () => document.removeEventListener("fullscreenchange", onChange)
  }, [])

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    else containerRef.current?.requestFullscreen?.().catch(() => {})
  }

  return (
    <div ref={containerRef} className="group relative aspect-video w-full overflow-hidden bg-black">
      {/* Video element — always in DOM so HLS can attach */}
      <video ref={videoRef} className="h-full w-full object-contain" muted playsInline autoPlay aria-label={`Live feed: ${label}`} />

      {/* Top bar: live state + controls */}
      <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent p-2.5">
        {phase === "playing" ? (
          <span className="flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 text-2xs font-bold tracking-wider text-white backdrop-blur">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-danger" /> LIVE
          </span>
        ) : <span />}
        <div className={cn("flex gap-1 transition-opacity", phase === "playing" && "sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100")}>
          <button
            type="button"
            onClick={startStream}
            className="flex h-8 w-8 items-center justify-center rounded-md bg-black/60 text-white backdrop-blur transition-colors hover:bg-black/80"
            aria-label="Restart stream"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="flex h-8 w-8 items-center justify-center rounded-md bg-black/60 text-white backdrop-blur transition-colors hover:bg-black/80"
            aria-label={fullscreen ? "Exit full screen" : "Full screen"}
          >
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {fullscreen && (
        <p className="absolute bottom-4 left-4 rounded-md bg-black/60 px-2.5 py-1 text-sm font-medium text-white">{label}</p>
      )}

      {(phase === "starting" || phase === "idle") && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-black/70">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-xs text-white/70">Connecting to camera…</p>
        </div>
      )}

      {phase === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/85 p-4 text-center">
          <VideoOff className="h-7 w-7 text-danger" />
          <p className="max-w-xs text-xs leading-relaxed text-white/70">{error}</p>
          <button
            type="button"
            onClick={startStream}
            className="flex items-center gap-1.5 rounded-md border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/20"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      )}
    </div>
  )
}
