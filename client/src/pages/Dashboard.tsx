import { Badge } from "@/components/ui/badge"
import {
  AlertTriangle,
  Radio,
  MapPin,
  Clock,
  TrendingUp,
  CheckCircle2,
  Satellite,
  Loader2,
} from "lucide-react"
import { useFirebaseData } from "@/hooks/useFirebaseData"

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ${hrs > 0 ? `${mins % 60}m ` : ""}ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function formatCoords(lat?: string, lng?: string): string {
  if (!lat || !lng) return "No GPS fix"
  return `${parseFloat(lat).toFixed(4)}° N, ${parseFloat(lng).toFixed(4)}° E`
}

const statusBadge: Record<string, "danger" | "warning" | "success"> = {
  active: "danger",
  resolved: "success",
}

const signalColor: Record<string, string> = {
  live: "text-emerald-400",
  fallback: "text-amber-400",
}

export default function Dashboard() {
  const { sites, recentAlerts, activeAlertCount } = useFirebaseData()

  const alertSubtext =
    activeAlertCount > 0 ? `${activeAlertCount} critical` : "No active alerts"

  const stats = [
    {
      label: "Active Alerts",
      value: String(activeAlertCount),
      sub: alertSubtext,
      icon: AlertTriangle,
      color: activeAlertCount > 0 ? "text-red-400" : "text-emerald-400",
      bg: activeAlertCount > 0
        ? "bg-red-500/10 border-red-500/20"
        : "bg-emerald-500/10 border-emerald-500/20",
      trend: activeAlertCount > 0 ? "Immediate response needed" : "All sites clear",
      trendUp: activeAlertCount === 0,
    },
  ]

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Situational Overview</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Real-time monitoring across all trains and mining sites
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-emerald-400 font-medium">All systems live</span>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className={`rounded-lg border p-4 space-y-3 ${s.bg}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">{s.label}</span>
              <s.icon className={`h-4 w-4 ${s.color}`} />
            </div>
            <div>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{s.sub}</p>
            </div>
            <div className="flex items-center gap-1">
              <TrendingUp className={`h-3 w-3 ${s.trendUp ? "text-emerald-400" : "text-red-400"}`} />
              <span className={`text-[10px] ${s.trendUp ? "text-emerald-400" : "text-red-400"}`}>{s.trend}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* Recent Alerts — live from Firebase */}
        <div className="xl:col-span-2 rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              <h2 className="text-sm font-semibold text-foreground">Recent Alerts</h2>
            </div>
            <Badge variant="secondary" className="text-[10px]">Firebase Live</Badge>
          </div>

          {recentAlerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-xs">Loading alert history…</span>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentAlerts.map((alert, i) => (
                <div key={alert.id} className="px-5 py-3.5 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono text-muted-foreground">
                          ALT-{String(i + 1).padStart(3, "0")}
                        </span>
                        <Badge variant="danger" className="text-[10px] px-1.5 py-0">PANIC</Badge>
                        <Badge
                          variant={statusBadge[alert.alertStatus] ?? "secondary"}
                          className="text-[10px] px-1.5 py-0 capitalize"
                        >
                          {alert.alertStatus}
                        </Badge>
                        {alert.gps_status && (
                          <span className={`flex items-center gap-1 text-[10px] ${signalColor[alert.gps_status] ?? "text-muted-foreground"}`}>
                            <Satellite className="h-3 w-3" />
                            GPS {alert.gps_status}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-foreground mt-1 truncate">
                        {alert.site_label}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {formatCoords(alert.lat, alert.lng)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
                      <Clock className="h-3 w-3" />
                      {timeAgo(alert.timestamp)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Site Status — live from Firebase */}
        <div className="rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-violet-400" />
              <h2 className="text-sm font-semibold text-foreground">Site Status</h2>
            </div>
            <Badge variant="secondary" className="text-[10px]">Live</Badge>
          </div>

          {sites.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-xs">Connecting…</span>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {sites.map((site) => (
                <div key={site.id} className="px-5 py-3.5 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-muted-foreground uppercase">
                          {site.id}
                        </span>
                        <span className="text-[10px] text-muted-foreground border border-border rounded px-1">
                          Train Unit
                        </span>
                      </div>
                      <p className="text-xs font-medium text-foreground mt-0.5 truncate">
                        {site.label}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Last GPS: {timeAgo(site.gps?.updated ?? site.last_alert)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 ml-2 shrink-0">
                      <span className={`text-xs font-bold ${site.alert ? "text-red-400" : "text-emerald-400"}`}>
                        {site.alert ? "ALERT" : "Standby"}
                      </span>
                      <span className={`text-[10px] capitalize ${signalColor[site.gps?.status ?? "fallback"] ?? "text-muted-foreground"}`}>
                        GPS {site.gps?.status ?? "unknown"}
                      </span>
                    </div>
                  </div>
                  {site.gps?.status === "live" && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {parseFloat(site.gps.speed_kmh ?? "0").toFixed(0)} km/h
                      · {formatCoords(site.gps.lat, site.gps.lng)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="px-5 py-3 border-t border-border">
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <CheckCircle2 className="h-3 w-3 text-emerald-400" />
              <span>{sites.filter((s) => !s.alert).length} of {sites.length} site{sites.length !== 1 ? "s" : ""} clear</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
