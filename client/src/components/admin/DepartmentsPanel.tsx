import { useState } from "react"
import { api } from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import { Plus, Loader2, Pencil, Building2 } from "lucide-react"
import { FormField } from "./shared"
import type { DepartmentRow } from "./types"
import type { ViewScope } from "@/types/access"

const SCOPE_LABELS: Record<ViewScope, string> = {
  own: 'Own sites only', all: 'All departments', selected: 'Own + selected departments',
}

export function DepartmentsPanel({ departments, onRefresh }: { departments: DepartmentRow[]; onRefresh: () => void }) {
  const emptyForm = {
    code: '', name: '', view_scope: 'own' as ViewScope, target_ids: [] as number[],
    admin_email: '', admin_name: '', admin_password: '',
  }
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving]   = useState(false)
  const [formErr, setFormErr] = useState('')
  const [editTarget, setEditTarget] = useState<DepartmentRow | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormErr('')
    setSaving(true)
    try {
      await api.post('/api/departments', {
        code: form.code, name: form.name, view_scope: form.view_scope,
        target_ids: form.view_scope === 'selected' ? form.target_ids : undefined,
        admin: { email: form.admin_email, full_name: form.admin_name, password: form.admin_password },
      })
      setForm(emptyForm)
      onRefresh()
    } catch (err) {
      setFormErr(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  const toggleTarget = (id: number) => {
    setForm(f => ({
      ...f,
      target_ids: f.target_ids.includes(id) ? f.target_ids.filter(t => t !== id) : [...f.target_ids, id],
    }))
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Plus className="h-4 w-4 text-primary" /> Add Department
        </h3>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <FormField label="Code" value={form.code} onChange={v => setForm(f => ({ ...f, code: v.toUpperCase() }))} placeholder="RAIL" required mono />
            <FormField label="Name" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="Pakistan Railways" required />
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">View Scope</label>
              <select
                value={form.view_scope}
                onChange={e => setForm(f => ({ ...f, view_scope: e.target.value as ViewScope }))}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="own">Own sites only</option>
                <option value="all">All departments</option>
                <option value="selected">Own + selected</option>
              </select>
            </div>
          </div>

          {form.view_scope === 'selected' && (
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Oversees</label>
              <div className="flex flex-wrap gap-2">
                {departments.map(d => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => toggleTarget(d.id)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                      form.target_ids.includes(d.id)
                        ? 'border-primary bg-primary/15 text-primary'
                        : 'border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {d.code}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1 border-t border-border">
            <div className="col-span-2 md:col-span-4 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground pt-2">First Department Admin</div>
            <FormField label="Admin Full Name" value={form.admin_name} onChange={v => setForm(f => ({ ...f, admin_name: v }))} placeholder="Ali Khan" required />
            <FormField label="Admin Email" value={form.admin_email} onChange={v => setForm(f => ({ ...f, admin_email: v }))} placeholder="ali@railways.gov.pk" required />
            <FormField label="Admin Password" value={form.admin_password} onChange={v => setForm(f => ({ ...f, admin_password: v }))} placeholder="Min. 8 characters" required type="password" />
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
              Create Department
            </Button>
            {formErr && <p className="text-xs text-destructive">{formErr}</p>}
          </div>
        </form>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30">
            <tr>
              {['Department', 'View Scope', 'Users', 'Sites', 'Receivers', 'Status'].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">{h}</th>
              ))}
              <th className="px-4 py-2.5 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {departments.map(d => (
              <tr key={d.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                    <div>
                      <p className="text-xs font-medium text-foreground">{d.name}</p>
                      <p className="text-[10px] font-mono text-muted-foreground">
                        {d.code}{d.is_head && <span className="ml-1.5 text-primary">HEAD</span>}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {SCOPE_LABELS[d.view_scope]}
                  {d.view_scope === 'selected' && d.oversight_targets.length > 0 && (
                    <span className="block text-[10px]">→ {d.oversight_targets.map(t => t.code).join(', ')}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{d.user_count}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{d.site_count}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{d.receiver_count}</td>
                <td className="px-4 py-3">
                  <Badge variant={d.active ? 'success' : 'warning'} className="text-[10px]">{d.active ? 'Active' : 'Inactive'}</Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => setEditTarget(d)}
                    className="text-muted-foreground hover:text-primary transition-colors"
                    title="Edit department"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editTarget && (
        <EditDepartmentDialog
          department={editTarget}
          allDepartments={departments}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); onRefresh() }}
        />
      )}
    </div>
  )
}

function EditDepartmentDialog({ department, allDepartments, onClose, onSaved }: {
  department: DepartmentRow; allDepartments: DepartmentRow[]; onClose: () => void; onSaved: () => void
}) {
  const [name, setName]           = useState(department.name)
  const [scope, setScope]         = useState<ViewScope>(department.view_scope)
  const [targets, setTargets]     = useState<number[]>(department.oversight_targets.map(t => t.id))
  const [active, setActive]       = useState(department.active)
  const [saving, setSaving]       = useState(false)
  const [err, setErr]             = useState('')

  const toggleTarget = (id: number) => {
    setTargets(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id])
  }

  const save = async () => {
    setErr('')
    setSaving(true)
    try {
      await api.patch(`/api/departments/${department.id}`, {
        name, view_scope: scope,
        target_ids: scope === 'selected' ? targets : [],
        active,
      })
      onSaved()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {department.code}</DialogTitle>
          <DialogDescription>Update scope, oversight, and status</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <FormField label="Name" value={name} onChange={setName} required />

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">View Scope</label>
            <select
              value={scope}
              disabled={department.is_head}
              onChange={e => setScope(e.target.value as ViewScope)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
            >
              <option value="own">Own sites only</option>
              <option value="all">All departments</option>
              <option value="selected">Own + selected</option>
            </select>
          </div>

          {scope === 'selected' && (
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Oversees</label>
              <div className="flex flex-wrap gap-2">
                {allDepartments.filter(d => d.id !== department.id).map(d => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => toggleTarget(d.id)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                      targets.includes(d.id)
                        ? 'border-primary bg-primary/15 text-primary'
                        : 'border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {d.code}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!department.is_head && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} className="h-4 w-4 accent-primary" />
              Department active
            </label>
          )}

          {err && <p className="text-xs text-destructive">{err}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="h-8 px-3 rounded-md border border-input text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
