import { useState } from "react"
import { toast } from "sonner"
import { FlaskConical } from "lucide-react"
import { errorMessage } from "@/lib/utils"
import { useConfirm } from "@/hooks/useConfirm"
import { useFmsCommands } from "@/hooks/useFmsCommands"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog, DialogContent, DialogHeader, DialogBody, DialogFooter, DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import { StepIndicator, CommandHistory, DeliveryStatus } from "./fmsTestParts"
import type { Site } from "./types"

const DONE = 5   // step index after the five guided steps

const COPY: Record<number, { title: string; body: string }> = {
  0: { title: "Turn on test mode", body: "While test mode is on, pressing the panic button sends a TEST message instead of a real alert. No receiver will buzz." },
  1: { title: "Press the Master Box panic button", body: "Ask on-site personnel to press the panic button on the Master Box. The test alert appears in the activity feed as a test (SSAS_Test). It can take a few minutes to arrive over satellite." },
  2: { title: "Send the reset", body: "Send ResetSsasToNormal to the terminal so it returns to normal after the test. This works even though no real alarm is active." },
  3: { title: "Confirm delivery", body: "FMS reports when the terminal has received the reset." },
  4: { title: "Turn off test mode", body: "Restore normal operation. Until test mode is off, real panic presses will not raise alerts." },
  5: { title: "Test complete", body: "Test mode is off and the terminal is back to normal. If the site has a Slave Box, repeat the procedure for it." },
}

/** Guided "Test SSAS Procedure" for one satellite site (super admin only). */
export function FmsTestDialog({ site, onClose, onChanged }: {
  site: Site | null; onClose: () => void; onChanged: () => void
}) {
  const open = site !== null
  const confirm = useConfirm()
  const fms = useFmsCommands(site?.id ?? null, open)
  const { status, pendingReset } = fms
  const [explicit, setExplicit] = useState<number | null>(null)
  const [resetId, setResetId]   = useState<number | null>(null)
  const [busy, setBusy]         = useState(false)

  // Until the admin acts, resume from what the terminal is already doing.
  const derived = pendingReset ? 3 : status?.test_mode ? 1 : 0
  const step = explicit ?? derived
  const resetCmd = status?.commands.find((c) => c.id === (resetId ?? pendingReset?.id)) ?? null
  const delivered = resetCmd?.status === "completed"
  const retryable = resetCmd !== null && resetCmd.status !== "pending" && !delivered

  const run = async (action: () => Promise<number | void>, next: number, success: string) => {
    setBusy(true)
    try {
      const id = await action()
      if (typeof id === "number") setResetId(id)
      toast.success(success)
      setExplicit(next)
      onChanged()
    } catch (err) {
      toast.error("Command failed", { description: errorMessage(err) })
    } finally {
      setBusy(false)
    }
  }

  const sendReset = () => run(async () => (await fms.reset()).id, 3, "Reset sent to terminal")

  const finish = () => { setExplicit(null); setResetId(null); onClose() }

  const requestClose = async () => {
    if (status?.test_mode && step !== DONE) {
      const turnOff = await confirm({
        title: "Leave test mode on?",
        description: "Real panic presses won't raise alerts until it's turned off. Turn it off now?",
        confirmLabel: "Turn test mode off",
        cancelLabel: "Leave on",
      })
      if (turnOff) {
        try { await fms.setTestMode(false); onChanged(); toast.success("Test mode off") }
        catch (err) { toast.error("Couldn't turn test mode off", { description: errorMessage(err) }); return }
      }
    }
    finish()
  }

  const copy = COPY[step]
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) void requestClose() }}>
      <DialogContent size="lg">
        <DialogHeader icon={FlaskConical}>
          <DialogTitle>SSAS test{site ? `: ${site.label}` : ""}</DialogTitle>
          <DialogDescription>Guided test of the terminal's panic button and remote reset.</DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {!status ? (
            fms.error
              ? <p className="text-sm text-danger" role="alert">{fms.error}</p>
              : <Skeleton className="h-32 w-full" />
          ) : (
            <>
              {step < DONE && <StepIndicator step={step} />}
              <div className="space-y-1">
                <p className="text-sm font-semibold">{copy.title}</p>
                <p className="text-sm text-muted-foreground">{copy.body}</p>
              </div>
              {step === 1 && <CommandHistory commands={status.commands} />}
              {step === 3 && <DeliveryStatus command={resetCmd} />}
            </>
          )}
        </DialogBody>

        <DialogFooter>
          {status && step === 0 && (
            <Button loading={busy} onClick={() => run(() => fms.setTestMode(true).then(() => undefined), 1, "Test mode on")}>Turn on test mode</Button>
          )}
          {status && step === 1 && <Button onClick={() => setExplicit(2)}>Button pressed, continue</Button>}
          {status && step === 2 && <Button loading={busy} onClick={sendReset}>Send reset</Button>}
          {status && step === 3 && retryable && <Button variant="outline" loading={busy} onClick={sendReset}>Retry reset</Button>}
          {status && step === 3 && (
            <Button disabled={!delivered && !retryable} variant={delivered ? "default" : "ghost"} onClick={() => setExplicit(4)}>
              {delivered ? "Continue" : "Skip delivery check"}
            </Button>
          )}
          {status && step === 4 && (
            <Button loading={busy} onClick={() => run(() => fms.setTestMode(false).then(() => undefined), DONE, "Test mode off")}>Turn off test mode</Button>
          )}
          {status && step === DONE && (
            <>
              <Button variant="outline" onClick={() => { setExplicit(0); setResetId(null) }}>Repeat for Slave Box</Button>
              <Button onClick={finish}>Done</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
