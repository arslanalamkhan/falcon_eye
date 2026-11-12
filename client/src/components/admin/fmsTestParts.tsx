import { CheckCircle2, CircleAlert, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { timeAgo } from "@/lib/format"
import { useNow } from "@/hooks/useNow"
import { Badge } from "@/components/ui/badge"
import { FMS_COMMAND_LABELS, FMS_STATUS_LABELS, type FmsCommand } from "@/types/fms"

const TEST_STEPS = ["Enable", "Press", "Reset", "Delivery", "Disable"] as const

/** Compact stepper: numbered dots, labels from `sm` up. */
export function StepIndicator({ step }: { step: number }) {
  return (
    <ol className="flex items-center gap-1.5" aria-label="Test procedure progress">
      {TEST_STEPS.map((label, i) => {
        const done = i < step
        const current = i === step
        return (
          <li key={label} className="flex min-w-0 flex-1 flex-col gap-1" aria-current={current ? "step" : undefined}>
            <span className={cn("h-1 rounded-full", done || current ? "bg-primary" : "bg-muted", current && "animate-pulse")} />
            <span className={cn("hidden truncate text-2xs sm:block", current ? "font-semibold text-foreground" : "text-muted-foreground")}>
              {i + 1}. {label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

const TONE: Record<FmsCommand["status"], "warning" | "success" | "danger"> = {
  pending: "warning", completed: "success", failed: "danger", timed_out: "danger",
}

/** Last few commands for the terminal, newest first. */
export function CommandHistory({ commands }: { commands: FmsCommand[] }) {
  const now = useNow()
  if (commands.length === 0) return <p className="text-xs text-muted-foreground">No commands sent in the last 24 hours.</p>
  return (
    <ul className="divide-y divide-border rounded-lg border border-border">
      {commands.slice(0, 4).map((c) => (
        <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
          <span className="min-w-0 truncate">
            {FMS_COMMAND_LABELS[c.kind]} <span className="text-muted-foreground">· {timeAgo(c.created_at, now)}</span>
          </span>
          <Badge variant={TONE[c.status]} size="sm" dot={c.status === "pending" ? "pulse" : undefined}>
            {FMS_STATUS_LABELS[c.status]}
          </Badge>
        </li>
      ))}
    </ul>
  )
}

/** Live delivery state of the reset command (step 4). */
export function DeliveryStatus({ command }: { command: FmsCommand | null }) {
  if (!command || command.status === "pending") {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-warning/25 bg-warning/10 p-3 text-sm" role="status">
        <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-warning" aria-hidden />
        <div>
          <p className="font-medium">Waiting for the terminal</p>
          <p className="text-xs text-muted-foreground">
            The reset travels over satellite. Delivery is usually confirmed within 1 to 3 minutes{command?.forward_status ? ` (FMS: ${command.forward_status})` : ""}.
          </p>
        </div>
      </div>
    )
  }
  const ok = command.status === "completed"
  const Icon = ok ? CheckCircle2 : CircleAlert
  return (
    <div className={cn("flex items-start gap-3 rounded-lg border p-3 text-sm", ok ? "border-success/25 bg-success/10" : "border-danger/25 bg-danger/10")} role="status">
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", ok ? "text-success" : "text-danger")} aria-hidden />
      <div>
        <p className="font-medium">{ok ? "Reset delivered (RECEIVED)" : command.status === "timed_out" ? "No response from the terminal" : "Reset failed"}</p>
        {command.description && <p className="text-xs text-muted-foreground">{command.description}</p>}
      </div>
    </div>
  )
}
