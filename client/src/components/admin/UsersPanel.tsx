import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { UserPlus, KeyRound, MapPin, Trash2, Users, SearchX, CircleAlert, RefreshCw } from "lucide-react"
import { api } from "@/lib/api"
import { cn, errorMessage } from "@/lib/utils"
import { formatDate, initials } from "@/lib/format"
import { useConfirm } from "@/hooks/useConfirm"
import { ROLE_LABELS, type Role } from "@/types/access"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Select, SearchInput } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { EmptyState } from "@/components/ui/empty-state"
import { DataTable, RowActions, type Column } from "@/components/ui/data-table"
import { DepartmentBadge, PanelSkeleton, PanelToolbar, RoleBadge } from "./shared"
import { SiteAccessDialog } from "./SiteAccessDialog"
import { AddUserDialog, ResetPasswordDialog } from "./UserDialogs"
import type { UserRow, Site, DepartmentRow } from "./types"

export function UsersPanel({ currentUserId, isSuper, currentDeptId, departments, sites }: {
  currentUserId: number; isSuper: boolean; currentDeptId: number
  departments: DepartmentRow[]; sites: Site[]
}) {
  const confirm = useConfirm()
  const [users, setUsers]       = useState<UserRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState("")
  const [busyId, setBusyId]     = useState<number | null>(null)
  const [query, setQuery]       = useState("")
  const [roleFilter, setRoleFilter] = useState<Role | "">("")
  const [addOpen, setAddOpen]   = useState(false)
  const [resetTarget, setResetTarget] = useState<UserRow | null>(null)
  const [sitesTarget, setSitesTarget] = useState<UserRow | null>(null)

  const assignableRoles: Role[] = isSuper
    ? ["super_admin", "dept_admin", "supervisor", "operator"]
    : ["dept_admin", "supervisor", "operator"]

  const load = useCallback(async () => {
    setError("")
    try {
      setUsers(await api.get<UserRow[]>("/api/users"))
    } catch (err) {
      setError(errorMessage(err, "Couldn't load users"))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return users.filter((u) =>
      (!roleFilter || u.role === roleFilter) &&
      (!q || u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.department_code.toLowerCase().includes(q))
    )
  }, [users, query, roleFilter])

  const patch = async (u: UserRow, body: Partial<Pick<UserRow, "role" | "active">>, success: string) => {
    setBusyId(u.id)
    try {
      await api.patch(`/api/users/${u.id}`, body)
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, ...body } : x)))
      toast.success(success)
    } catch (err) {
      toast.error("Update failed", { description: errorMessage(err) })
    } finally {
      setBusyId(null)
    }
  }

  const setActive = async (u: UserRow, active: boolean) => {
    if (!active) {
      const ok = await confirm({
        title: `Deactivate ${u.full_name}?`,
        description: "They'll be signed out immediately and won't be able to sign in until reactivated.",
        confirmLabel: "Deactivate",
        destructive: true,
      })
      if (!ok) return
    }
    patch(u, { active }, active ? `${u.full_name} reactivated` : `${u.full_name} deactivated`)
  }

  const remove = async (u: UserRow) => {
    const ok = await confirm({
      title: `Delete ${u.full_name}?`,
      description: "This permanently removes the account and its site access. Consider deactivating instead to keep the audit trail readable.",
      confirmLabel: "Delete user",
      destructive: true,
    })
    if (!ok) return
    setBusyId(u.id)
    try {
      await api.delete(`/api/users/${u.id}`)
      setUsers((prev) => prev.filter((x) => x.id !== u.id))
      toast.success(`${u.full_name} deleted`)
    } catch (err) {
      toast.error("Couldn't delete user", { description: errorMessage(err) })
    } finally {
      setBusyId(null)
    }
  }

  // Only a super admin may edit another super admin; nobody edits themselves here
  const editable = (u: UserRow) => u.id !== currentUserId && (isSuper || u.role !== "super_admin")

  const columns: Column<UserRow>[] = [
    {
      id: "user", header: "User", mobile: "title",
      cell: (u) => (
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className={cn("text-xs font-bold", u.active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>
              {initials(u.full_name || u.email)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className={cn("truncate font-medium", !u.active && "text-muted-foreground")}>
              {u.full_name}
              {u.id === currentUserId && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(you)</span>}
            </p>
            <p className="truncate text-xs text-muted-foreground">{u.email}</p>
          </div>
        </div>
      ),
    },
    {
      id: "role", header: "Role",
      cell: (u) => editable(u) ? (
        <Select
          value={u.role}
          disabled={busyId === u.id}
          onChange={(e) => patch(u, { role: e.target.value as Role }, `${u.full_name} is now ${ROLE_LABELS[e.target.value as Role]}`)}
          className="h-8 w-44 text-xs sm:h-8"
          aria-label={`Role for ${u.full_name}`}
        >
          {assignableRoles.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </Select>
      ) : <RoleBadge role={u.role} />,
    },
    ...(isSuper ? [{ id: "dept", header: "Department", cell: (u: UserRow) => <DepartmentBadge code={u.department_code} /> }] : []),
    {
      id: "status", header: "Status",
      cell: (u) => (
        <div className="flex items-center gap-2">
          <Switch
            checked={u.active}
            onCheckedChange={(v) => setActive(u, v)}
            disabled={!editable(u) || busyId === u.id}
            label={u.active ? `Deactivate ${u.full_name}` : `Activate ${u.full_name}`}
          />
          <span className={cn("text-xs", u.active ? "text-success" : "text-muted-foreground")}>{u.active ? "Active" : "Inactive"}</span>
        </div>
      ),
    },
    { id: "joined", header: "Added", mobile: "hidden", cell: (u) => <span className="text-muted-foreground">{formatDate(u.created_at)}</span> },
  ]

  if (loading) return <PanelSkeleton />

  return (
    <>
      <PanelToolbar actions={<Button onClick={() => setAddOpen(true)}><UserPlus /> Add user</Button>}>
        <div className="w-full sm:max-w-xs">
          <SearchInput value={query} onChange={setQuery} placeholder="Search name or email…" />
        </div>
        <div className="w-full sm:w-44">
          <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as Role | "")} aria-label="Filter by role">
            <option value="">All roles</option>
            {(["super_admin", "dept_admin", "supervisor", "operator"] as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </Select>
        </div>
      </PanelToolbar>

      <Card className="overflow-hidden">
        {error ? (
          <EmptyState icon={CircleAlert} tone="danger" title="Couldn't load users" description={error}
            action={<Button variant="outline" onClick={() => { setLoading(true); load() }}><RefreshCw /> Try again</Button>} />
        ) : (
          <DataTable
            columns={columns}
            rows={filtered}
            rowKey={(u) => u.id}
            rowClassName={(u) => (!u.active ? "opacity-70" : undefined)}
            actions={(u) => (
              <RowActions
                label={`Actions for ${u.full_name}`}
                actions={[
                  { label: "Manage site access", icon: MapPin, hidden: u.role !== "operator" || !editable(u), onSelect: () => setSitesTarget(u) },
                  { label: "Reset password", icon: KeyRound, hidden: !editable(u), onSelect: () => setResetTarget(u) },
                  { label: "Delete user", icon: Trash2, destructive: true, separated: true, hidden: !editable(u), onSelect: () => remove(u) },
                ]}
              />
            )}
            empty={users.length === 0 ? (
              <EmptyState icon={Users} title="No users yet" action={<Button onClick={() => setAddOpen(true)}><UserPlus /> Add a user</Button>} />
            ) : (
              <EmptyState icon={SearchX} title="No matching users" />
            )}
          />
        )}
      </Card>

      <p className="mt-3 text-xs text-muted-foreground">
        Supervisors see every site in the department automatically. Operators only see the sites you grant them via <MapPin className="inline h-3 w-3" /> Manage site access.
      </p>

      <AddUserDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        isSuper={isSuper}
        currentDeptId={currentDeptId}
        departments={departments}
        assignableRoles={assignableRoles}
        onCreated={(u) => {
          load()
          if (u.role === "operator") setSitesTarget(u)
        }}
      />

      {resetTarget && (
        <ResetPasswordDialog user={resetTarget} onClose={() => setResetTarget(null)} />
      )}

      {sitesTarget && (
        <SiteAccessDialog
          userId={sitesTarget.id}
          userName={sitesTarget.full_name}
          candidateSites={sites.filter((s) => s.department_id === sitesTarget.department_id)}
          onClose={() => setSitesTarget(null)}
        />
      )}
    </>
  )
}
