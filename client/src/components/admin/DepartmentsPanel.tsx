import { useState } from "react"
import { toast } from "sonner"
import { Building2, Plus, Pencil, Trash2, Users, MapPin, Radio, Crown } from "lucide-react"
import { api } from "@/lib/api"
import { cn, errorMessage } from "@/lib/utils"
import { useConfirm } from "@/hooks/useConfirm"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { RowActions } from "@/components/ui/data-table"
import { PanelToolbar } from "./shared"
import { CreateDepartmentDialog, EditDepartmentDialog } from "./DepartmentDialogs"
import { SCOPE_META } from "./scope"
import type { DepartmentRow } from "./types"

export function DepartmentsPanel({ departments, onRefresh }: { departments: DepartmentRow[]; onRefresh: () => void }) {
  const confirm = useConfirm()
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<DepartmentRow | null>(null)

  const remove = async (d: DepartmentRow) => {
    const ok = await confirm({
      title: `Delete ${d.code}?`,
      description: `${d.name} will be permanently removed. This is only possible because it has no users, sites or receivers.`,
      confirmLabel: "Delete department",
      destructive: true,
    })
    if (!ok) return
    try {
      await api.delete(`/api/departments/${d.id}`)
      toast.success(`${d.code} deleted`)
      onRefresh()
    } catch (err) {
      toast.error("Couldn't delete department", { description: errorMessage(err) })
    }
  }

  return (
    <>
      <PanelToolbar actions={<Button onClick={() => setCreateOpen(true)}><Plus /> New department</Button>}>
        <p className="text-sm text-muted-foreground">
          Each department owns its sites, receivers and users. Its admin manages them; you manage departments.
        </p>
      </PanelToolbar>

      {departments.length === 0 ? (
        <Card><EmptyState icon={Building2} title="No departments" /></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          {departments.map((d) => {
            const scope = SCOPE_META[d.view_scope]
            const empty = Number(d.user_count) + Number(d.site_count) + Number(d.receiver_count) === 0
            return (
              <Card key={d.id} className={cn("flex flex-col", !d.active && "opacity-70")}>
                <div className="flex items-start gap-3 p-4 sm:p-5">
                  <div className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border font-mono text-xs font-bold",
                    d.is_head ? "border-primary/40 bg-primary/15 text-primary" : "border-border bg-muted/60 text-foreground"
                  )}>
                    {d.code.slice(0, 4)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h3 className="font-mono text-sm font-bold">{d.code}</h3>
                      {d.is_head && <Badge variant="default" size="sm"><Crown /> Head</Badge>}
                      {!d.active && <Badge variant="warning" size="sm">Inactive</Badge>}
                    </div>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground" title={d.name}>{d.name}</p>
                  </div>
                  <RowActions
                    label={`Actions for ${d.code}`}
                    actions={[
                      { label: "Edit department", icon: Pencil, onSelect: () => setEditTarget(d) },
                      { label: "Delete department", icon: Trash2, destructive: true, separated: true, hidden: d.is_head || !empty, onSelect: () => remove(d) },
                    ]}
                  />
                </div>

                <div className="mx-4 mb-4 flex items-start gap-2.5 rounded-lg bg-muted/40 px-3 py-2.5 sm:mx-5">
                  <scope.icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium">{scope.label}</p>
                    {d.view_scope === "selected" && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {d.oversight_targets.length > 0
                          ? d.oversight_targets.map((t) => <Badge key={t.id} variant="outline" size="sm" className="font-mono">{t.code}</Badge>)
                          : <span className="text-xs text-muted-foreground">No departments selected</span>}
                      </div>
                    )}
                  </div>
                </div>

                <dl className="mt-auto grid grid-cols-3 divide-x divide-border border-t border-border">
                  {([["Users", Users, d.user_count], ["Sites", MapPin, d.site_count], ["Receivers", Radio, d.receiver_count]] as const).map(([label, Icon, n]) => (
                    <div key={label} className="px-3 py-3 text-center">
                      <dd className="text-lg font-semibold tabular-nums">{n}</dd>
                      <dt className="flex items-center justify-center gap-1 text-2xs text-muted-foreground"><Icon className="h-3 w-3" />{label}</dt>
                    </div>
                  ))}
                </dl>
              </Card>
            )
          })}
        </div>
      )}

      <CreateDepartmentDialog open={createOpen} onOpenChange={setCreateOpen} departments={departments} onCreated={onRefresh} />
      {editTarget && (
        <EditDepartmentDialog
          department={editTarget}
          allDepartments={departments}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); onRefresh() }}
        />
      )}
    </>
  )
}
