import { useState } from "react"
import { api } from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Plus, Loader2, Satellite } from "lucide-react"
import { FormField, EntityTable, DepartmentBadge } from "./shared"
import type { Site, DepartmentRow } from "./types"

export function SitesPanel({ sites, onRefresh, isSuper, currentDeptId, departments }: {
  sites: Site[]; onRefresh: () => void; isSuper: boolean; currentDeptId: number
  departments: DepartmentRow[]
}) {
  const emptyForm = { id: '', label: '', type: 'train', region: '', source: 'cellular', mobile_id: '', imo: '', mmsi: '', department_id: String(currentDeptId) }
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [formErr, setFormErr] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormErr('')
    setSaving(true)
    try {
      await api.post('/api/admin/sites', { ...form, department_id: isSuper ? Number(form.department_id) : undefined })
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
    try { await api.delete(`/api/admin/sites/${id}`); onRefresh() }
    catch { /* ignore */ }
    finally { setDeleting(null) }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Plus className="h-4 w-4 text-primary" /> Add Site
        </h3>
        <form onSubmit={submit} className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <FormField label="Site ID" value={form.id} onChange={v => setForm(f => ({ ...f, id: v }))} placeholder="khyber_express" required mono />
          <FormField label="Label" value={form.label} onChange={v => setForm(f => ({ ...f, label: v }))} placeholder="Khyber Express" required />
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Type</label>
            <select
              value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="train">Train</option>
              <option value="mine">Mining Site</option>
              <option value="other">Other</option>
            </select>
          </div>
          <FormField label="Region" value={form.region} onChange={v => setForm(f => ({ ...f, region: v }))} placeholder="KP/Punjab" />
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
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Tracking Hardware</label>
            <select
              value={form.source}
              onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="cellular">Cellular (ESP32 panic button)</option>
              <option value="satellite_fms">Satellite (Falcon Mega Track)</option>
            </select>
          </div>
          {form.source === 'satellite_fms' && (
            <>
              <FormField label="Mobile ID" value={form.mobile_id} onChange={v => setForm(f => ({ ...f, mobile_id: v }))} placeholder="01398397SKY12AE" required mono />
              <FormField label="IMO (optional)" value={form.imo} onChange={v => setForm(f => ({ ...f, imo: v }))} placeholder="rarely set on ground terminals" mono />
              <FormField label="MMSI (optional)" value={form.mmsi} onChange={v => setForm(f => ({ ...f, mmsi: v }))} placeholder="rarely set on ground terminals" mono />
              <p className="col-span-2 md:col-span-4 text-[11px] text-muted-foreground -mt-1">
                Mobile ID is the terminal's own hardware serial (shown as "MobileID" in Falcon Mega Track's data) and is required to match incoming reports to this site. IMO/MMSI are optional — these terminals report placeholder values for them, not real ship identifiers.
              </p>
            </>
          )}
          <div className="col-span-2 md:col-span-4 flex items-center gap-3">
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
              Add Site
            </Button>
            {formErr && <p className="text-xs text-destructive">{formErr}</p>}
          </div>
        </form>
      </div>

      <EntityTable
        columns={['Site ID', 'Label', 'Type', 'Source', 'Region', 'Department', 'Created By']}
        rows={sites.map(s => ({
          key: s.id,
          cells: [
            <code className="text-[11px] text-primary">{s.id}</code>,
            s.label,
            <Badge variant={s.type === 'train' ? 'info' : 'warning'} className="text-[10px]">{s.type}</Badge>,
            s.source === 'satellite_fms'
              ? <Badge variant="info" className="text-[10px] gap-1"><Satellite className="h-2.5 w-2.5" />Satellite</Badge>
              : <span className="text-[11px] text-muted-foreground">Cellular</span>,
            s.region || '—',
            <DepartmentBadge code={s.department_code} />,
            s.owner_name || '—',
          ],
        }))}
        onDelete={del}
        deletingId={deleting}
        canDelete={(id) => {
          const s = sites.find(x => x.id === id)
          return isSuper || s?.department_id === currentDeptId
        }}
      />
    </div>
  )
}
