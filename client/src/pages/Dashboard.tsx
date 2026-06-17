import { Badge } from "@/components/ui/badge"
import {
  AlertTriangle,
  Train,
  HardHat,
  Shield,
  Radio,
  MapPin,
  Clock,
  TrendingUp,
  CheckCircle2,
} from "lucide-react"

const stats = [
  {
    label: "Active Alerts",
    value: "3",
    sub: "2 critical · 1 warning",
    icon: AlertTriangle,
    color: "text-red-400",
    bg: "bg-red-500/10 border-red-500/20",
    trend: "+2 in last hour",
    trendUp: true,
  },
  {
    label: "Trains Online",
    value: "12",
    sub: "of 14 total",
    icon: Train,
    color: "text-primary",
    bg: "bg-primary/10 border-primary/20",
    trend: "2 offline",
    trendUp: false,
  },
  {
    label: "Mining Sites",
    value: "5",
    sub: "All sites reporting",
    icon: HardHat,
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
    trend: "Normal ops",
    trendUp: true,
  },
  {
    label: "QRF Units",
    value: "8",
    sub: "4 on standby · 4 deployed",
    icon: Shield,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
    trend: "Response ready",
    trendUp: true,
  },
  {
    label: "Active Devices",
    value: "47",
    sub: "ESP32 nodes online",
    icon: Radio,
    color: "text-violet-400",
    bg: "bg-violet-500/10 border-violet-500/20",
    trend: "3 low battery",
    trendUp: false,
  },
  {
    label: "Avg Response",
    value: "4.2m",
    sub: "Target < 5 min",
    icon: Clock,
    color: "text-cyan-400",
    bg: "bg-cyan-500/10 border-cyan-500/20",
    trend: "-0.8m this week",
    trendUp: true,
  },
]

const recentAlerts = [
  {
    id: "ALT-001",
    site: "Khewra Mine – Sector 3",
    type: "PANIC",
    severity: "critical",
    time: "2 min ago",
    status: "active",
    responder: "QRF Unit Alpha",
    coords: "32.6519° N, 73.0065° E",
  },
  {
    id: "ALT-002",
    site: "Pakistan Railways – Lahore Express",
    type: "PANIC",
    severity: "critical",
    time: "11 min ago",
    status: "responding",
    responder: "QRF Unit Bravo",
    coords: "31.5204° N, 74.3587° E",
  },
  {
    id: "ALT-003",
    site: "Saindak Copper Mine – Zone B",
    type: "DEVICE",
    severity: "warning",
    time: "38 min ago",
    status: "resolved",
    responder: "Site Supervisor",
    coords: "29.5678° N, 62.3456° E",
  },
  {
    id: "ALT-004",
    site: "Pakistan Railways – Karakoram",
    type: "CONNECTIVITY",
    severity: "warning",
    time: "1h 5m ago",
    status: "resolved",
    responder: "Auto-restored",
    coords: "33.7215° N, 72.9781° E",
  },
]

const deviceNodes = [
  { id: "ESP-001", site: "Lahore Junction", type: "Panic Box", battery: 87, signal: "strong", last: "2s ago" },
  { id: "ESP-002", site: "Khewra Mine Entry", type: "Panic Box", battery: 12, signal: "weak", last: "8s ago" },
  { id: "ESP-003", site: "QRF Base Rawalpindi", type: "Receiver", battery: 94, signal: "strong", last: "1s ago" },
  { id: "ESP-004", site: "Saindak Site Office", type: "Panic Box", battery: 63, signal: "medium", last: "5s ago" },
  { id: "ESP-005", site: "QRF Base Quetta", type: "Receiver", battery: 78, signal: "strong", last: "3s ago" },
]

const severityBadge: Record<string, "danger" | "warning" | "success"> = {
  critical: "danger",
  warning: "warning",
  info: "success",
}

const statusBadge: Record<string, "danger" | "warning" | "success" | "secondary"> = {
  active: "danger",
  responding: "warning",
  resolved: "success",
}

const signalColor: Record<string, string> = {
  strong: "text-emerald-400",
  medium: "text-amber-400",
  weak: "text-red-400",
}

const batteryColor = (v: number) =>
  v > 50 ? "text-emerald-400" : v > 20 ? "text-amber-400" : "text-red-400"

export default function Dashboard() {
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
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
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

        {/* Recent Alerts */}
        <div className="xl:col-span-2 rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              <h2 className="text-sm font-semibold text-foreground">Recent Alerts</h2>
            </div>
            <Badge variant="secondary" className="text-[10px]">Last 24h</Badge>
          </div>
          <div className="divide-y divide-border">
            {recentAlerts.map((alert) => (
              <div key={alert.id} className="px-5 py-3.5 hover:bg-muted/30 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-mono text-muted-foreground">{alert.id}</span>
                      <Badge variant={severityBadge[alert.severity] ?? "secondary"} className="text-[10px] px-1.5 py-0">
                        {alert.type}
                      </Badge>
                      <Badge variant={statusBadge[alert.status] ?? "secondary"} className="text-[10px] px-1.5 py-0 capitalize">
                        {alert.status}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium text-foreground mt-1 truncate">{alert.site}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Shield className="h-3 w-3" /> {alert.responder}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <MapPin className="h-3 w-3" /> {alert.coords}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
                    <Clock className="h-3 w-3" />
                    {alert.time}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Device Nodes */}
        <div className="rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-violet-400" />
              <h2 className="text-sm font-semibold text-foreground">Device Nodes</h2>
            </div>
            <Badge variant="secondary" className="text-[10px]">ESP32</Badge>
          </div>
          <div className="divide-y divide-border">
            {deviceNodes.map((d) => (
              <div key={d.id} className="px-5 py-3.5 hover:bg-muted/30 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-muted-foreground">{d.id}</span>
                      <span className="text-[10px] text-muted-foreground border border-border rounded px-1">
                        {d.type}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-foreground mt-0.5 truncate">{d.site}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Last ping: {d.last}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 ml-2 shrink-0">
                    <span className={`text-xs font-bold ${batteryColor(d.battery)}`}>
                      {d.battery}%
                    </span>
                    <span className={`text-[10px] capitalize ${signalColor[d.signal]}`}>
                      {d.signal}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="px-5 py-3 border-t border-border">
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <CheckCircle2 className="h-3 w-3 text-emerald-400" />
              <span>44 of 47 nodes healthy</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
