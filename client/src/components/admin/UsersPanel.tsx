import { useState, useEffect } from "react"
import { api } from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import { Plus, Trash2, Loader2, Check, KeyRound, MapPin } from "lucide-react"
import { FormField } from "./shared"
import { ROLE_LABELS } from "@/types/access"
import type { Role } from "@/types/access"
import { ROLE_BADGE_VARIANT } from "./shared"
import { SiteAccessDialog } from "./SiteAccessDialog"
import type { UserRow, Site, DepartmentRow } from "./types"

export function UsersPanel({ currentUserId, isSuper, currentDeptId, departments, sites }: {
  currentUserId: number; isSuper: boolean; currentDeptId: number
  departments: DepartmentRow[]; sites: Site[]
}) {
  const [users, setUsers]       = useState<UserRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [busyId, setBusyId]     = useState<number | null>(null)
  const [resetTarget, setResetTarget]   = useState<{ id: number; name: string } | null>(null)
  const [sitesTarget, setSitesTarget]   = useState<{ id: number; name: string; deptId: number } | null>(null)
  const [form, setForm] = useState({ email: '', full_name: '', password: '', role: 'operator' as Role, department_id: String(currentDeptId) })
  const [saving, setSaving]     = useState(false)
  const [formErr, setFormErr]   = useState('')

  const assignableRoles: Role[] = isSuper
    ? ['super_admin', 'dept_admin', 'supervisor', 'operator']
    : ['dept_admin', 'supervisor', 'operator']

  const loadUsers = async () => {
    setLoading(true)
    try {
      const rows = await api.get<UserRow[]>('/api/users')
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
      await api.post('/api/users', { ...form, department_id: isSuper ? Number(form.department_id) : undefined })
      setForm(f => ({ ...f, email: '', full_name: '', password: '' }))
      await loadUsers()
    } catch (err) {
      setFormErr(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  const deleteUser = async (id: number) => {
    setDeleting(id)
    try { await api.delete(`/api/users/${id}`); await loadUsers() }
    catch { /* ignore */ }
    finally { setDeleting(null) }
  }

  const changeRole = async (id: number, role: Role) => {
    setBusyId(id)
    try {
      await api.patch(`/api/users/${id}`, { role })
      setUsers(prev => prev.map(u => u.id === id ? { ...u, role } : u))
    } catch { /* ignore */ }
    finally { setBusyId(null) }
  }

  const toggleActive = async (id: number, active: boolean) => {
    setBusyId(id)
    try {
      await api.patch(`/api/users/${id}`, { active })
      setUsers(prev => prev.map(u => u.id === id ? { ...u, active } : u))
    } catch { /* ignore */ }
    finally { setBusyId(null) }
  }

  return (
    <div className="space-y-5">
      {/* Add user form */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Plus className="h-4 w-4 text-primary" /> Add User
        </h3>
        <form onSubmit={createUser} className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <FormField label="Full Name" value={form.full_name} onChange={v => setForm(f => ({ ...f, full_name: v }))} placeholder="Ali Khan" required />
          <FormField label="Email" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} placeholder="ali@nacta.gov.pk" required />
          <FormField label="Password" value={form.password} onChange={v => setForm(f => ({ ...f, password: v }))} placeholder="Min. 8 characters" required type="password" />
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Role</label>
            <select
              value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {assignableRoles.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>
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
                {['Name', 'Email', 'Role', ...(isSuper ? ['Department'] : []), 'Active', 'Joined'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                ))}
                <th className="px-4 py-2.5 w-28" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map(u => {
                const isSelf = u.id === currentUserId
                // Only a super admin may edit another super admin
                const isLocked = u.role === 'super_admin' && !isSuper
                return (
                  <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 text-foreground font-medium">
                      {u.full_name}
                      {isSelf && <span className="ml-2 text-[10px] text-muted-foreground">(you)</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{u.email}</td>
                    <td className="px-4 py-3">
                      {isSelf || isLocked ? (
                        <Badge variant={ROLE_BADGE_VARIANT[u.role]} className="text-[10px]">
                          {ROLE_LABELS[u.role]}
                        </Badge>
                      ) : (
                        <div className="flex items-center gap-2">
                          <select
                            value={u.role}
                            disabled={busyId === u.id}
                            onChange={e => changeRole(u.id, e.target.value as Role)}
                            className="h-7 rounded border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                          >
                            {assignableRoles.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                          </select>
                          {busyId === u.id && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                        </div>
                      )}
                    </td>
                    {isSuper && (
                      <td className="px-4 py-3">
                        <Badge variant="info" className="text-[10px] font-mono">{u.department_code}</Badge>
                      </td>
                    )}
                    <td className="px-4 py-3">
                      {isSelf || isLocked ? (
                        <Badge variant={u.active ? 'success' : 'warning'} className="text-[10px]">{u.active ? 'Active' : 'Inactive'}</Badge>
                      ) : (
                        <button
                          onClick={() => toggleActive(u.id, !u.active)}
                          disabled={busyId === u.id}
                          className="disabled:opacity-50"
                          title={u.active ? 'Deactivate' : 'Activate'}
                        >
                          <Badge variant={u.active ? 'success' : 'warning'} className="text-[10px] cursor-pointer">
                            {u.active ? 'Active' : 'Inactive'}
                          </Badge>
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {new Date(u.created_at).toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {u.role === 'operator' && (
                          <button
                            onClick={() => setSitesTarget({ id: u.id, name: u.full_name, deptId: u.department_id })}
                            className="text-muted-foreground hover:text-primary transition-colors"
                            title="Site access"
                          >
                            <MapPin className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {!isLocked && (
                          <button
                            onClick={() => setResetTarget({ id: u.id, name: u.full_name })}
                            className="text-muted-foreground hover:text-primary transition-colors"
                            title="Reset password"
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {!isSelf && !isLocked && (
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

      {sitesTarget && (
        <SiteAccessDialog
          userId={sitesTarget.id}
          userName={sitesTarget.name}
          candidateSites={sites.filter(s => s.department_id === sitesTarget.deptId)}
          onClose={() => setSitesTarget(null)}
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
      await api.patch(`/api/users/${userId}/password`, { newPassword })
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
