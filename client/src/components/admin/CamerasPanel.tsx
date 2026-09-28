import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Plus, Camera, Trash2, Video, SearchX, CircleAlert, RefreshCw, Cloud, Cable } from "lucide-react"
import { api } from "@/lib/api"
import { cn, errorMessage } from "@/lib/utils"
import { useConfirm } from "@/hooks/useConfirm"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input, Select, Field, SearchInput } from "@/components/ui/input"
import { EmptyState } from "@/components/ui/empty-state"
import { DataTable, RowActions, type Column } from "@/components/ui/data-table"
import {
  Dialog, DialogContent, DialogHeader, DialogBody, DialogFooter, DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import { DepartmentBadge, PanelSkeleton, PanelToolbar } from "./shared"
import type { Site, CameraRow } from "./types"

export function CamerasPanel({ sites, isSuper, currentDeptId }: { sites: Site[]; isSuper: boolean; currentDeptId: number }) {
  const navigate = useNavigate()
  const confirm = useConfirm()
  const manageableSites = sites.filter((s) => isSuper || s.department_id === currentDeptId)

  const [cameras, setCameras] = useState<CameraRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState("")
  const [query, setQuery]     = useState("")
  const [addOpen, setAddOpen] = useState(false)

  const load = useCallback(async () => {
    setError("")
    try {
      setCameras(await api.get<CameraRow[]>("/api/cameras/all"))
    } catch (err) {
      setError(errorMessage(err, "Couldn't load cameras"))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return cameras
    return cameras.filter((c) => [c.label, c.site_label, c.site_id, c.ip, c.imou_device_id].some((v) => v?.toLowerCase().includes(q)))
  }, [cameras, query])

  const canManage = (c: CameraRow) => isSuper || c.site_department_id === currentDeptId

  const remove = async (c: CameraRow) => {
    const ok = await confirm({
      title: `Delete ${c.label}?`,
      description: `This camera will be removed from ${c.site_label}. Any live stream stops.`,
      confirmLabel: "Delete camera",
      destructive: true,
    })
    if (!ok) return
    try {
      await api.delete(`/api/cameras/${c.id}`)
      toast.success(`${c.label} deleted`)
      load()
    } catch (err) {
      toast.error("Couldn't delete camera", { description: errorMessage(err) })
    }
  }

  const columns: Column<CameraRow>[] = [
    {
      id: "camera", header: "Camera", mobile: "title",
      cell: (c) => (
        <div className="flex min-w-0 items-center gap-3">
          <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/60 text-muted-foreground md:flex">
            <Video className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium">{c.label}</p>
            <p className="truncate text-xs text-muted-foreground">{c.site_label}</p>
          </div>
        </div>
      ),
    },
    { id: "dept", header: "Department", cell: (c) => <DepartmentBadge code={c.site_department_code} /> },
    {
      id: "type", header: "Stream",
      cell: (c) => c.stream_type === "imou"
        ? <Badge variant="success" size="sm"><Cloud /> IMOU Cloud</Badge>
        : <Badge variant="info" size="sm"><Cable /> RTSP</Badge>,
    },
    {
      id: "conn", header: "Connection",
      cell: (c) => (
        <span className="font-mono text-xs text-muted-foreground">
          {c.stream_type === "imou" ? `${c.imou_device_id} · ch${c.imou_channel_id}` : `${c.ip}:${c.port} · ch${c.channel}/${c.subtype === 0 ? "main" : "sub"}`}
        </span>
      ),
    },
  ]

  if (loading) return <PanelSkeleton />

  return (
    <>
      <PanelToolbar
        actions={
          <Button onClick={() => setAddOpen(true)} disabled={manageableSites.length === 0} title={manageableSites.length === 0 ? "Add a site in your department first" : undefined}>
            <Plus /> Add camera
          </Button>
        }
      >
        <div className="w-full sm:max-w-xs">
          <SearchInput value={query} onChange={setQuery} placeholder="Search cameras…" />
        </div>
      </PanelToolbar>

      <Card className="overflow-hidden">
        {error ? (
          <EmptyState icon={CircleAlert} tone="danger" title="Couldn't load cameras" description={error}
            action={<Button variant="outline" onClick={() => { setLoading(true); load() }}><RefreshCw /> Try again</Button>} />
        ) : (
          <DataTable
            columns={columns}
            rows={filtered}
            rowKey={(c) => c.id}
            actions={(c) => (
              <RowActions
                label={`Actions for ${c.label}`}
                actions={[
                  { label: "Watch live", icon: Camera, onSelect: () => navigate(`/cameras?site=${encodeURIComponent(c.site_id)}`) },
                  { label: "Delete camera", icon: Trash2, destructive: true, separated: true, hidden: !canManage(c), onSelect: () => remove(c) },
                ]}
              />
            )}
            empty={cameras.length === 0 ? (
              <EmptyState
                icon={Video}
                title="No cameras yet"
                description={manageableSites.length === 0 ? "Add a site in your department, then attach cameras to it." : "Attach an RTSP or IMOU Cloud camera to one of your sites."}
                action={manageableSites.length > 0 ? <Button onClick={() => setAddOpen(true)}><Plus /> Add a camera</Button> : undefined}
              />
            ) : (
              <EmptyState icon={SearchX} title="No matching cameras" />
            )}
          />
        )}
      </Card>

      <AddCameraDialog open={addOpen} onOpenChange={setAddOpen} sites={manageableSites} onCreated={load} />
    </>
  )
}

function AddCameraDialog({ open, onOpenChange, sites, onCreated }: {
  open: boolean; onOpenChange: (open: boolean) => void; sites: Site[]; onCreated: () => void
}) {
  const empty = {
    site_id: "", label: "Camera", stream_type: "rtsp" as "rtsp" | "imou",
    ip: "", port: "554", username: "", password: "", channel: "1", subtype: "0",
    imou_device_id: "", imou_channel_id: "0",
  }
  const [form, setForm]     = useState(empty)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState("")
  const set = (patch: Partial<typeof empty>) => setForm((f) => ({ ...f, ...patch }))

  const close = () => { setForm(empty); setError(""); setSaving(false); onOpenChange(false) }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSaving(true)
    const payload = form.stream_type === "imou"
      ? { site_id: form.site_id, label: form.label, stream_type: "imou", imou_device_id: form.imou_device_id, imou_channel_id: form.imou_channel_id }
      : {
          site_id: form.site_id, label: form.label, stream_type: "rtsp",
          ip: form.ip, port: parseInt(form.port) || 554, username: form.username, password: form.password,
          channel: parseInt(form.channel) || 1, subtype: parseInt(form.subtype) || 0,
        }
    try {
      await api.post("/api/cameras", payload)
      toast.success(`${form.label} added`)
      onCreated()
      close()
    } catch (err) {
      setError(errorMessage(err, "Couldn't add camera"))
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close() }}>
      <DialogContent size="lg">
        <form onSubmit={submit} className="flex min-h-0 flex-col">
          <DialogHeader icon={Camera}>
            <DialogTitle>Add camera</DialogTitle>
            <DialogDescription>Attach a camera to one of your sites.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Site" required>
                <Select value={form.site_id} onChange={(e) => set({ site_id: e.target.value })} required autoFocus>
                  <option value="" disabled>Select a site…</option>
                  {sites.map((s) => <option key={s.id} value={s.id}>{s.label} ({s.department_code})</option>)}
                </Select>
              </Field>
              <Field label="Camera name" required>
                <Input value={form.label} onChange={(e) => set({ label: e.target.value })} placeholder="Front carriage" required />
              </Field>
            </div>

            <fieldset>
              <legend className="mb-1.5 text-xs font-medium text-foreground/90">Stream source</legend>
              <div className="grid grid-cols-2 gap-2">
                {([["rtsp", Cable, "RTSP", "Direct IP camera"], ["imou", Cloud, "IMOU Cloud", "Via IMOU servers"]] as const).map(([value, Icon, title, desc]) => (
                  <label key={value} className={cn("flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                    form.stream_type === value ? "border-primary/50 bg-primary/10" : "border-border hover:bg-accent/40")}>
                    <input type="radio" name="stream_type" className="sr-only" checked={form.stream_type === value} onChange={() => set({ stream_type: value })} />
                    <Icon className={cn("mt-0.5 h-4 w-4", form.stream_type === value ? "text-primary" : "text-muted-foreground")} />
                    <span>
                      <span className="block text-sm font-medium">{title}</span>
                      <span className="block text-xs text-muted-foreground">{desc}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            {form.stream_type === "imou" ? (
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Device serial" required className="sm:col-span-2">
                  <Input mono value={form.imou_device_id} onChange={(e) => set({ imou_device_id: e.target.value })} placeholder="AABHD12345678901" required />
                </Field>
                <Field label="Channel">
                  <Input mono value={form.imou_channel_id} onChange={(e) => set({ imou_channel_id: e.target.value })} inputMode="numeric" />
                </Field>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Field label="IP address" required className="col-span-2 sm:col-span-3">
                  <Input mono value={form.ip} onChange={(e) => set({ ip: e.target.value })} placeholder="192.168.1.100" required inputMode="decimal" />
                </Field>
                <Field label="Port" className="col-span-2 sm:col-span-1">
                  <Input mono value={form.port} onChange={(e) => set({ port: e.target.value })} inputMode="numeric" />
                </Field>
                <Field label="Username" required className="col-span-2">
                  <Input value={form.username} onChange={(e) => set({ username: e.target.value })} autoComplete="off" required />
                </Field>
                <Field label="Password" required className="col-span-2">
                  <Input type="password" value={form.password} onChange={(e) => set({ password: e.target.value })} autoComplete="new-password" required />
                </Field>
                <Field label="Channel">
                  <Input mono value={form.channel} onChange={(e) => set({ channel: e.target.value })} inputMode="numeric" />
                </Field>
                <Field label="Stream">
                  <Select value={form.subtype} onChange={(e) => set({ subtype: e.target.value })}>
                    <option value="0">Main</option>
                    <option value="1">Sub (lower bandwidth)</option>
                  </Select>
                </Field>
              </div>
            )}

            {error && <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>Cancel</Button>
            <Button type="submit" loading={saving}>Add camera</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
