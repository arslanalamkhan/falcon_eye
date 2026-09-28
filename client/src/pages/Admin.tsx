import { useEffect, useState, useCallback } from "react"
import { api } from "@/lib/api"
import { useAuth } from "@/contexts/AuthContext"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  GitBranch, Train, Radio, Camera, Users, Building2, ScrollText,
  Loader2, RefreshCw, AlertCircle, ShieldCheck,
} from "lucide-react"
import { ROLE_LABELS } from "@/types/access"
import { ROLE_BADGE_VARIANT, CountBadge } from "@/components/admin/shared"
import { RoutingMatrix } from "@/components/admin/RoutingMatrix"
import { SitesPanel } from "@/components/admin/SitesPanel"
import { ReceiversPanel } from "@/components/admin/ReceiversPanel"
import { CamerasPanel } from "@/components/admin/CamerasPanel"
import { UsersPanel } from "@/components/admin/UsersPanel"
import { DepartmentsPanel } from "@/components/admin/DepartmentsPanel"
import { AuditPanel } from "@/components/admin/AuditPanel"
import type { AdminData, DepartmentRow, RouteKey } from "@/components/admin/types"
import { rk } from "@/components/admin/types"

type Tab = 'departments' | 'matrix' | 'sites' | 'receivers' | 'cameras' | 'users' | 'audit'

export default function Admin() {
  const { user, department } = useAuth()
  const isSuper = user?.role === 'super_admin'
  const currentDeptId = department!.id

  const [tab, setTab]           = useState<Tab>(isSuper ? 'departments' : 'matrix')
  const [data, setData]         = useState<AdminData | null>(null)
  const [departments, setDepartments] = useState<DepartmentRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [activeRoutes, setActiveRoutes] = useState<Set<RouteKey>>(new Set())
  const [busyCells, setBusyCells]       = useState<Set<RouteKey>>(new Set())
  const [deptFilter, setDeptFilter]     = useState<number | 'all'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [d, depts] = await Promise.all([
        api.get<AdminData>('/api/admin/data'),
        isSuper ? api.get<DepartmentRow[]>('/api/departments') : Promise.resolve([]),
      ])
      setData(d)
      setDepartments(depts)
      setActiveRoutes(new Set(d.routes.map(r => rk(r.site_id, r.receiver_id))))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [isSuper])

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

  const { sites: allSites, receivers: allReceivers } = data!
  const sites     = deptFilter === 'all' ? allSites     : allSites.filter(s => s.department_id === deptFilter)
  const receivers = deptFilter === 'all' ? allReceivers : allReceivers.filter(r => r.department_id === deptFilter)

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    ...(isSuper ? [{ id: 'departments' as Tab, label: 'Departments', icon: Building2 }] : []),
    { id: 'matrix',    label: 'Routing Matrix', icon: GitBranch },
    { id: 'sites',     label: 'Sites',          icon: Train      },
    { id: 'receivers', label: 'HQ Receivers',   icon: Radio      },
    { id: 'cameras',   label: 'Cameras',        icon: Camera     },
    { id: 'users',     label: 'Users',          icon: Users      },
    { id: 'audit',     label: 'Audit Log',      icon: ScrollText },
  ]

  return (
    <div className="space-y-5">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Admin Panel</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage departments, alert routing, sites, HQ receivers, and users
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isSuper && (
            <select
              value={deptFilter}
              onChange={e => setDeptFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="h-8 rounded-md border border-input bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Departments</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.code}</option>)}
            </select>
          )}
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
      <div className="flex border-b border-border gap-1 overflow-x-auto">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
              tab === id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
            {id === 'sites'     && <CountBadge n={sites.length} />}
            {id === 'receivers' && <CountBadge n={receivers.length} />}
            {id === 'departments' && <CountBadge n={departments.length} />}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'departments' && isSuper && <DepartmentsPanel departments={departments} onRefresh={load} />}
      {tab === 'matrix'    && <RoutingMatrix sites={sites} receivers={receivers} activeRoutes={activeRoutes} busyCells={busyCells} onToggle={toggleRoute} isSuper={isSuper} currentDeptId={currentDeptId} />}
      {tab === 'sites'     && <SitesPanel    sites={sites}     onRefresh={load} isSuper={isSuper} currentDeptId={currentDeptId} departments={departments} />}
      {tab === 'receivers' && <ReceiversPanel receivers={receivers} onRefresh={load} isSuper={isSuper} currentDeptId={currentDeptId} departments={departments} />}
      {tab === 'cameras'   && <CamerasPanel  sites={sites} isSuper={isSuper} currentDeptId={currentDeptId} />}
      {tab === 'users'     && <UsersPanel currentUserId={user!.id} isSuper={isSuper} currentDeptId={currentDeptId} departments={departments} sites={allSites} />}
      {tab === 'audit'     && <AuditPanel isSuper={isSuper} />}
    </div>
  )
}
