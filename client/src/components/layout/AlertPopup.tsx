import { useEffect } from "react"
import { AlertTriangle, MapPin, Satellite, Clock, Gauge, X, Radio } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { AlertEvent } from "@/hooks/useAlertNotification"

// ── Siren sound (Web Audio API — no file needed) ─────────────────
function startAlertSound(): () => void {
  const AudioCtx = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioCtx) return () => {}

  const ctx    = new AudioCtx()
  const osc    = ctx.createOscillator()
  const gain   = ctx.createGain()

  osc.type = 'sawtooth'
  gain.gain.value = 0.18
  osc.connect(gain)
  gain.connect(ctx.destination)

  // Pre-schedule 200 siren cycles (≈ 2.7 minutes) — more than enough
  const now     = ctx.currentTime
  const cycle   = 0.8   // seconds per sweep
  const lo      = 660
  const hi      = 990

  for (let i = 0; i < 200; i++) {
    const t = now + i * cycle
    osc.frequency.setValueAtTime(lo, t)
    osc.frequency.exponentialRampToValueAtTime(hi, t + cycle * 0.5)
    osc.frequency.exponentialRampToValueAtTime(lo, t + cycle)
  }

  osc.start(now)

  return () => {
    try { osc.stop(); ctx.close() } catch { /* already stopped */ }
  }
}

// ── Detail row helper ─────────────────────────────────────────────
function Row({ icon: Icon, label, value, accent }: {
  icon: React.ElementType; label: string; value: string; accent?: boolean
}) {
  return (
    <div className="flex items-center gap-3 rounded-md bg-muted/30 px-3 py-2">
      <Icon className={`h-3.5 w-3.5 shrink-0 ${accent ? 'text-emerald-400' : 'text-muted-foreground'}`} />
      <span className="text-xs text-muted-foreground w-24 shrink-0">{label}</span>
      <span className={`text-xs font-medium ${accent ? 'text-emerald-400' : 'text-foreground'}`}>{value}</span>
    </div>
  )
}

// ── Main popup ────────────────────────────────────────────────────
export default function AlertPopup({
  alert,
  queueLength,
  onDismiss,
}: {
  alert: AlertEvent
  queueLength: number
  onDismiss: () => void
}) {
  // Start sound on mount, stop it on unmount (dismiss or alert cleared)
  useEffect(() => {
    const stop = startAlertSound()
    return stop
  }, [alert.siteId])   // restart sound if a new alert replaces the current one

  const time = new Date(alert.triggeredAt).toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })

  const hasCoords = alert.lat && alert.lng

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm">
      {/* Card */}
      <div className="relative w-full max-w-md mx-4 rounded-xl border-2 border-red-500 bg-background shadow-2xl shadow-red-950/60 overflow-hidden animate-in fade-in zoom-in-95 duration-200">

        {/* Pulsing top bar */}
        <div className="h-1 bg-red-500 animate-pulse" />

        {/* Header */}
        <div className="flex items-start gap-4 px-6 pt-5 pb-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-500/15 border border-red-500/40">
            <AlertTriangle className="h-6 w-6 text-red-400 animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-red-400 mb-0.5">
              ⚠ PANIC ALERT
            </p>
            <h2 className="text-lg font-bold text-foreground leading-tight truncate">
              {alert.siteLabel}
            </h2>
            <p className="text-[11px] font-mono text-muted-foreground">{alert.siteId}</p>
          </div>
          {/* Queue badge */}
          {queueLength > 1 && (
            <span className="shrink-0 rounded-full bg-red-500/20 border border-red-500/30 px-2 py-0.5 text-[10px] font-bold text-red-400">
              +{queueLength - 1} more
            </span>
          )}
        </div>

        {/* Details */}
        <div className="px-6 pb-4 space-y-1.5">
          <Row icon={Clock}     label="Triggered at"  value={time} />
          <Row icon={Satellite} label="GPS status"     value={alert.gpsStatus ?? '—'} accent={alert.gpsStatus === 'live'} />
          {hasCoords && (
            <Row
              icon={MapPin}
              label="Coordinates"
              value={`${parseFloat(alert.lat!).toFixed(4)}° N, ${parseFloat(alert.lng!).toFixed(4)}° E`}
            />
          )}
          {alert.speed && parseFloat(alert.speed) > 0 && (
            <Row icon={Gauge} label="Speed" value={`${parseFloat(alert.speed).toFixed(0)} km/h`} />
          )}
          <Row icon={Radio} label="Receiver(s)" value="Notified via Firebase routing" />
        </div>

        {/* Dismiss */}
        <div className="px-6 pb-6">
          <Button
            onClick={onDismiss}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold h-11"
          >
            <X className="h-4 w-4 mr-2" />
            {queueLength > 1 ? `Acknowledge & View Next (${queueLength - 1} remaining)` : 'Acknowledge & Dismiss'}
          </Button>
        </div>
      </div>
    </div>
  )
}
