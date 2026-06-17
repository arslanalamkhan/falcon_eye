import { useEffect, useState, useCallback } from "react"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  GitBranch, Train, HardHat, Radio, Plus, Trash2,
  Loader2, Check, X, RefreshCw, AlertCircle,
} from "lucide-react"

// ── Types ─────────────────────────────────────────────────────────
type Site = {
  id: string; label: string; type: string; region: string; active: boolean
}
type Receiver = {
  id: string; label: string; lea: string; city: string; active: boolean
}
type AdminData = { sites: Site[]; receivers: Receiver[]; routes: { site_id: string; receiver_id: string }[] }

type RouteKey = string   // `${siteId}:${receiverId}`

// ── Helpers ───────────────────────────────────────────────────────
const TAB_IDS = ['matrix', 'sites', 'receivers'] as const
type Tab = typeof TAB_IDS[number]

const SITE_TYPE_ICON = { train: Train, mine: HardHat, other: Radio }

function siteIcon(type: string) {
  const Icon = SITE_TYPE_ICON[type as keyof typeof SITE_TYPE_ICON] ?? Radio
  return <Icon className="h-3.5 w-3.5" />
}

function rk(siteId: string, receiverId: string): RouteKey { return `${siteId}:${receiverId}` }

// ── Main component ────────────────────────────────────────────────
export default function Admin() {
  const [tab, setTab]           = useState<Tab>('matrix')
  const [data, setData]         = useState<AdminData | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [activeRoutes, setActiveRoutes] = useState<Set<RouteKey>>(new Set())
  const [busyCells, setBusyCells]       = useState<Set<RouteKey>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const d = await api.get<AdminData>('/api/admin/data')
      setData(d)
      setActiveRoutes(new Set(d.routes.map(r => rk(r.site_id, r.receiver_id))))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // ── Route toggle ─────────────────────────────────────────────
  const toggleRoute = async (siteId: string, receiverId: string) => {
    const key = rk(siteId, receiverId)
    if (busyCells.has(key)) return

    const wasActive = activeRoutes.has(key)
    setBusyCells(p => new Set(p).add(key))
    // optimistic
    setActiveRoutes(prev => {
      const s = new Set(prev)
      wasActive ? s.delete(key) : s.add(key)
      return s
    })
    try {
      if (wasActive) await api.delete(`/api/admin/routes/${siteId}/${receiverId}`)
      else           await api.put(`/api/admin/routes/${siteId}/${receiverId}`)
    } catch {
      // revert optimistic update
      setActiveRoutes(prev => {
        const s = new Set(prev)
        wasActive ? s.add(key) : s.delete(key)
        return s
      })
    } finally {
      setBusyCells(p => { const s = new Set(p); s.delete(key); return s })
    }
  }

  if (loading) return (
    <div className="flex h-64 items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span className="text-sm">Loading configuration…</span>
    </div>
  )

  if (error) return (
    <div className="flex h-64 flex-col items-center justify-center gap-3 text-destructive">
      <AlertCircle className="h-6 w-6" />
      <p className="text-sm">{error}</p>
      <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-3.5 w-3.5 mr-1.5" />Retry</Button>
    </div>
  )

  const { sites, receivers } = data!

  return (
    <div className="space-y-5">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Admin Panel</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage alert routing, sites, and HQ receivers
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border gap-1">
        {[
          { id: 'matrix',    label: 'Routing Matrix', icon: GitBranch },
          { id: 'sites',     label: 'Sites',          icon: Train      },
          { id: 'receivers', label: 'HQ Receivers',   icon: Radio      },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id as Tab)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
            {id === 'sites'     && <CountBadge n={sites.length} />}
            {id === 'receivers' && <CountBadge n={receivers.length} />}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'matrix'    && <RoutingMatrix sites={sites} receivers={receivers} activeRoutes={activeRoutes} busyCells={busyCells} onToggle={toggleRoute} />}
      {tab === 'sites'     && <SitesPanel    sites={sites}     onRefresh={load} />}
      {tab === 'receivers' && <ReceiversPanel receivers={receivers} onRefresh={load} />}
    </div>
  )
}

function CountBadge({ n }: { n: number }) {
  return (
    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">{n}</span>
  )
}

// ── Routing Matrix ─────────────────────────────────────────────────
function RoutingMatrix({ sites, receivers, activeRoutes, busyCells, onToggle }: {
  sites: Site[]; receivers: Receiver[]
  activeRoutes: Set<RouteKey>; busyCells: Set<RouteKey>
  onToggle: (siteId: string, receiverId: string) => void
}) {
  const activeCount = activeRoutes.size

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Click a cell to enable or disable that route. Changes sync to Firebase immediately.&nbsp;
        <span className="text-foreground font-medium">{activeCount} active route{activeCount !== 1 ? 's' : ''}</span>.
      </p>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">

          {/* Header: receiver columns */}
          <thead className="bg-muted/30">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground w-52">
                Site → Receiver
              </th>
              {receivers.map(r => (
                <th key={r.id} className="px-3 py-3 text-center min-w-[130px]">
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-xs font-semibold text-foreground truncate max-w-[120px]">{r.label}</span>
                    <span className="text-[10px] text-muted-foreground">{r.city}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          {/* Rows: one per site */}
          <tbody className="divide-y divide-border">
            {sites.map((site, i) => (
              <tr key={site.id} className={i % 2 === 0 ? '' : 'bg-muted/10'}>

                {/* Site label cell */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{siteIcon(site.type)}</span>
                    <div>
                      <p className="text-xs font-medium text-foreground">{site.label}</p>
                      <p className="text-[10px] font-mono text-muted-foreground">{site.id}</p>
                    </div>
                  </div>
                </td>

                {/* Toggle cells */}
                {receivers.map(r => {
                  const key     = rk(site.id, r.id)
                  const enabled = activeRoutes.has(key)
                  const busy    = busyCells.has(key)
                  return (
                    <td key={r.id} className="px-3 py-3 text-center">
                      <button
                        onClick={() => onToggle(site.id, r.id)}
                        disabled={busy}
                        title={enabled ? 'Click to disable route' : 'Click to enable route'}
                        className={cn(
                          "mx-auto flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all",
                          enabled
                            ? "border-emerald-500 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
                            : "border-border bg-transparent text-muted-foreground/40 hover:border-muted-foreground hover:text-muted-foreground",
                          busy && "opacity-60 cursor-wait"
                        )}
                      >
                        {busy
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : enabled
                            ? <Check className="h-3.5 w-3.5" />
                            : <X className="h-3 w-3" />
                        }
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Sites Panel ────────────────────────────────────────────────────
function SitesPanel({ sites, onRefresh }: { sites: Site[]; onRefresh: () => void }) {
  const [form, setForm] = useState({ id: '', label: '', type: 'train', region: '' })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [formErr, setFormErr] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormErr('')
    setSaving(true)
    try {
      await api.post('/api/admin/sites', form)
      setForm({ id: '', label: '', type: 'train', region: '' })
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
      {/* Add form */}
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
          <div className="col-span-2 md:col-span-4 flex items-center gap-3">
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
              Add Site
            </Button>
            {formErr && <p className="text-xs text-destructive">{formErr}</p>}
          </div>
        </form>
      </div>

      {/* Sites table */}
      <EntityTable
        columns={['Site ID', 'Label', 'Type', 'Region']}
        rows={sites.map(s => ({
          key: s.id,
          cells: [
            <code className="text-[11px] text-primary">{s.id}</code>,
            s.label,
            <Badge variant={s.type === 'train' ? 'info' : 'warning'} className="text-[10px]">{s.type}</Badge>,
            s.region || '—',
          ],
        }))}
        onDelete={del}
        deletingId={deleting}
      />
    </div>
  )
}

// ── Receivers Panel ────────────────────────────────────────────────
function ReceiversPanel({ receivers, onRefresh }: { receivers: Receiver[]; onRefresh: () => void }) {
  const [form, setForm] = useState({ id: '', label: '', lea: '', city: '' })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [formErr, setFormErr] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormErr('')
    setSaving(true)
    try {
      await api.post('/api/admin/receivers', form)
      setForm({ id: '', label: '', lea: '', city: '' })
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
      {/* Add form */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Plus className="h-4 w-4 text-primary" /> Add HQ Receiver
        </h3>
        <form onSubmit={submit} className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <FormField label="Receiver ID" value={form.id} onChange={v => setForm(f => ({ ...f, id: v }))} placeholder="isi_rawalpindi" required mono />
          <FormField label="Label" value={form.label} onChange={v => setForm(f => ({ ...f, label: v }))} placeholder="ISI HQ Rawalpindi" required />
          <FormField label="LEA / Agency" value={form.lea} onChange={v => setForm(f => ({ ...f, lea: v }))} placeholder="ISI" />
          <FormField label="City" value={form.city} onChange={v => setForm(f => ({ ...f, city: v }))} placeholder="Rawalpindi" />
          <div className="col-span-2 md:col-span-4 flex items-center gap-3">
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
              Add Receiver
            </Button>
            {formErr && <p className="text-xs text-destructive">{formErr}</p>}
          </div>
        </form>
      </div>

      {/* Receivers table */}
      <EntityTable
        columns={['Receiver ID', 'Label', 'LEA', 'City']}
        rows={receivers.map(r => ({
          key: r.id,
          cells: [
            <code className="text-[11px] text-primary">{r.id}</code>,
            r.label,
            r.lea  || '—',
            r.city || '—',
          ],
        }))}
        onDelete={del}
        deletingId={deleting}
      />
    </div>
  )
}

// ── Shared sub-components ──────────────────────────────────────────
function FormField({ label, value, onChange, placeholder, required, mono }: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; required?: boolean; mono?: boolean
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className={cn(
          "h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary",
          mono && "font-mono"
        )}
      />
    </div>
  )
}

function EntityTable({ columns, rows, onDelete, deletingId }: {
  columns: string[]
  rows: { key: string; cells: React.ReactNode[] }[]
  onDelete: (id: string) => void
  deletingId: string | null
}) {
  if (rows.length === 0) return (
    <div className="rounded-lg border border-border py-12 text-center text-sm text-muted-foreground">
      No entries yet.
    </div>
  )
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/30">
          <tr>
            {columns.map(c => (
              <th key={c} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">{c}</th>
            ))}
            <th className="px-4 py-2.5 w-10" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map(({ key, cells }) => (
            <tr key={key} className="hover:bg-muted/20 transition-colors">
              {cells.map((cell, i) => (
                <td key={i} className="px-4 py-3 text-foreground">{cell}</td>
              ))}
              <td className="px-4 py-3 text-right">
                <button
                  onClick={() => onDelete(key)}
                  disabled={deletingId === key}
                  className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                >
                  {deletingId === key
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Trash2 className="h-3.5 w-3.5" />}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
