import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Plus, TrainFront, Pickaxe, Radio, Satellite, Signal, MapPin, Camera, Trash2, MapPinOff, SearchX } from "lucide-react"
import { api } from "@/lib/api"
import { errorMessage } from "@/lib/utils"
import { useConfirm } from "@/hooks/useConfirm"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { SearchInput } from "@/components/ui/input"
import { EmptyState } from "@/components/ui/empty-state"
import { DataTable, RowActions, type Column } from "@/components/ui/data-table"
import { DepartmentBadge, PanelToolbar, ReadOnlyHint } from "./shared"
import { AddSiteDialog, type SitePrefill } from "./AddSiteDialog"
import { UnregisteredTerminals } from "./UnregisteredTerminals"
import type { Site, DepartmentRow } from "./types"

const TYPE_ICON: Record<string, React.ElementType> = { train: TrainFront, mine: Pickaxe, other: Radio }
const TYPE_LABEL: Record<string, string> = { train: "Train", mine: "Mine", other: "Other" }

export function SitesPanel({ sites, onRefresh, isSuper, currentDeptId, departments }: {
  sites: Site[]; onRefresh: () => void; isSuper: boolean; currentDeptId: number
  departments: DepartmentRow[]
}) {
  const navigate = useNavigate()
  const confirm = useConfirm()
  const [query, setQuery]     = useState("")
  const [addOpen, setAddOpen] = useState(false)
  // Pre-filled "Register" from an unregistered FMS terminal; `dialogKey`
  // remounts the dialog so it picks the new values up.
  const [prefill, setPrefill] = useState<SitePrefill | undefined>(undefined)
  const [dialogKey, setDialogKey] = useState(0)
  const [terminalsKey, setTerminalsKey] = useState(0)

  const openAdd = (values?: SitePrefill) => {
    setPrefill(values)
    setDialogKey((k) => k + 1)
    setAddOpen(true)
  }

  const canManage = (s: Site) => isSuper || s.department_id === currentDeptId

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return sites
    return sites.filter((s) => [s.label, s.id, s.region, s.department_code].some((v) => v?.toLowerCase().includes(q)))
  }, [sites, query])

  const remove = async (s: Site) => {
    const ok = await confirm({
      title: `Delete ${s.label}?`,
      description: "This removes the site, its cameras and all of its alert routes. The device's live data in Firebase is not deleted.",
      confirmLabel: "Delete site",
      destructive: true,
    })
    if (!ok) return
    try {
      await api.delete(`/api/admin/sites/${encodeURIComponent(s.id)}`)
      toast.success(`${s.label} deleted`)
      onRefresh()
    } catch (err) {
      toast.error("Couldn't delete site", { description: errorMessage(err) })
    }
  }

  const columns: Column<Site>[] = [
    {
      id: "site", header: "Site", mobile: "title",
      cell: (s) => {
        const Icon = TYPE_ICON[s.type] ?? Radio
        return (
          <div className="flex min-w-0 items-center gap-3">
            <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/60 text-muted-foreground md:flex">
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-medium">{s.label}</p>
              <p className="truncate font-mono text-xs text-muted-foreground">{s.id}</p>
            </div>
          </div>
        )
      },
    },
    { id: "type", header: "Type", cell: (s) => <span className="text-sm">{TYPE_LABEL[s.type] ?? s.type}</span> },
    {
      id: "source", header: "Tracking",
      cell: (s) => s.source === "satellite_fms"
        ? <Badge variant="info" size="sm"><Satellite /> Satellite</Badge>
        : <Badge variant="outline" size="sm"><Signal /> Cellular</Badge>,
    },
    { id: "region", header: "Region", cell: (s) => <span className="text-muted-foreground">{s.region || "—"}</span> },
    {
      id: "dept", header: "Department",
      cell: (s) => (
        <div className="flex flex-col items-start gap-1">
          <DepartmentBadge code={s.department_code} />
          {!canManage(s) && <ReadOnlyHint />}
        </div>
      ),
    },
    { id: "owner", header: "Created by", mobile: "hidden", cell: (s) => <span className="text-muted-foreground">{s.owner_name || "—"}</span> },
  ]

  return (
    <>
      {isSuper && <UnregisteredTerminals onRegister={openAdd} refreshKey={terminalsKey} />}

      <PanelToolbar actions={<Button onClick={() => openAdd()}><Plus /> Add site</Button>}>
        <div className="w-full sm:max-w-xs">
          <SearchInput value={query} onChange={setQuery} placeholder="Search sites…" />
        </div>
      </PanelToolbar>

      <Card className="overflow-hidden">
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(s) => s.id}
          actions={(s) => (
            <RowActions
              label={`Actions for ${s.label}`}
              actions={[
                { label: "Show on map", icon: MapPin, onSelect: () => navigate(`/map?site=${encodeURIComponent(s.id)}`) },
                { label: "View cameras", icon: Camera, onSelect: () => navigate(`/cameras?site=${encodeURIComponent(s.id)}`) },
                { label: "Delete site", icon: Trash2, destructive: true, separated: true, hidden: !canManage(s), onSelect: () => remove(s) },
              ]}
            />
          )}
          empty={sites.length === 0 ? (
            <EmptyState
              icon={MapPinOff}
              title="No sites yet"
              description="Register a panic-button or satellite tracker so it can be monitored and routed."
              action={<Button onClick={() => openAdd()}><Plus /> Add your first site</Button>}
            />
          ) : (
            <EmptyState icon={SearchX} title="No matching sites" description="Try a different name, ID or region." />
          )}
        />
      </Card>

      <AddSiteDialog
        key={dialogKey}
        open={addOpen}
        onOpenChange={setAddOpen}
        isSuper={isSuper}
        currentDeptId={currentDeptId}
        departments={departments}
        prefill={prefill}
        onCreated={() => { onRefresh(); setTerminalsKey((k) => k + 1) }}
      />
    </>
  )
}
