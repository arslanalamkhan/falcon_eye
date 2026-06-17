import { useEffect, useRef, useState, useCallback } from "react"
import Hls from "hls.js"
import { api } from "@/lib/api"
import { Loader2, VideoOff, RefreshCw } from "lucide-react"

type Phase = "idle" | "starting" | "playing" | "error"

type Props = {
  cameraId: number
  label: string
}

const BASE = "http://localhost:3001"
const HEARTBEAT_INTERVAL = 25_000

export default function VideoPlayer({ cameraId, label }: Props) {
  const videoRef  = useRef<HTMLVideoElement>(null)
  const hlsRef    = useRef<Hls | null>(null)
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [phase, setPhase]   = useState<Phase>("idle")
  const [error, setError]   = useState("")

  const destroyHls = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current)
      heartbeatRef.current = null
    }
  }, [])

  const attachHls = useCallback((hlsUrl: string) => {
    const video = videoRef.current
    if (!video) return

    if (Hls.isSupported()) {
      const hls = new Hls({
        lowLatencyMode: true,
        backBufferLength: 0,
      })
      hlsRef.current = hls
      hls.loadSource(`${BASE}${hlsUrl}`)
      hls.attachMedia(video)
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {})
        setPhase("playing")
      })
      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (data.fatal) {
          setPhase("error")
          setError("Stream error — try restarting")
          destroyHls()
        }
      })
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari native HLS
      video.src = `${BASE}${hlsUrl}`
      video.play().catch(() => {})
      setPhase("playing")
    } else {
      setPhase("error")
      setError("HLS not supported in this browser")
    }
  }, [destroyHls])

  const startStream = useCallback(async () => {
    setPhase("starting")
    setError("")
    try {
      const { url } = await api.post<{ url: string; status: string }>(
        `/api/streams/${cameraId}/start`,
        {}
      )
      attachHls(url)

      // Keep stream alive while the player is mounted
      heartbeatRef.current = setInterval(async () => {
        try {
          await api.get(`/api/streams/${cameraId}/status`)
        } catch (_) {}
      }, HEARTBEAT_INTERVAL)
    } catch (err) {
      setPhase("error")
      setError(err instanceof Error ? err.message : "Failed to start stream")
    }
  }, [cameraId, attachHls])

  const stopStream = useCallback(async () => {
    destroyHls()
    try { await api.delete(`/api/streams/${cameraId}`) } catch (_) {}
  }, [cameraId, destroyHls])

  // Auto-start on mount, cleanup on unmount
  useEffect(() => {
    startStream()
    return () => { stopStream() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraId])

  return (
    <div className="relative w-full aspect-video bg-black rounded-md overflow-hidden group">
      {/* Video element — always in DOM so HLS can attach */}
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        muted
        playsInline
        autoPlay
      />

      {/* Label overlay */}
      <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-gradient-to-t from-black/80 to-transparent">
        <p className="text-[11px] font-medium text-white truncate">{label}</p>
      </div>

      {/* Live indicator */}
      {phase === "playing" && (
        <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/60 rounded px-1.5 py-0.5">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[10px] font-bold text-white tracking-wide">LIVE</span>
        </div>
      )}

      {/* Starting overlay */}
      {phase === "starting" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70">
          <Loader2 className="h-6 w-6 text-primary animate-spin" />
          <p className="text-xs text-muted-foreground">Connecting…</p>
        </div>
      )}

      {/* Error overlay */}
      {phase === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 p-4">
          <VideoOff className="h-7 w-7 text-destructive" />
          <p className="text-xs text-center text-muted-foreground leading-relaxed">{error}</p>
          <button
            onClick={startStream}
            className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
        </div>
      )}

      {/* Idle (shouldn't normally show) */}
      {phase === "idle" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <p className="text-xs text-muted-foreground">Waiting…</p>
        </div>
      )}
    </div>
  )
}
