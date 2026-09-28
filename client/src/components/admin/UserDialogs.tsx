import { useState } from "react"
import { toast } from "sonner"
import { UserPlus, KeyRound, Eye, EyeOff } from "lucide-react"
import { api } from "@/lib/api"
import { errorMessage } from "@/lib/utils"
import { ROLE_LABELS, type Role } from "@/types/access"
import { Button } from "@/components/ui/button"
import { Input, Select, Field } from "@/components/ui/input"
import {
  Dialog, DialogContent, DialogHeader, DialogBody, DialogFooter, DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import type { DepartmentRow, UserRow } from "./types"

const ROLE_HELP: Record<Role, string> = {
  super_admin: "Full access to every department (head department only).",
  dept_admin:  "Manages this department's users, sites, receivers and routing.",
  supervisor:  "Sees every site in the department. Read-only.",
  operator:    "Sees only the sites you grant. Read-only.",
}

function PasswordInput({ value, onChange, autoComplete = "new-password" }: {
  value: string; onChange: (v: string) => void; autoComplete?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <Input
      type={show ? "text" : "password"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      autoComplete={autoComplete}
      minLength={8}
      required
      trailing={
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      }
    />
  )
}

export function AddUserDialog({ open, onOpenChange, isSuper, currentDeptId, departments, assignableRoles, onCreated }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  isSuper: boolean
  currentDeptId: number
  departments: DepartmentRow[]
  assignableRoles: Role[]
  onCreated: (user: UserRow) => void
}) {
  const empty = { full_name: "", email: "", password: "", role: "operator" as Role, department_id: String(currentDeptId) }
  const [form, setForm]     = useState(empty)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState("")

  const close = () => { setForm(empty); setError(""); setSaving(false); onOpenChange(false) }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.password.length < 8) { setError("Password must be at least 8 characters"); return }
    setError("")
    setSaving(true)
    try {
      const created = await api.post<UserRow>("/api/users", { ...form, department_id: isSuper ? Number(form.department_id) : undefined })
      const dept = departments.find((d) => d.id === created.department_id)
      toast.success(`${form.full_name} added`, {
        description: form.role === "operator" ? "Now choose which sites they can see." : `Share their sign-in details securely.`,
      })
      onCreated({ ...created, department_code: dept?.code ?? "" })
      close()
    } catch (err) {
      setError(errorMessage(err, "Couldn't add user"))
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close() }}>
      <DialogContent size="lg">
        <form onSubmit={submit} className="flex min-h-0 flex-col">
          <DialogHeader icon={UserPlus}>
            <DialogTitle>Add user</DialogTitle>
            <DialogDescription>Create an account. There's no self sign-up — share the credentials securely.</DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" required>
              <Input value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} placeholder="Ali Khan" required autoFocus />
            </Field>
            <Field label="Email" required>
              <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="ali@department.gov.pk" autoComplete="off" required />
            </Field>
            <Field label="Temporary password" hint="At least 8 characters" required>
              <PasswordInput value={form.password} onChange={(v) => setForm((f) => ({ ...f, password: v }))} />
            </Field>
            <Field label="Role" hint={ROLE_HELP[form.role]}>
              <Select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}>
                {assignableRoles.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </Select>
            </Field>
            {isSuper && (
              <Field label="Department" className="sm:col-span-2">
                <Select value={form.department_id} onChange={(e) => setForm((f) => ({ ...f, department_id: e.target.value }))}>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}
                </Select>
              </Field>
            )}
            {error && <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger sm:col-span-2">{error}</p>}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>Cancel</Button>
            <Button type="submit" loading={saving}>Add user</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function ResetPasswordDialog({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const [password, setPassword] = useState("")
  const [confirm, setConfirm]   = useState("")
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState("")

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) { setError("Password must be at least 8 characters"); return }
    if (password !== confirm) { setError("Passwords do not match"); return }
    setError("")
    setSaving(true)
    try {
      await api.patch(`/api/users/${user.id}/password`, { newPassword: password })
      toast.success(`Password reset for ${user.full_name}`)
      onClose()
    } catch (err) {
      setError(errorMessage(err, "Couldn't reset password"))
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent size="sm">
        <form onSubmit={submit} className="flex min-h-0 flex-col">
          <DialogHeader icon={KeyRound}>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>Set a new password for {user.full_name}.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <Field label="New password" hint="At least 8 characters" required>
              <PasswordInput value={password} onChange={setPassword} />
            </Field>
            <Field label="Confirm password" error={error || undefined} required>
              <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={saving}>Set password</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
