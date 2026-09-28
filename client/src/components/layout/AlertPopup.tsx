import { useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { Siren, MapPin, Satellite, Clock, Gauge, Volume2, VolumeX, LocateFixed, Camera, Info } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { usePersistentState } from "@/hooks/usePersistentState"
import { useNow } from "@/hooks/useNow"
import { formatCoords, formatTime, timeAgo } from "@/lib/format"
import type { AlertEvent } from "@/hooks/useAlertNotification"

// ── Siren sound (Web Audio API — no file needed) ─────────────────
function startAlertSound(): () => void {
  const AudioCtx = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioCtx) return () => {}

  const ctx  = new AudioCtx()
  const osc  = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = "sawtooth"
  gain.gain.value = 0.18
  osc.connect(gain)
  gain.connect(ctx.destination)

  // Pre-schedule 200 siren cycles (≈ 2.7 minutes)
  const now = ctx.currentTime
  const cycle = 0.8
  for (let i = 0; i < 200; i++) {
    const t = now + i * cycle
    osc.frequency.setValueAtTime(660, t)
    osc.frequency.exponentialRampToValueAtTime(990, t + cycle * 0.5)
    osc.frequency.exponentialRampToValueAtTime(660, t + cycle)
  }
  osc.start(now)

  return () => {
    try { osc.stop(); ctx.close() } catch { /* already stopped */ }
  }
}

function Detail({ icon: Icon, label, value, tone }: {
  icon: React.ElementType; label: string; value: string; tone?: "success" | "warning"
}) {
  return (
    <div className="rounded-lg border border-border bg-background/40 px-3 py-2.5">
      <dt className="flex items-center gap-1.5 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {label}
      </dt>
      <dd className={cn("mt-1 break-words text-sm font-semibold tabular-nums",
        tone === "success" && "text-success",
        tone === "warning" && "text-warning")}
      >
        {value}
      </dd>
    </div>
  )
}

/**
 * Full-screen panic alert takeover. The web app is read-only to Firebase,
 * so "Dismiss" only closes this popup — the alert itself stays active
 * (and on the dashboard/bell) until it's reset from the HQ receiver.
 */
export default function AlertPopup({ alert, queueLength, onDismiss }: {
  alert: AlertEvent
  queueLength: number
  onDismiss: () => void
}) {
  const navigate = useNavigate()
  const now = useNow(15_000)
  const [muted, setMuted] = usePersistentState("fe.alert.muted", false)
  const primaryRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (muted) return
    return startAlertSound()
  }, [alert.siteId, muted])

  useEffect(() => { primaryRef.current?.focus() }, [alert.siteId])

  const remaining = queueLength - 1
  const gpsLive = alert.gpsStatus === "live"
  const hasCoords = !!alert.lat && !!alert.lng

  const openAndDismiss = (to: string) => {
    navigate(to)
    onDismiss()
  }

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="alert-title"
      aria-describedby="alert-desc"
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/80 backdrop-blur-sm animate-in fade-in-0 sm:items-center sm:p-4"
    >
      {/* Red vignette */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,hsl(var(--danger)/0.25))] animate-alert-flash" aria-hidden />

      <div className="relative w-full overflow-hidden rounded-t-2xl border border-danger/60 bg-popover shadow-glow-danger animate-in slide-in-from-bottom-8 duration-300 sm:max-w-lg sm:rounded-2xl sm:zoom-in-95 sm:slide-in-from-bottom-0">
        <div className="h-1 bg-danger animate-alert-flash" />

        {/* Header */}
        <div className="flex items-start gap-4 px-5 pb-4 pt-5 sm:px-6">
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-danger/40 animate-ping-slow" aria-hidden />
            <span className="relative flex h-12 w-12 items-center justify-center rounded-full border border-danger/50 bg-danger/20 text-danger">
              <Siren className="h-6 w-6" />
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-danger">Panic alert</p>
            <h2 id="alert-title" className="mt-0.5 truncate text-xl font-bold leading-tight text-foreground">{alert.siteLabel}</h2>
            <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
              {alert.siteId}{alert.department ? ` · ${alert.department}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setMuted((m) => !m)}
              aria-label={muted ? "Unmute siren" : "Mute siren"}
              aria-pressed={muted}
            >
              {muted ? <VolumeX /> : <Volume2 />}
            </Button>
            {remaining > 0 && (
              <span className="rounded-full border border-danger/30 bg-danger/15 px-2 py-0.5 text-2xs font-bold text-danger">
                +{remaining} more
              </span>
            )}
          </div>
        </div>

        {/* Details */}
        <dl className="grid grid-cols-2 gap-2 px-5 sm:px-6">
          <Detail icon={Clock} label="Triggered" value={`${formatTime(alert.triggeredAt)} · ${timeAgo(alert.triggeredAt, now)}`} />
          <Detail icon={Satellite} label="GPS" value={alert.gpsStatus ? (gpsLive ? "Live fix" : "Last known") : "Unknown"} tone={gpsLive ? "success" : "warning"} />
          <Detail icon={MapPin} label="Coordinates" value={hasCoords ? formatCoords(alert.lat, alert.lng) : "No GPS fix"} />
          <Detail icon={Gauge} label="Speed" value={alert.speed && parseFloat(alert.speed) > 0 ? `${parseFloat(alert.speed).toFixed(0)} km/h` : "Stationary"} />
        </dl>

        <p id="alert-desc" className="mx-5 mt-3 flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground sm:mx-6">
          <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
          Routed HQ receivers have been notified. This alert stays active until it is reset from the receiver.
        </p>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:pb-6">
          <Button
            ref={primaryRef}
            size="lg"
            className="col-span-2 bg-danger text-danger-foreground hover:bg-danger/90 hover:shadow-glow-danger"
            onClick={() => openAndDismiss(`/map?site=${encodeURIComponent(alert.siteId)}`)}
          >
            <LocateFixed /> Locate on map
          </Button>
          <Button variant="outline" onClick={() => openAndDismiss(`/cameras?site=${encodeURIComponent(alert.siteId)}`)}>
            <Camera /> Cameras
          </Button>
          <Button variant="secondary" onClick={onDismiss}>
            {remaining > 0 ? `Next alert (${remaining})` : "Dismiss"}
          </Button>
        </div>
      </div>
    </div>
  )
}
