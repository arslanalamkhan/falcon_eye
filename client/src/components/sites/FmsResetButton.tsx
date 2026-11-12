import { useEffect, useRef } from "react"
import { RotateCcw, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button, type ButtonProps } from "@/components/ui/button"
import { useConfirm } from "@/hooks/useConfirm"
import { useFmsCommands } from "@/hooks/useFmsCommands"
import { useNow } from "@/hooks/useNow"
import { cn, errorMessage } from "@/lib/utils"
import type { FmsCommand } from "@/types/fms"

function elapsedLabel(since: string, now: number): string {
  const s = Math.max(0, Math.round((now - new Date(since).getTime()) / 1000))
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`
}

function PendingLabel({ since }: { since: string }) {
  const now = useNow(1_000)
  return <>Reset sent — waiting for terminal… {elapsedLabel(since, now)}</>
}

/**
 * Remote alarm reset for one satellite (FMS) site. Only meaningful while the
 * site is in alert (super admins reset outside an alert from the admin test
 * wizard). Command status is only fetched while it matters.
 */
export function FmsResetButton({ siteId, siteLabel, alert, size = "default", variant = "default", className }: {
  siteId: string
  siteLabel: string
  alert: boolean
  size?: ButtonProps["size"]
  variant?: ButtonProps["variant"]
  className?: string
}) {
  const confirm = useConfirm()
  const { status, pendingReset, reset } = useFmsCommands(siteId, alert)
  const tracked = useRef<number | null>(null)
  const sending = useRef(false)

  // Toast once when a reset we saw pending reaches a final state
  useEffect(() => {
    if (pendingReset) { tracked.current = pendingReset.id; return }
    const id = tracked.current
    if (id === null) return
    const cmd: FmsCommand | undefined = status?.commands.find((c) => c.id === id)
    if (!cmd || cmd.status === "pending") return
    tracked.current = null
    if (cmd.status === "completed") {
      toast.success("Alarm reset delivered", {
        description: cmd.description ?? `${siteLabel}: the terminal confirmed the reset. Receivers are being silenced.`,
      })
    } else {
      toast.error(cmd.status === "timed_out" ? "Reset got no response" : "Reset failed", {
        description: cmd.description ?? "The terminal did not confirm the reset. The alarm is still active.",
      })
    }
  }, [pendingReset, status, siteLabel])

  // Alert cleared while a reset was pending: the terminal confirmed it
  useEffect(() => {
    if (!alert && tracked.current !== null) {
      tracked.current = null
      toast.success("Alarm reset delivered", { description: `${siteLabel} is back to standby.` })
    }
  }, [alert, siteLabel])

  if (!alert && !pendingReset) return null

  const onClick = async () => {
    if (sending.current) return
    const ok = await confirm({
      title: `Reset the alarm on ${siteLabel}?`,
      description:
        "This sends a reset command to the satellite terminal. Routed receivers are silenced once the terminal confirms, usually within 1–3 minutes. Only do this once the incident has been handled.",
      confirmLabel: "Send reset",
    })
    if (!ok) return
    sending.current = true
    try {
      await reset()
      toast.success("Reset sent", { description: "Waiting for the terminal to confirm — usually 1–3 minutes." })
    } catch (err) {
      toast.error("Couldn't send reset", { description: errorMessage(err) })
    } finally {
      sending.current = false
    }
  }

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      className={cn("min-h-9", className)}
      disabled={!!pendingReset}
      onClick={onClick}
    >
      {pendingReset ? (
        <>
          <Loader2 className="animate-spin" />
          <span className="min-w-0 truncate"><PendingLabel since={pendingReset.created_at} /></span>
        </>
      ) : (
        <><RotateCcw /> Reset alarm</>
      )}
    </Button>
  )
}
