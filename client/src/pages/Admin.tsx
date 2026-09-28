import { useEffect, useState, useCallback } from "react"
import { useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import {
  GitBranch, MapPin, Radio, Camera, Users, Building2, ScrollText, RefreshCw, CircleAlert,
} from "lucide-react"
import { api } from "@/lib/api"
import { cn, errorMessage } from "@/lib/utils"
import { useAuth } from "@/contexts/AuthContext"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Select } from "@/components/ui/input"
import { Tabs, type TabItem } from "@/components/ui/tabs"
import { EmptyState } from "@/components/ui/empty-state"
import { Tip } from "@/components/ui/tooltip"
import { PanelSkeleton } from "@/components/admin/shared"
import { RoutingMatrix } from "@/components/admin/RoutingMatrix"
import { SitesPanel } from "@/components/admin/SitesPanel"
import { ReceiversPanel } from "@/components/admin/ReceiversPanel"
import { CamerasPanel } from "@/components/admin/CamerasPanel"
import { UsersPanel } from "@/components/admin/UsersPanel"
import { DepartmentsPanel } from "@/components/admin/DepartmentsPanel"
import { AuditPanel } from "@/components/admin/AuditPanel"
import type { AdminData, DepartmentRow, RouteKey } from "@/components/admin/types"
import { rk } from "@/components/admin/types"

type Tab = "departments" | "users" | "sites" | "receivers" | "routing" | "cameras" | "audit"

export default function Admin() {
  const { user, department } = useAuth()
  const isSuper = user?.role === "super_admin"
  const currentDeptId = department?.id ?? 0

  const [params, setParams] = useSearchParams()
  const [data, setData]               = useState<AdminData | null>(null)
  const [departments, setDepartments] = useState<DepartmentRow[]>([])
  const [error, setError]             = useState("")
  const [refreshing, setRefreshing]   = useState(false)
  const [activeRoutes, setActiveRoutes] = useState<Set<RouteKey>>(new Set())
  const [busyCells, setBusyCells]       = useState<Set<RouteKey>>(new Set())
  const [deptFilter, setDeptFilter]     = useState<number | "all">("all")

  const load = useCallback(async () => {
    setError("")
    try {
      const [d, depts] = await Promise.all([
        api.get<AdminData>("/api/admin/data"),
        isSuper ? api.get<DepartmentRow[]>("/api/departments") : Promise.resolve([]),
      ])
      setData(d)
      setDepartments(depts)
      setActiveRoutes(new Set(d.routes.map((r) => rk(r.site_id, r.receiver_id))))
    } catch (e) {
      setError(errorMessage(e, "Failed to load configuration"))
    } finally {
      setRefreshing(false)
    }
  }, [isSuper])

  useEffect(() => { load() }, [load])

  const toggleRoute = async (siteId: string, receiverId: string) => {
    const key = rk(siteId, receiverId)
    if (busyCells.has(key)) return
    const wasActive = activeRoutes.has(key)
    const flip = (on: boolean) => setActiveRoutes((prev) => {
      const s = new Set(prev)
      if (on) s.add(key)
      else s.delete(key)
      return s
    })

    setBusyCells((p) => new Set(p).add(key))
    flip(!wasActive)
    try {
      if (wasActive) await api.delete(`/api/admin/routes/${encodeURIComponent(siteId)}/${encodeURIComponent(receiverId)}`)
      else           await api.put(`/api/admin/routes/${encodeURIComponent(siteId)}/${encodeURIComponent(receiverId)}`)
    } catch (err) {
      flip(wasActive)
      toast.error("Route not changed", { description: errorMessage(err) })
    } finally {
      setBusyCells((p) => { const s = new Set(p); s.delete(key); return s })
    }
  }

  const allSites     = data?.sites ?? []
  const allReceivers = data?.receivers ?? []
  const sites     = deptFilter === "all" ? allSites     : allSites.filter((s) => s.department_id === deptFilter)
  const receivers = deptFilter === "all" ? allReceivers : allReceivers.filter((r) => r.department_id === deptFilter)

  const tabs: TabItem<Tab>[] = [
    ...(isSuper ? [{ id: "departments" as Tab, label: "Departments", icon: Building2, count: departments.length }] : []),
    { id: "users",     label: "Users",        icon: Users },
    { id: "sites",     label: "Sites",        icon: MapPin, count: data ? sites.length : undefined },
    { id: "receivers", label: "HQ receivers", icon: Radio,  count: data ? receivers.length : undefined },
    { id: "routing",   label: "Routing",      icon: GitBranch, count: data ? activeRoutes.size : undefined },
    { id: "cameras",   label: "Cameras",      icon: Camera },
    { id: "audit",     label: "Activity",     icon: ScrollText },
  ]

  // Deep-linkable tab (?tab=users); falls back to the first tab for this role
  const requested = params.get("tab") as Tab | null
  const tab: Tab = requested && tabs.some((t) => t.id === requested) ? requested : tabs[0].id
  const setTab = (id: Tab) => setParams((p) => { p.set("tab", id); return p }, { replace: true })

  const showDeptFilter = isSuper && ["sites", "receivers", "routing", "cameras"].includes(tab)

  return (
    <>
      <PageHeader
        title="Administration"
        description={isSuper
          ? "Departments, users, sites and alert routing across Falcon Eye"
          : `${department?.name ?? "Your department"} — users, sites, receivers and routing`}
        actions={
          <>
            {showDeptFilter && (
              <div className="min-w-0 flex-1 sm:w-52 sm:flex-none">
                <Select
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
                  aria-label="Filter by department"
                >
                  <option value="all">All departments</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}
                </Select>
              </div>
            )}
            <Tip content="Reload configuration">
              <Button variant="outline" size="icon" onClick={() => { setRefreshing(true); load() }} disabled={refreshing} aria-label="Reload configuration">
                <RefreshCw className={cn(refreshing && "animate-spin")} />
              </Button>
            </Tip>
          </>
        }
      />

      <Tabs items={tabs} value={tab} onChange={setTab} className="mb-5" />

      <div role="tabpanel" aria-label={tabs.find((t) => t.id === tab)?.label}>
        {error && !data ? (
          <Card>
            <EmptyState
              icon={CircleAlert}
              tone="danger"
              title="Couldn't load configuration"
              description={error}
              action={<Button variant="outline" onClick={() => { setRefreshing(true); load() }}><RefreshCw /> Try again</Button>}
            />
          </Card>
        ) : !data && tab !== "users" && tab !== "audit" ? (
          <PanelSkeleton />
        ) : (
          <>
            {tab === "departments" && isSuper && <DepartmentsPanel departments={departments} onRefresh={load} />}
            {tab === "users"     && user && <UsersPanel currentUserId={user.id} isSuper={isSuper} currentDeptId={currentDeptId} departments={departments} sites={allSites} />}
            {tab === "sites"     && <SitesPanel sites={sites} onRefresh={load} isSuper={isSuper} currentDeptId={currentDeptId} departments={departments} />}
            {tab === "receivers" && <ReceiversPanel receivers={receivers} onRefresh={load} isSuper={isSuper} currentDeptId={currentDeptId} departments={departments} />}
            {tab === "routing"   && <RoutingMatrix sites={sites} receivers={receivers} activeRoutes={activeRoutes} busyCells={busyCells} onToggle={toggleRoute} isSuper={isSuper} currentDeptId={currentDeptId} />}
            {tab === "cameras"   && <CamerasPanel sites={sites} isSuper={isSuper} currentDeptId={currentDeptId} />}
            {tab === "audit"     && <AuditPanel isSuper={isSuper} />}
          </>
        )}
      </div>
    </>
  )
}
