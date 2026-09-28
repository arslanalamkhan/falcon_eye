import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { KeyRound, LogOut } from "lucide-react"
import { toast } from "sonner"
import { api } from "@/lib/api"
import { initials } from "@/lib/format"
import { useAuth } from "@/contexts/AuthContext"
import { ROLE_LABELS } from "@/types/access"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input, Field } from "@/components/ui/input"
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Dialog, DialogContent, DialogHeader, DialogBody, DialogFooter, DialogTitle, DialogDescription,
} from "@/components/ui/dialog"

export function UserMenu() {
  const { user, department, logout } = useAuth()
  const navigate = useNavigate()
  const [pwOpen, setPwOpen] = useState(false)

  if (!user) return null

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2.5 rounded-lg p-1 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:pr-2.5"
            aria-label="Account menu"
          >
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary/15 text-xs font-bold text-primary ring-1 ring-primary/30">
                {initials(user.full_name || user.email)}
              </AvatarFallback>
            </Avatar>
            <div className="hidden text-left leading-tight lg:block">
              <p className="max-w-[10rem] truncate text-sm font-medium text-foreground">{user.full_name || user.email}</p>
              <p className="text-2xs text-muted-foreground">
                {ROLE_LABELS[user.role]}{department ? ` · ${department.code}` : ""}
              </p>
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-64">
          <div className="px-2.5 py-2">
            <p className="truncate text-sm font-semibold">{user.full_name}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-md border border-primary/25 bg-primary/10 px-1.5 py-px text-2xs font-semibold text-primary">
                {ROLE_LABELS[user.role]}
              </span>
              {department && (
                <span className="rounded-md border border-border bg-muted px-1.5 py-px font-mono text-2xs text-muted-foreground">
                  {department.code}
                </span>
              )}
            </div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem icon={KeyRound} onSelect={() => setPwOpen(true)}>Change password</DropdownMenuItem>
          <DropdownMenuItem
            icon={LogOut}
            destructive
            onSelect={() => { logout(); navigate("/login", { replace: true }) }}
          >
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ChangePasswordDialog open={pwOpen} onOpenChange={setPwOpen} />
    </>
  )
}

function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [current, setCurrent] = useState("")
  const [next, setNext]       = useState("")
  const [confirm, setConfirm] = useState("")
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState("")

  const close = () => {
    setCurrent(""); setNext(""); setConfirm(""); setError(""); setSaving(false)
    onOpenChange(false)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (next.length < 8) { setError("New password must be at least 8 characters"); return }
    if (next !== confirm) { setError("Passwords do not match"); return }
    setError("")
    setSaving(true)
    try {
      await api.patch("/api/auth/password", { currentPassword: current, newPassword: next })
      toast.success("Password updated")
      close()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update password")
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close() }}>
      <DialogContent size="sm">
        <form onSubmit={submit} className="flex min-h-0 flex-col">
          <DialogHeader icon={KeyRound}>
            <DialogTitle>Change password</DialogTitle>
            <DialogDescription>Confirm your current password, then choose a new one.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <Field label="Current password" required>
              <Input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
            </Field>
            <Field label="New password" hint="At least 8 characters" required>
              <Input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required />
            </Field>
            <Field label="Confirm new password" error={error || undefined} required>
              <Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>Cancel</Button>
            <Button type="submit" loading={saving}>Update password</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
