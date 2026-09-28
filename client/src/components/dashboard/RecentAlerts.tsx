import { Link } from "react-router-dom"
import { History, ShieldCheck, Satellite, MapPin } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { SkeletonRows } from "@/components/ui/skeleton"
import { useNow } from "@/hooks/useNow"
import { formatCoords, formatDateTime, timeAgo } from "@/lib/format"
import type { AlertEntry } from "@/hooks/useFirebaseData"

/** Timeline of the latest panic events across visible sites. */
export function RecentAlerts({ alerts, loading, className }: { alerts: AlertEntry[]; loading: boolean; className?: string }) {
  const now = useNow()

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle icon={History}>Recent alerts</CardTitle>
        <span className="text-xs text-muted-foreground">Last 90 days</span>
      </CardHeader>

      {loading ? (
        <SkeletonRows rows={5} className="p-5" />
      ) : alerts.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          tone="success"
          title="No panic alerts recorded"
          description="Alerts from your sites will appear here the moment a panic button is pressed."
        />
      ) : (
        <ol className="max-h-[32rem] overflow-y-auto px-4 py-2 sm:px-5">
          {alerts.map((a, i) => {
            const active = a.alertStatus === "active"
            return (
              <li key={a.id} className="relative flex gap-4 pb-1">
                {/* Timeline rail */}
                <div className="relative flex w-3 shrink-0 justify-center" aria-hidden>
                  {i < alerts.length - 1 && <span className="absolute top-5 h-full w-px bg-border" />}
                  <span className={cn(
                    "relative mt-3.5 h-3 w-3 rounded-full border-2",
                    active ? "border-danger bg-danger shadow-glow-danger" : "border-muted-foreground/40 bg-card"
                  )} />
                </div>

                <Link
                  to={`/map?site=${encodeURIComponent(a.site_id)}`}
                  className="group -mx-2 mb-1 min-w-0 flex-1 rounded-lg px-2 py-2.5 transition-colors hover:bg-accent/50"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium text-foreground group-hover:text-primary">{a.site_label || a.site_id}</p>
                    <Badge variant={active ? "danger" : "outline"} size="sm" dot={active ? "pulse" : undefined}>
                      {active ? "Active" : "Resolved"}
                    </Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <time dateTime={a.timestamp} title={formatDateTime(a.timestamp)} className="font-medium text-foreground/80">
                      {timeAgo(a.timestamp, now)}
                    </time>
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{formatCoords(a.lat, a.lng)}</span>
                    {a.gps_status && (
                      <span className={cn("flex items-center gap-1", a.gps_status === "live" ? "text-success" : "text-warning")}>
                        <Satellite className="h-3 w-3" />{a.gps_status === "live" ? "Live GPS" : "Last known"}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            )
          })}
        </ol>
      )}
    </Card>
  )
}
