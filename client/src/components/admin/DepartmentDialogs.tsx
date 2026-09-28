import { useState } from "react"
import { toast } from "sonner"
import { Building2, Pencil, Check } from "lucide-react"
import { api } from "@/lib/api"
import { cn, errorMessage } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input, Field } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  Dialog, DialogContent, DialogHeader, DialogBody, DialogFooter, DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import { SCOPE_META } from "./scope"
import type { DepartmentRow } from "./types"
import type { ViewScope } from "@/types/access"

function ScopePicker({ value, onChange, disabled }: { value: ViewScope; onChange: (v: ViewScope) => void; disabled?: boolean }) {
  return (
    <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="View scope">
      {(["own", "selected", "all"] as ViewScope[]).map((v) => {
        const meta = SCOPE_META[v]
        const active = value === v
        return (
          <label
            key={v}
            className={cn(
              "flex cursor-pointer flex-col gap-1 rounded-lg border p-3 transition-colors",
              active ? "border-primary/50 bg-primary/10" : "border-border hover:bg-accent/40",
              disabled && "cursor-not-allowed opacity-60"
            )}
          >
            <input type="radio" name="view_scope" className="sr-only" checked={active} disabled={disabled} onChange={() => onChange(v)} />
            <span className="flex items-center gap-2 text-sm font-medium">
              <meta.icon className={cn("h-4 w-4", active ? "text-primary" : "text-muted-foreground")} /> {meta.label}
            </span>
            <span className="text-xs text-muted-foreground">{meta.description}</span>
          </label>
        )
      })}
    </div>
  )
}

function TargetPicker({ options, value, onChange }: { options: DepartmentRow[]; value: number[]; onChange: (v: number[]) => void }) {
  if (options.length === 0) return <p className="text-xs text-muted-foreground">No other departments exist yet.</p>
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((d) => {
        const on = value.includes(d.id)
        return (
          <button
            key={d.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((t) => t !== d.id) : [...value, d.id])}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              on ? "border-primary/40 bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground"
            )}
            title={d.name}
          >
            {on && <Check className="h-3.5 w-3.5" />}
            <span className="font-mono">{d.code}</span>
          </button>
        )
      })}
    </div>
  )
}

export function CreateDepartmentDialog({ open, onOpenChange, departments, onCreated }: {
  open: boolean; onOpenChange: (open: boolean) => void; departments: DepartmentRow[]; onCreated: () => void
}) {
  const empty = { code: "", name: "", view_scope: "own" as ViewScope, target_ids: [] as number[], admin_name: "", admin_email: "", admin_password: "" }
  const [form, setForm]     = useState(empty)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState("")

  const close = () => { setForm(empty); setError(""); setSaving(false); onOpenChange(false) }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.admin_password.length < 8) { setError("Admin password must be at least 8 characters"); return }
    setError("")
    setSaving(true)
    try {
      await api.post("/api/departments", {
        code: form.code, name: form.name, view_scope: form.view_scope,
        target_ids: form.view_scope === "selected" ? form.target_ids : undefined,
        admin: { email: form.admin_email, full_name: form.admin_name, password: form.admin_password },
      })
      toast.success(`${form.code.toUpperCase()} created`, { description: `${form.admin_name} can now sign in as its administrator.` })
      onCreated()
      close()
    } catch (err) {
      setError(errorMessage(err, "Couldn't create department"))
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close() }}>
      <DialogContent size="xl">
        <form onSubmit={submit} className="flex min-h-0 flex-col">
          <DialogHeader icon={Building2}>
            <DialogTitle>New department</DialogTitle>
            <DialogDescription>Create the department and its first administrator in one step.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-6">
            <section className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">1 · Department</h3>
              <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
                <Field label="Code" hint="Short, unique" required>
                  <Input mono value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="RAIL" maxLength={12} required autoFocus />
                </Field>
                <Field label="Name" required>
                  <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Pakistan Railways" required />
                </Field>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-foreground/90">What can this department see?</p>
                <ScopePicker value={form.view_scope} onChange={(v) => setForm((f) => ({ ...f, view_scope: v }))} />
              </div>
              {form.view_scope === "selected" && (
                <div className="space-y-2 animate-in fade-in-0">
                  <p className="text-xs font-medium text-foreground/90">Oversees</p>
                  <TargetPicker options={departments} value={form.target_ids} onChange={(v) => setForm((f) => ({ ...f, target_ids: v }))} />
                </div>
              )}
            </section>

            <section className="space-y-4 border-t border-border pt-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">2 · First administrator</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name" required>
                  <Input value={form.admin_name} onChange={(e) => setForm((f) => ({ ...f, admin_name: e.target.value }))} placeholder="Ali Khan" required />
                </Field>
                <Field label="Email" required>
                  <Input type="email" value={form.admin_email} onChange={(e) => setForm((f) => ({ ...f, admin_email: e.target.value }))} placeholder="admin@railways.gov.pk" autoComplete="off" required />
                </Field>
                <Field label="Temporary password" hint="At least 8 characters — share it securely" required className="sm:col-span-2">
                  <Input type="password" value={form.admin_password} onChange={(e) => setForm((f) => ({ ...f, admin_password: e.target.value }))} autoComplete="new-password" minLength={8} required />
                </Field>
              </div>
            </section>

            {error && <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>Cancel</Button>
            <Button type="submit" loading={saving}>Create department</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function EditDepartmentDialog({ department, allDepartments, onClose, onSaved }: {
  department: DepartmentRow; allDepartments: DepartmentRow[]; onClose: () => void; onSaved: () => void
}) {
  const [name, setName]       = useState(department.name)
  const [scope, setScope]     = useState<ViewScope>(department.view_scope)
  const [targets, setTargets] = useState<number[]>(department.oversight_targets.map((t) => t.id))
  const [active, setActive]   = useState(department.active)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState("")

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSaving(true)
    try {
      await api.patch(`/api/departments/${department.id}`, {
        name, view_scope: scope, target_ids: scope === "selected" ? targets : [], active,
      })
      toast.success(`${department.code} updated`)
      onSaved()
    } catch (err) {
      setError(errorMessage(err, "Couldn't save changes"))
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent size="xl">
        <form onSubmit={save} className="flex min-h-0 flex-col">
          <DialogHeader icon={Pencil}>
            <DialogTitle>Edit {department.code}</DialogTitle>
            <DialogDescription>Changes to scope and status apply to every user in the department immediately.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-5">
            <Field label="Name" required>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground/90">View scope</p>
              <ScopePicker value={scope} onChange={setScope} disabled={department.is_head} />
              {department.is_head && <p className="text-xs text-muted-foreground">The head department always sees every department.</p>}
            </div>
            {scope === "selected" && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-foreground/90">Oversees</p>
                <TargetPicker options={allDepartments.filter((d) => d.id !== department.id)} value={targets} onChange={setTargets} />
              </div>
            )}
            {!department.is_head && (
              <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium">Department active</p>
                  <p className="text-xs text-muted-foreground">Inactive departments' users are signed out and can't sign in.</p>
                </div>
                <Switch checked={active} onCheckedChange={setActive} label="Department active" />
              </div>
            )}
            {error && <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={saving}>Save changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
