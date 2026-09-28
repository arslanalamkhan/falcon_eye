import { useState } from "react"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Plus, Loader2 } from "lucide-react"
import { FormField, EntityTable, DepartmentBadge } from "./shared"
import type { Receiver, DepartmentRow } from "./types"

export function ReceiversPanel({ receivers, onRefresh, isSuper, currentDeptId, departments }: {
  receivers: Receiver[]; onRefresh: () => void; isSuper: boolean; currentDeptId: number
  departments: DepartmentRow[]
}) {
  const emptyForm = { id: '', label: '', lea: '', city: '', department_id: String(currentDeptId) }
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [formErr, setFormErr] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormErr('')
    setSaving(true)
    try {
      await api.post('/api/admin/receivers', { ...form, department_id: isSuper ? Number(form.department_id) : undefined })
      setForm({ ...emptyForm, department_id: form.department_id })
      onRefresh()
    } catch (err) {
      setFormErr(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  const del = async (id: string) => {
    setDeleting(id)
    try { await api.delete(`/api/admin/receivers/${id}`); onRefresh() }
    catch { /* ignore */ }
    finally { setDeleting(null) }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Plus className="h-4 w-4 text-primary" /> Add HQ Receiver
        </h3>
        <form onSubmit={submit} className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <FormField label="Receiver ID" value={form.id} onChange={v => setForm(f => ({ ...f, id: v }))} placeholder="isi_rawalpindi" required mono />
          <FormField label="Label" value={form.label} onChange={v => setForm(f => ({ ...f, label: v }))} placeholder="ISI HQ Rawalpindi" required />
          <FormField label="LEA / Agency" value={form.lea} onChange={v => setForm(f => ({ ...f, lea: v }))} placeholder="ISI" />
          <FormField label="City" value={form.city} onChange={v => setForm(f => ({ ...f, city: v }))} placeholder="Rawalpindi" />
          {isSuper && (
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Department</label>
              <select
                value={form.department_id}
                onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {departments.map(d => <option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}
              </select>
            </div>
          )}
          <div className="col-span-2 md:col-span-4 flex items-center gap-3">
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
              Add Receiver
            </Button>
            {formErr && <p className="text-xs text-destructive">{formErr}</p>}
          </div>
        </form>
      </div>

      <EntityTable
        columns={['Receiver ID', 'Label', 'LEA', 'City', 'Department', 'Created By']}
        rows={receivers.map(r => ({
          key: r.id,
          cells: [
            <code className="text-[11px] text-primary">{r.id}</code>,
            r.label,
            r.lea  || '—',
            r.city || '—',
            <DepartmentBadge code={r.department_code} />,
            r.owner_name || '—',
          ],
        }))}
        onDelete={del}
        deletingId={deleting}
        canDelete={(id) => {
          const r = receivers.find(x => x.id === id)
          return isSuper || r?.department_id === currentDeptId
        }}
      />
    </div>
  )
}
