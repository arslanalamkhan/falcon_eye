import { useState } from "react"
import { toast } from "sonner"
import { MapPinPlus, Signal, Satellite } from "lucide-react"
import { api } from "@/lib/api"
import { cn, errorMessage, slugify } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input, Select, Field } from "@/components/ui/input"
import {
  Dialog, DialogContent, DialogHeader, DialogBody, DialogFooter, DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import type { DepartmentRow } from "./types"

type Source = "cellular" | "satellite_fms"

export type SitePrefill = { label?: string; id?: string; source?: Source; mobile_id?: string }

/** Remount with a new `key` when `prefill` changes — initial state is read once. */
export function AddSiteDialog({ open, onOpenChange, isSuper, currentDeptId, departments, onCreated, prefill }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  isSuper: boolean
  currentDeptId: number
  departments: DepartmentRow[]
  onCreated: () => void
  /** e.g. an unregistered FMS terminal: name + MobileID filled in */
  prefill?: SitePrefill
}) {
  const empty = {
    label: "", id: "", type: "train", region: "", source: "cellular" as Source,
    mobile_id: "", imo: "", mmsi: "", department_id: String(currentDeptId),
  }
  const [form, setForm]         = useState(() => ({ ...empty, ...prefill }))
  const [idTouched, setIdTouched] = useState(Boolean(prefill?.id))
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState("")

  const set = <K extends keyof typeof empty>(key: K, value: (typeof empty)[K]) => setForm((f) => ({ ...f, [key]: value }))

  const close = () => {
    setForm(empty); setIdTouched(false); setError(""); setSaving(false)
    onOpenChange(false)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSaving(true)
    try {
      await api.post("/api/admin/sites", { ...form, department_id: isSuper ? Number(form.department_id) : undefined })
      toast.success(`${form.label} added`, { description: "It will appear on the map once the device reports." })
      onCreated()
      close()
    } catch (err) {
      setError(errorMessage(err, "Couldn't add site"))
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close() }}>
      <DialogContent size="lg">
        <form onSubmit={submit} className="flex min-h-0 flex-col">
          <DialogHeader icon={MapPinPlus}>
            <DialogTitle>Add site</DialogTitle>
            <DialogDescription>Register a train, mine or other location with a panic button or satellite tracker.</DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" required>
                <Input
                  value={form.label}
                  onChange={(e) => {
                    const label = e.target.value
                    setForm((f) => ({ ...f, label, id: idTouched ? f.id : slugify(label) }))
                  }}
                  placeholder="Khyber Mail"
                  required
                  autoFocus
                />
              </Field>
              <Field label="Site ID" hint="Must match the device's Firebase key" required>
                <Input
                  mono
                  value={form.id}
                  onChange={(e) => { setIdTouched(true); set("id", e.target.value) }}
                  placeholder="khyber_mail"
                  required
                  pattern="[A-Za-z0-9_\-]+"
                  title="Letters, numbers, underscores and dashes only"
                />
              </Field>
              <Field label="Type">
                <Select value={form.type} onChange={(e) => set("type", e.target.value)}>
                  <option value="train">Train</option>
                  <option value="mine">Mining site</option>
                  <option value="other">Other</option>
                </Select>
              </Field>
              <Field label="Region">
                <Input value={form.region} onChange={(e) => set("region", e.target.value)} placeholder="KP / Punjab" />
              </Field>
              {isSuper && (
                <Field label="Department" className="sm:col-span-2">
                  <Select value={form.department_id} onChange={(e) => set("department_id", e.target.value)}>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}
                  </Select>
                </Field>
              )}
            </div>

            <fieldset>
              <legend className="mb-1.5 text-xs font-medium text-foreground/90">Tracking hardware</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {([
                  ["cellular", Signal, "Cellular", "ESP32 panic button"],
                  ["satellite_fms", Satellite, "Satellite", "Falcon Mega Track terminal"],
                ] as const).map(([value, Icon, title, desc]) => (
                  <label
                    key={value}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                      form.source === value ? "border-primary/50 bg-primary/10" : "border-border hover:bg-accent/40"
                    )}
                  >
                    <input
                      type="radio"
                      name="source"
                      value={value}
                      checked={form.source === value}
                      onChange={() => set("source", value)}
                      className="sr-only"
                    />
                    <Icon className={cn("mt-0.5 h-4 w-4", form.source === value ? "text-primary" : "text-muted-foreground")} />
                    <span>
                      <span className="block text-sm font-medium">{title}</span>
                      <span className="block text-xs text-muted-foreground">{desc}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            {form.source === "satellite_fms" && (
              <div className="grid gap-4 rounded-lg border border-border bg-muted/30 p-4 animate-in fade-in-0 slide-in-from-top-1 sm:grid-cols-3">
                <Field label="Mobile ID" hint="Terminal serial (MobileID)" required className="sm:col-span-3">
                  <Input mono value={form.mobile_id} onChange={(e) => set("mobile_id", e.target.value)} placeholder="01398397SKY12AE" required />
                </Field>
                <Field label="IMO" hint="Optional">
                  <Input mono value={form.imo} onChange={(e) => set("imo", e.target.value)} />
                </Field>
                <Field label="MMSI" hint="Optional">
                  <Input mono value={form.mmsi} onChange={(e) => set("mmsi", e.target.value)} />
                </Field>
                <p className="text-xs text-muted-foreground sm:col-span-3">
                  Ground terminals report placeholder IMO/MMSI values — the Mobile ID is what matches reports to this site.
                </p>
              </div>
            )}

            {error && <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>Cancel</Button>
            <Button type="submit" loading={saving}>Add site</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
