import { useCallback, useRef, useState, type ReactNode } from "react"
import { TriangleAlert, CircleHelp } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import { ConfirmContext, type ConfirmOptions } from "@/contexts/ConfirmContext"

/**
 * App-wide confirmation dialog. Components call `await confirm({...})`
 * (via hooks/useConfirm) and get `true` only if the user confirms —
 * replaces silent one-click deletes throughout the admin panel.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<((ok: boolean) => void) | null>(null)

  const confirm = useCallback((opts: ConfirmOptions) => {
    setOptions(opts)
    return new Promise<boolean>((resolve) => { resolver.current = resolve })
  }, [])

  const settle = (ok: boolean) => {
    resolver.current?.(ok)
    resolver.current = null
    setOptions(null)
  }

  const destructive = options?.destructive ?? false

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={options !== null} onOpenChange={(open) => { if (!open) settle(false) }}>
        <DialogContent size="sm" hideClose>
          <DialogHeader
            icon={destructive ? TriangleAlert : CircleHelp}
            iconClassName={destructive ? "border-danger/25 bg-danger/10 text-danger" : undefined}
            className="pr-5"
          >
            <DialogTitle>{options?.title}</DialogTitle>
            {options?.description && <DialogDescription>{options.description}</DialogDescription>}
          </DialogHeader>
          <DialogFooter className="mt-3">
            <Button variant="outline" onClick={() => settle(false)}>
              {options?.cancelLabel ?? "Cancel"}
            </Button>
            <Button variant={destructive ? "destructive" : "default"} onClick={() => settle(true)} autoFocus>
              {options?.confirmLabel ?? "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  )
}
