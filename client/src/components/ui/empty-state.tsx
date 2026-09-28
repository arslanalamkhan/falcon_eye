import { cn } from "@/lib/utils"

/** Centered icon + message + optional action. Use for empty lists and error states. */
function EmptyState({ icon: Icon, title, description, action, tone = "default", className }: {
  icon: React.ElementType
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  tone?: "default" | "danger" | "success"
  className?: string
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 px-6 py-12 text-center", className)}>
      <div
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-2xl border",
          tone === "danger"  && "border-danger/25 bg-danger/10 text-danger",
          tone === "success" && "border-success/25 bg-success/10 text-success",
          tone === "default" && "border-border bg-muted/50 text-muted-foreground"
        )}
      >
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description && <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="pt-1">{action}</div>}
    </div>
  )
}

export { EmptyState }
