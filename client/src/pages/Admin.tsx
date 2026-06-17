import { useEffect, useState, useCallback } from "react"
import { api } from "@/lib/api"
import { useAuth } from "@/contexts/AuthContext"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose,
} from "@/components/ui/dialog"
import {
  GitBranch, Train, HardHat, Radio, Plus, Trash2, Camera,
  Loader2, Check, X, RefreshCw, AlertCircle, Users, ShieldCheck, KeyRound,
} from "lucide-react"
import type { Role } from "@/contexts/AuthContext"

// ── Types ─────────────────────────────────────────────────────────
type Site = {
  id: string; label: string; type: string; region: string; active: boolean
}
type Receiver = {
  id: string; label: string; lea: string; city: string; active: boolean
}
type CameraRow = {
  id: number; site_id: string; label: string; ip: string; port: number
  channel: number; subtype: number; active: boolean; site_label: string; site_type: string
}
type UserRow = {
  id: number; email: string; full_name: string; role: Role; created_at: string
}
type AdminData = { sites: Site[]; receivers: Receiver[]; routes: { site_id: string; receiver_id: string }[] }

type RouteKey = string   // `${siteId}:${receiverId}`

// ── Helpers ───────────────────────────────────────────────────────
const TAB_IDS = ['matrix', 'sites', 'receivers', 'cameras', 'users'] as const
type Tab = typeof TAB_IDS[number]

const SITE_TYPE_ICON = { train: Train, mine: HardHat, other: Radio }

function siteIcon(type: string) {
  const Icon = SITE_TYPE_ICON[type as keyof typeof SITE_TYPE_ICON] ?? Radio
  return <Icon className="h-3.5 w-3.5" />
}

function rk(siteId: string, receiverId: string): RouteKey { return `${siteId}:${receiverId}` }

const ROLE_LABELS: Record<Role, string> = {
  admin:      'Admin',
  supervisor: 'Supervisor',
  operator:   'Operator',
}

const ROLE_BADGE_VARIANT: Record<Role, 'danger' | 'warning' | 'info'> = {
  admin:      'danger',
  supervisor: 'warning',
  operator:   'info',
}

// ── Main component ────────────────────────────────────────────────
export default function Admin() {
  const { user } = useAuth()
  const isAdmin  = user?.role === 'admin'

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
    setActiveRoutes(prev => {
      const s = new Set(prev)
      wasActive ? s.delete(key) : s.add(key)
      return s
    })
    try {
      if (wasActive) await api.delete(`/api/admin/routes/${siteId}/${receiverId}`)
      else           await api.put(`/api/admin/routes/${siteId}/${receiverId}`)
    } catch {
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

  const tabs = [
    { id: 'matrix',    label: 'Routing Matrix', icon: GitBranch },
    { id: 'sites',     label: 'Sites',          icon: Train      },
    { id: 'receivers', label: 'HQ Receivers',   icon: Radio      },
    { id: 'cameras',   label: 'Cameras',         icon: Camera     },
    ...(isAdmin ? [{ id: 'users', label: 'Users', icon: Users }] : []),
  ] as const

  return (
    <div className="space-y-5">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Admin Panel</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage alert routing, sites, HQ receivers, and users
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={ROLE_BADGE_VARIANT[user!.role]} className="text-[11px] gap-1.5">
            <ShieldCheck className="h-3 w-3" />
            {ROLE_LABELS[user!.role]}
          </Badge>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border gap-1">
        {tabs.map(({ id, label, icon: Icon }) => (
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
      {tab === 'sites'     && <SitesPanel    sites={sites}     onRefresh={load} isAdmin={isAdmin} />}
      {tab === 'receivers' && <ReceiversPanel receivers={receivers} onRefresh={load} isAdmin={isAdmin} />}
      {tab === 'cameras'   && <CamerasPanel  sites={sites} isAdmin={isAdmin} />}
      {tab === 'users'     && isAdmin && <UsersPanel currentUserId={user!.id} />}
    </div>
  )
}

function CountBadge({ n }: { n: number }) {
  return (
    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">{n}</span>
  )
}

function CameraTabBadge() {
  return (
    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">CAM</span>
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

          <tbody className="divide-y divide-border">
            {sites.map((site, i) => (
              <tr key={site.id} className={i % 2 === 0 ? '' : 'bg-muted/10'}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{siteIcon(site.type)}</span>
                    <div>
                      <p className="text-xs font-medium text-foreground">{site.label}</p>
                      <p className="text-[10px] font-mono text-muted-foreground">{site.id}</p>
                    </div>
                  </div>
                </td>

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
function SitesPanel({ sites, onRefresh, isAdmin }: { sites: Site[]; onRefresh: () => void; isAdmin: boolean }) {
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
      {isAdmin && (
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
      )}

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
        onDelete={isAdmin ? del : undefined}
        deletingId={deleting}
      />
    </div>
  )
}

// ── Receivers Panel ────────────────────────────────────────────────
function ReceiversPanel({ receivers, onRefresh, isAdmin }: { receivers: Receiver[]; onRefresh: () => void; isAdmin: boolean }) {
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
      {isAdmin && (
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
      )}

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
        onDelete={isAdmin ? del : undefined}
        deletingId={deleting}
      />
    </div>
  )
}

// ── Users Panel ────────────────────────────────────────────────────
function UsersPanel({ currentUserId }: { currentUserId: number }) {
  const [users, setUsers]       = useState<UserRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [changingRole, setChangingRole] = useState<number | null>(null)
  const [resetTarget, setResetTarget]   = useState<{ id: number; name: string } | null>(null)
  const [form, setForm]         = useState({ email: '', full_name: '', password: '', role: 'operator' as Role })
  const [saving, setSaving]     = useState(false)
  const [formErr, setFormErr]   = useState('')

  const loadUsers = async () => {
    setLoading(true)
    try {
      const rows = await api.get<UserRow[]>('/api/admin/users')
      setUsers(rows)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadUsers() }, [])

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormErr('')
    setSaving(true)
    try {
      await api.post('/api/admin/users', form)
      setForm({ email: '', full_name: '', password: '', role: 'operator' })
      await loadUsers()
    } catch (err) {
      setFormErr(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  const deleteUser = async (id: number) => {
    setDeleting(id)
    try { await api.delete(`/api/admin/users/${id}`); await loadUsers() }
    catch { /* ignore */ }
    finally { setDeleting(null) }
  }

  const changeRole = async (id: number, role: Role) => {
    setChangingRole(id)
    try {
      await api.patch(`/api/admin/users/${id}/role`, { role })
      setUsers(prev => prev.map(u => u.id === id ? { ...u, role } : u))
    } catch { /* ignore */ }
    finally { setChangingRole(null) }
  }

  return (
    <div className="space-y-5">
      {/* Add user form */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Plus className="h-4 w-4 text-primary" /> Add User
        </h3>
        <form onSubmit={createUser} className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <FormField
            label="Full Name"
            value={form.full_name}
            onChange={v => setForm(f => ({ ...f, full_name: v }))}
            placeholder="Ali Khan"
            required
          />
          <FormField
            label="Email"
            value={form.email}
            onChange={v => setForm(f => ({ ...f, email: v }))}
            placeholder="ali@nacta.gov.pk"
            required
          />
          <FormField
            label="Password"
            value={form.password}
            onChange={v => setForm(f => ({ ...f, password: v }))}
            placeholder="Min. 8 characters"
            required
            type="password"
          />
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Role</label>
            <select
              value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="operator">Operator</option>
              <option value="supervisor">Supervisor</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="col-span-2 md:col-span-4 flex items-center gap-3">
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
              Add User
            </Button>
            {formErr && <p className="text-xs text-destructive">{formErr}</p>}
          </div>
        </form>
      </div>

      {/* Users table */}
      {loading ? (
        <div className="flex h-32 items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading users…</span>
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-lg border border-border py-12 text-center text-sm text-muted-foreground">
          No users yet.
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr>
                {['Name', 'Email', 'Role', 'Joined'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                ))}
                <th className="px-4 py-2.5 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map(u => {
                const isSelf = u.id === currentUserId
                return (
                  <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 text-foreground font-medium">
                      {u.full_name}
                      {isSelf && <span className="ml-2 text-[10px] text-muted-foreground">(you)</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{u.email}</td>
                    <td className="px-4 py-3">
                      {isSelf ? (
                        <Badge variant={ROLE_BADGE_VARIANT[u.role]} className="text-[10px]">
                          {ROLE_LABELS[u.role]}
                        </Badge>
                      ) : (
                        <div className="flex items-center gap-2">
                          <select
                            value={u.role}
                            disabled={changingRole === u.id}
                            onChange={e => changeRole(u.id, e.target.value as Role)}
                            className="h-7 rounded border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                          >
                            <option value="operator">Operator</option>
                            <option value="supervisor">Supervisor</option>
                            <option value="admin">Admin</option>
                          </select>
                          {changingRole === u.id && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {new Date(u.created_at).toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setResetTarget({ id: u.id, name: u.full_name })}
                          className="text-muted-foreground hover:text-primary transition-colors"
                          title="Reset password"
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                        </button>
                        {!isSelf && (
                          <button
                            onClick={() => deleteUser(u.id)}
                            disabled={deleting === u.id}
                            className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                            title="Delete user"
                          >
                            {deleting === u.id
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <Trash2 className="h-3.5 w-3.5" />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {resetTarget && (
        <AdminResetPasswordDialog
          userId={resetTarget.id}
          userName={resetTarget.name}
          onClose={() => setResetTarget(null)}
        />
      )}
    </div>
  )
}

// ── Admin reset-password dialog (no current password needed) ───────
function AdminResetPasswordDialog({ userId, userName, onClose }: {
  userId: number
  userName: string
  onClose: () => void
}) {
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm]         = useState('')
  const [saving, setSaving]           = useState(false)
  const [err, setErr]                 = useState('')
  const [success, setSuccess]         = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirm) { setErr('Passwords do not match'); return }
    setErr('')
    setSaving(true)
    try {
      await api.patch(`/api/admin/users/${userId}/password`, { newPassword })
      setSuccess(true)
      setTimeout(onClose, 1500)
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
          <DialogTitle>Reset Password</DialogTitle>
          <DialogDescription>Set a new password for {userName}</DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="flex items-center gap-2 py-2 text-sm text-emerald-400">
            <Check className="h-4 w-4" /> Password updated successfully
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <FormField label="New Password" value={newPassword} onChange={setNewPassword} type="password" placeholder="Min. 8 characters" required />
            <FormField label="Confirm Password" value={confirm} onChange={setConfirm} type="password" placeholder="Repeat new password" required />
            {err && <p className="text-xs text-destructive">{err}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="h-8 px-3 rounded-md border border-input text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <Button size="sm" type="submit" disabled={saving}>
                {saving
                  ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  : <KeyRound className="h-3.5 w-3.5 mr-1.5" />}
                Set Password
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ── Cameras Panel ──────────────────────────────────────────────────
function CamerasPanel({ sites, isAdmin }: { sites: Site[]; isAdmin: boolean }) {
  const [cameras, setCameras]   = useState<CameraRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [saving, setSaving]     = useState(false)
  const [formErr, setFormErr]   = useState('')
  const [form, setForm] = useState({
    site_id: '', label: 'Camera', ip: '', port: '554',
    username: '', password: '', channel: '1', subtype: '0',
  })

  const loadCameras = async () => {
    setLoading(true)
    try {
      const rows = await api.get<CameraRow[]>('/api/cameras/all')
      setCameras(rows)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadCameras() }, [])

  const addCamera = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormErr('')
    setSaving(true)
    try {
      await api.post('/api/cameras', {
        site_id:  form.site_id,
        label:    form.label,
        ip:       form.ip,
        port:     parseInt(form.port) || 554,
        username: form.username,
        password: form.password,
        channel:  parseInt(form.channel) || 1,
        subtype:  parseInt(form.subtype) || 0,
      })
      setForm({ site_id: form.site_id, label: 'Camera', ip: '', port: '554', username: '', password: '', channel: '1', subtype: '0' })
      await loadCameras()
    } catch (err) {
      setFormErr(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  const del = async (id: number) => {
    setDeleting(id)
    try { await api.delete(`/api/cameras/${id}`); await loadCameras() }
    catch { /* ignore */ }
    finally { setDeleting(null) }
  }

  return (
    <div className="space-y-5">
      {isAdmin && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" /> Add Camera
          </h3>
          <form onSubmit={addCamera} className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Site</label>
              <select
                value={form.site_id}
                onChange={e => setForm(f => ({ ...f, site_id: e.target.value }))}
                required
                className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="" disabled>Select site…</option>
                {sites.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <FormField label="Label" value={form.label} onChange={v => setForm(f => ({ ...f, label: v }))} placeholder="Camera 1" required />
            <FormField label="IP Address" value={form.ip} onChange={v => setForm(f => ({ ...f, ip: v }))} placeholder="192.168.1.100" required mono />
            <FormField label="Port" value={form.port} onChange={v => setForm(f => ({ ...f, port: v }))} placeholder="554" mono />
            <FormField label="Username" value={form.username} onChange={v => setForm(f => ({ ...f, username: v }))} placeholder="admin" required />
            <FormField label="Password" value={form.password} onChange={v => setForm(f => ({ ...f, password: v }))} type="password" placeholder="••••••••" required />
            <FormField label="Channel" value={form.channel} onChange={v => setForm(f => ({ ...f, channel: v }))} placeholder="1" mono />
            <FormField label="Subtype (0=main, 1=sub)" value={form.subtype} onChange={v => setForm(f => ({ ...f, subtype: v }))} placeholder="0" mono />
            <div className="col-span-2 md:col-span-4 flex items-center gap-3">
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
                Add Camera
              </Button>
              {formErr && <p className="text-xs text-destructive">{formErr}</p>}
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="flex h-32 items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading cameras…</span>
        </div>
      ) : cameras.length === 0 ? (
        <div className="rounded-lg border border-border py-12 text-center text-sm text-muted-foreground">
          No cameras configured yet.
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr>
                {['Site', 'Label', 'IP : Port', 'Channel', 'Stream URL'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                ))}
                {isAdmin && <th className="px-4 py-2.5 w-10" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {cameras.map(cam => (
                <tr key={cam.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-xs font-medium text-foreground">{cam.site_label}</p>
                      <p className="text-[10px] font-mono text-muted-foreground">{cam.site_id}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-foreground text-xs">{cam.label}</td>
                  <td className="px-4 py-3 font-mono text-xs text-foreground">{cam.ip}:{cam.port}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">ch{cam.channel} / sub{cam.subtype}</td>
                  <td className="px-4 py-3">
                    <code className="text-[10px] text-muted-foreground bg-muted/40 rounded px-1.5 py-0.5">
                      rtsp://***@{cam.ip}:{cam.port}/…ch{cam.channel}
                    </code>
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => del(cam.id)}
                        disabled={deleting === cam.id}
                        className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                      >
                        {deleting === cam.id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Shared sub-components ──────────────────────────────────────────
function FormField({ label, value, onChange, placeholder, required, mono, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; required?: boolean; mono?: boolean; type?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{label}</label>
      <input
        type={type}
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
  onDelete?: (id: string) => void
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
            {onDelete && <th className="px-4 py-2.5 w-10" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map(({ key, cells }) => (
            <tr key={key} className="hover:bg-muted/20 transition-colors">
              {cells.map((cell, i) => (
                <td key={i} className="px-4 py-3 text-foreground">{cell}</td>
              ))}
              {onDelete && (
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
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
