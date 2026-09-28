import { useNavigate } from "react-router-dom"
import { Bell, BellRing, ShieldCheck, ArrowUpRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { useNow } from "@/hooks/useNow"
import { timeAgo } from "@/lib/format"
import type { AlertEvent } from "@/hooks/useAlertNotification"

/** Live list of sites currently in alert. Selecting one opens it on the map. */
export function AlertBell({ alerts }: { alerts: AlertEvent[] }) {
  const navigate = useNavigate()
  const now = useNow()
  const count = alerts.length

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("relative", count > 0 && "text-danger hover:bg-danger/10 hover:text-danger")}
          aria-label={count > 0 ? `${count} active alert${count === 1 ? "" : "s"}` : "No active alerts"}
        >
          {count > 0 ? <BellRing className="animate-alert-flash" /> : <Bell />}
          {count > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-2xs font-bold leading-none text-danger-foreground ring-2 ring-background">
              {count}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Active alerts</span>
          {count > 0 && <span className="font-mono text-danger">{count}</span>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {count === 0 ? (
          <div className="flex items-center gap-3 px-2.5 py-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-success/10 text-success">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-medium">All clear</p>
              <p className="text-xs text-muted-foreground">No panic alerts at your sites.</p>
            </div>
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {alerts.map((a) => (
              <DropdownMenuItem
                key={a.siteId}
                onSelect={() => navigate(`/map?site=${encodeURIComponent(a.siteId)}`)}
                className="items-start py-2.5"
              >
                <span className="relative mt-1.5 flex h-2 w-2 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-70" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-danger" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{a.siteLabel}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.department && <span className="font-mono">{a.department} · </span>}
                    {timeAgo(a.triggeredAt, now)}
                  </p>
                </div>
                <ArrowUpRight className="mt-0.5 h-4 w-4 text-muted-foreground" />
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
