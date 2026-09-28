import { useState, useEffect } from "react"
import { api } from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Plus, Trash2, Loader2 } from "lucide-react"
import { FormField } from "./shared"
import type { Site, CameraRow } from "./types"

export function CamerasPanel({ sites, isSuper, currentDeptId }: { sites: Site[]; isSuper: boolean; currentDeptId: number }) {
  const manageableSites = sites.filter(s => isSuper || s.department_id === currentDeptId)
  const [cameras, setCameras]   = useState<CameraRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [saving, setSaving]     = useState(false)
  const [formErr, setFormErr]   = useState('')
  const [form, setForm] = useState({
    site_id: '', label: 'Camera', stream_type: 'rtsp',
    // RTSP fields
    ip: '', port: '554', username: '', password: '', channel: '1', subtype: '0',
    // IMOU fields
    imou_device_id: '', imou_channel_id: '0',
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
      const payload = form.stream_type === 'imou'
        ? {
            site_id: form.site_id, label: form.label, stream_type: 'imou',
            imou_device_id: form.imou_device_id, imou_channel_id: form.imou_channel_id,
          }
        : {
            site_id: form.site_id, label: form.label, stream_type: 'rtsp',
            ip: form.ip, port: parseInt(form.port) || 554,
            username: form.username, password: form.password,
            channel: parseInt(form.channel) || 1, subtype: parseInt(form.subtype) || 0,
          }
      await api.post('/api/cameras', payload)
      setForm({
        site_id: form.site_id, label: 'Camera', stream_type: form.stream_type,
        ip: '', port: '554', username: '', password: '', channel: '1', subtype: '0',
        imou_device_id: '', imou_channel_id: '0',
      })
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
      {manageableSites.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-4 text-xs text-muted-foreground">
          Add a site in your department before attaching a camera to it.
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" /> Add Camera
          </h3>
          <form onSubmit={addCamera} className="space-y-3">
            {/* Row 1: Site, Label, Stream Type */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Site</label>
                <select
                  value={form.site_id}
                  onChange={e => setForm(f => ({ ...f, site_id: e.target.value }))}
                  required
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="" disabled>Select site…</option>
                  {manageableSites.map(s => <option key={s.id} value={s.id}>{s.label} ({s.department_code})</option>)}
                </select>
              </div>
              <FormField label="Label" value={form.label} onChange={v => setForm(f => ({ ...f, label: v }))} placeholder="Camera 1" required />
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Stream Type</label>
                <select
                  value={form.stream_type}
                  onChange={e => setForm(f => ({ ...f, stream_type: e.target.value }))}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="rtsp">RTSP (Local / IP Camera)</option>
                  <option value="imou">IMOU Cloud</option>
                </select>
              </div>
            </div>

            {/* Row 2: Type-specific fields */}
            {form.stream_type === 'imou' ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <FormField
                  label="IMOU Device ID"
                  value={form.imou_device_id}
                  onChange={v => setForm(f => ({ ...f, imou_device_id: v }))}
                  placeholder="e.g. AABHD12345678901"
                  required mono
                />
                <FormField
                  label="Channel ID"
                  value={form.imou_channel_id}
                  onChange={v => setForm(f => ({ ...f, imou_channel_id: v }))}
                  placeholder="0"
                  mono
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <FormField label="IP Address" value={form.ip} onChange={v => setForm(f => ({ ...f, ip: v }))} placeholder="192.168.1.100" required mono />
                <FormField label="Port" value={form.port} onChange={v => setForm(f => ({ ...f, port: v }))} placeholder="554" mono />
                <FormField label="Username" value={form.username} onChange={v => setForm(f => ({ ...f, username: v }))} placeholder="admin" required />
                <FormField label="Password" value={form.password} onChange={v => setForm(f => ({ ...f, password: v }))} type="password" placeholder="••••••••" required />
                <FormField label="Channel" value={form.channel} onChange={v => setForm(f => ({ ...f, channel: v }))} placeholder="1" mono />
                <FormField label="Subtype (0=main, 1=sub)" value={form.subtype} onChange={v => setForm(f => ({ ...f, subtype: v }))} placeholder="0" mono />
              </div>
            )}

            <div className="flex items-center gap-3">
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
                {['Site', 'Department', 'Label', 'Type', 'Connection', 'Channel'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                ))}
                <th className="px-4 py-2.5 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {cameras.map(cam => {
                const canDelete = isSuper || cam.site_department_id === currentDeptId
                return (
                <tr key={cam.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-xs font-medium text-foreground">{cam.site_label}</p>
                      <p className="text-[10px] font-mono text-muted-foreground">{cam.site_id}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="info" className="text-[10px] font-mono">{cam.site_department_code}</Badge>
                  </td>
                  <td className="px-4 py-3 text-foreground text-xs">{cam.label}</td>
                  <td className="px-4 py-3">
                    <Badge variant={cam.stream_type === 'imou' ? 'success' : 'info'} className="text-[10px]">
                      {cam.stream_type === 'imou' ? 'IMOU CLOUD' : 'RTSP'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {cam.stream_type === 'imou'
                      ? cam.imou_device_id
                      : `${cam.ip}:${cam.port}`
                    }
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {cam.stream_type === 'imou'
                      ? `ch${cam.imou_channel_id}`
                      : `ch${cam.channel} / sub${cam.subtype}`
                    }
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canDelete && (
                      <button
                        onClick={() => del(cam.id)}
                        disabled={deleting === cam.id}
                        className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                      >
                        {deleting === cam.id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    )}
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
