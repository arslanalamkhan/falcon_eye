import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Plus, Radio, Trash2, SearchX, RadioTower } from "lucide-react"
import { api } from "@/lib/api"
import { errorMessage, slugify } from "@/lib/utils"
import { useConfirm } from "@/hooks/useConfirm"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input, Select, Field, SearchInput } from "@/components/ui/input"
import { EmptyState } from "@/components/ui/empty-state"
import { DataTable, RowActions, type Column } from "@/components/ui/data-table"
import {
  Dialog, DialogContent, DialogHeader, DialogBody, DialogFooter, DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import { DepartmentBadge, PanelToolbar, ReadOnlyHint } from "./shared"
import type { Receiver, DepartmentRow } from "./types"

export function ReceiversPanel({ receivers, onRefresh, isSuper, currentDeptId, departments }: {
  receivers: Receiver[]; onRefresh: () => void; isSuper: boolean; currentDeptId: number
  departments: DepartmentRow[]
}) {
  const confirm = useConfirm()
  const [query, setQuery]     = useState("")
  const [addOpen, setAddOpen] = useState(false)

  const canManage = (r: Receiver) => isSuper || r.department_id === currentDeptId

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return receivers
    return receivers.filter((r) => [r.label, r.id, r.lea, r.city, r.department_code].some((v) => v?.toLowerCase().includes(q)))
  }, [receivers, query])

  const remove = async (r: Receiver) => {
    const ok = await confirm({
      title: `Delete ${r.label}?`,
      description: "Sites routed to this receiver will stop buzzing it immediately.",
      confirmLabel: "Delete receiver",
      destructive: true,
    })
    if (!ok) return
    try {
      await api.delete(`/api/admin/receivers/${encodeURIComponent(r.id)}`)
      toast.success(`${r.label} deleted`)
      onRefresh()
    } catch (err) {
      toast.error("Couldn't delete receiver", { description: errorMessage(err) })
    }
  }

  const columns: Column<Receiver>[] = [
    {
      id: "receiver", header: "Receiver", mobile: "title",
      cell: (r) => (
        <div className="flex min-w-0 items-center gap-3">
          <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/60 text-muted-foreground md:flex">
            <Radio className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium">{r.label}</p>
            <p className="truncate font-mono text-xs text-muted-foreground">{r.id}</p>
          </div>
        </div>
      ),
    },
    { id: "lea", header: "Agency", cell: (r) => r.lea || <span className="text-muted-foreground">—</span> },
    { id: "city", header: "City", cell: (r) => r.city || <span className="text-muted-foreground">—</span> },
    {
      id: "dept", header: "Department",
      cell: (r) => (
        <div className="flex flex-col items-start gap-1">
          <DepartmentBadge code={r.department_code} />
          {!canManage(r) && <ReadOnlyHint />}
        </div>
      ),
    },
    { id: "owner", header: "Created by", mobile: "hidden", cell: (r) => <span className="text-muted-foreground">{r.owner_name || "—"}</span> },
  ]

  return (
    <>
      <PanelToolbar actions={<Button onClick={() => setAddOpen(true)}><Plus /> Add receiver</Button>}>
        <div className="w-full sm:max-w-xs">
          <SearchInput value={query} onChange={setQuery} placeholder="Search receivers…" />
        </div>
      </PanelToolbar>

      <Card className="overflow-hidden">
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(r) => r.id}
          actions={(r) => (
            <RowActions
              label={`Actions for ${r.label}`}
              actions={[{ label: "Delete receiver", icon: Trash2, destructive: true, hidden: !canManage(r), onSelect: () => remove(r) }]}
            />
          )}
          empty={receivers.length === 0 ? (
            <EmptyState
              icon={RadioTower}
              title="No HQ receivers yet"
              description="Receivers are the buzzer boxes at LEA/QRF headquarters that sites route alerts to."
              action={<Button onClick={() => setAddOpen(true)}><Plus /> Add a receiver</Button>}
            />
          ) : (
            <EmptyState icon={SearchX} title="No matching receivers" />
          )}
        />
      </Card>

      <AddReceiverDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        isSuper={isSuper}
        currentDeptId={currentDeptId}
        departments={departments}
        onCreated={onRefresh}
      />
    </>
  )
}

function AddReceiverDialog({ open, onOpenChange, isSuper, currentDeptId, departments, onCreated }: {
  open: boolean; onOpenChange: (open: boolean) => void; isSuper: boolean; currentDeptId: number
  departments: DepartmentRow[]; onCreated: () => void
}) {
  const empty = { label: "", id: "", lea: "", city: "", department_id: String(currentDeptId) }
  const [form, setForm]           = useState(empty)
  const [idTouched, setIdTouched] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState("")

  const close = () => {
    setForm(empty); setIdTouched(false); setError(""); setSaving(false)
    onOpenChange(false)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSaving(true)
    try {
      await api.post("/api/admin/receivers", { ...form, department_id: isSuper ? Number(form.department_id) : undefined })
      toast.success(`${form.label} added`, { description: "Route sites to it from the Routing tab." })
      onCreated()
      close()
    } catch (err) {
      setError(errorMessage(err, "Couldn't add receiver"))
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close() }}>
      <DialogContent size="lg">
        <form onSubmit={submit} className="flex min-h-0 flex-col">
          <DialogHeader icon={RadioTower}>
            <DialogTitle>Add HQ receiver</DialogTitle>
            <DialogDescription>A buzzer box at a law-enforcement or QRF headquarters.</DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" required>
              <Input
                value={form.label}
                onChange={(e) => {
                  const label = e.target.value
                  setForm((f) => ({ ...f, label, id: idTouched ? f.id : slugify(label) }))
                }}
                placeholder="FC HQ Quetta"
                required
                autoFocus
              />
            </Field>
            <Field label="Receiver ID" hint="Must match the receiver's Firebase key" required>
              <Input
                mono
                value={form.id}
                onChange={(e) => { setIdTouched(true); setForm((f) => ({ ...f, id: e.target.value })) }}
                placeholder="fc_hq_quetta"
                required
                pattern="[A-Za-z0-9_\-]+"
                title="Letters, numbers, underscores and dashes only"
              />
            </Field>
            <Field label="Agency (LEA)">
              <Input value={form.lea} onChange={(e) => setForm((f) => ({ ...f, lea: e.target.value }))} placeholder="Frontier Corps" />
            </Field>
            <Field label="City">
              <Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} placeholder="Quetta" />
            </Field>
            {isSuper && (
              <Field label="Department" className="sm:col-span-2">
                <Select value={form.department_id} onChange={(e) => setForm((f) => ({ ...f, department_id: e.target.value }))}>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}
                </Select>
              </Field>
            )}
            {error && <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger sm:col-span-2">{error}</p>}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>Cancel</Button>
            <Button type="submit" loading={saving}>Add receiver</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
