import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

type Tone = "default" | "danger" | "success" | "warning"

const TONE = {
  default: { card: "",                                     icon: "border-border bg-muted/60 text-muted-foreground", value: "text-foreground", bar: "bg-primary" },
  danger:  { card: "border-danger/40 bg-danger/[0.07]",     icon: "border-danger/30 bg-danger/15 text-danger",       value: "text-danger",     bar: "bg-danger" },
  success: { card: "",                                     icon: "border-success/25 bg-success/10 text-success",     value: "text-foreground", bar: "bg-success" },
  warning: { card: "",                                     icon: "border-warning/25 bg-warning/10 text-warning",     value: "text-foreground", bar: "bg-warning" },
} as const

export function StatCard({ label, value, sub, icon: Icon, tone = "default", progress, loading }: {
  label: string
  value: string | number
  sub?: React.ReactNode
  icon: React.ElementType
  tone?: Tone
  /** 0–1 — renders a thin meter under the value. */
  progress?: number
  loading?: boolean
}) {
  const t = TONE[tone]
  return (
    <div className={cn("rounded-xl border border-border bg-card p-4 shadow-card sm:p-5", t.card)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-muted-foreground sm:text-sm">{label}</p>
        <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border", t.icon)}>
          <Icon className="h-4 w-4" aria-hidden />
        </div>
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-16" />
      ) : (
        <p className={cn("mt-1 text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl", t.value)}>{value}</p>
      )}
      {progress !== undefined && !loading && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted" role="presentation">
          <div className={cn("h-full rounded-full transition-[width] duration-700 ease-out-expo", t.bar)} style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}
      {sub && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}
