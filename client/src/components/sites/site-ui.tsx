import { TrainFront, Pickaxe, Radio } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { siteState, siteTypeLabel, type SiteState } from "@/lib/sites"
import type { SiteData } from "@/hooks/useFirebaseData"

const STATE_META: Record<SiteState, { label: string; variant: "danger" | "success" | "warning" | "outline"; dot: string }> = {
  alert:      { label: "ALERT",           variant: "danger",  dot: "bg-danger" },
  live:       { label: "Standby · live GPS", variant: "success", dot: "bg-success" },
  fallback:   { label: "Standby · last known", variant: "warning", dot: "bg-warning" },
  unreported: { label: "Awaiting first report", variant: "outline", dot: "bg-muted-foreground/50" },
}

export function SiteStatusBadge({ site, compact }: { site: SiteData; compact?: boolean }) {
  const state = siteState(site)
  const meta = STATE_META[state]
  const label = compact
    ? state === "alert" ? "ALERT" : state === "unreported" ? "No data" : state === "live" ? "Live" : "Last known"
    : meta.label
  return (
    <Badge variant={meta.variant} size="sm" dot={state === "alert" ? "pulse" : true}>
      {label}
    </Badge>
  )
}

export function SiteStateDot({ site, className }: { site: SiteData; className?: string }) {
  const state = siteState(site)
  return (
    <span className={cn("relative flex h-2.5 w-2.5 shrink-0", className)} aria-hidden>
      {state === "alert" && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-70" />}
      <span className={cn("relative inline-flex h-2.5 w-2.5 rounded-full", STATE_META[state].dot)} />
    </span>
  )
}

const TYPE_ICON = { train: TrainFront, mine: Pickaxe, other: Radio } as const
/** Rounded tile with the site-type icon; turns red when the site is in alert. */
export function SiteTypeIcon({ site, className }: { site: SiteData; className?: string }) {
  const Icon = TYPE_ICON[site.type ?? "other"]
  return (
    <div
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
        site.alert ? "border-danger/40 bg-danger/15 text-danger" : "border-border bg-muted/60 text-muted-foreground",
        className
      )}
      title={siteTypeLabel(site.type)}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </div>
  )
}
