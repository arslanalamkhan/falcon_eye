import { useState, useEffect, useMemo } from "react"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import { Loader2, Check, Search } from "lucide-react"
import type { Site } from "./types"

// Lets a department admin (or super admin) choose which sites an operator
// can see. The candidate list is whatever sites the current admin's own
// /api/admin/data already returned — for a dept admin that's exactly their
// department's universe (same as the target operator's, since operators
// only ever belong to the admin's own department); the server re-validates
// on save regardless.
export function SiteAccessDialog({ userId, userName, candidateSites, onClose }: {
  userId: number; userName: string; candidateSites: Site[]; onClose: () => void
}) {
  const [granted, setGranted]   = useState<Set<string>>(new Set())
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [err, setErr]           = useState('')
  const [search, setSearch]     = useState('')

  useEffect(() => {
    (async () => {
      setLoading(true)
      try {
        const siteIds = await api.get<string[]>(`/api/users/${userId}/sites`)
        setGranted(new Set(siteIds))
      } finally {
        setLoading(false)
      }
    })()
  }, [userId])

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = q
      ? candidateSites.filter(s => s.label.toLowerCase().includes(q) || s.id.toLowerCase().includes(q))
      : candidateSites
    const byDept = new Map<string, Site[]>()
    for (const s of filtered) {
      const list = byDept.get(s.department_code) ?? []
      list.push(s)
      byDept.set(s.department_code, list)
    }
    return [...byDept.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [candidateSites, search])

  const toggle = (siteId: string) => {
    setGranted(prev => {
      const s = new Set(prev)
      s.has(siteId) ? s.delete(siteId) : s.add(siteId)
      return s
    })
  }

  const selectAll = (sites: Site[], on: boolean) => {
    setGranted(prev => {
      const s = new Set(prev)
      for (const site of sites) on ? s.add(site.id) : s.delete(site.id)
      return s
    })
  }

  const save = async () => {
    setErr('')
    setSaving(true)
    try {
      await api.put(`/api/users/${userId}/sites`, { siteIds: [...granted] })
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Site Access</DialogTitle>
          <DialogDescription>Choose which sites {userName} can see</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search sites…"
                className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {grouped.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4">No sites match.</p>
            ) : (
              <div className="max-h-80 overflow-y-auto space-y-3">
                {grouped.map(([dept, deptSites]) => {
                  const allOn = deptSites.every(s => granted.has(s.id))
                  return (
                    <div key={dept}>
                      <div className="flex items-center justify-between px-1 mb-1">
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{dept}</span>
                        <button
                          type="button"
                          onClick={() => selectAll(deptSites, !allOn)}
                          className="text-[10px] text-primary hover:underline"
                        >
                          {allOn ? 'Clear all' : 'Select all'}
                        </button>
                      </div>
                      <div className="divide-y divide-border rounded-md border border-border">
                        {deptSites.map(s => (
                          <label key={s.id} className="flex items-center justify-between gap-3 py-2 px-2 text-sm cursor-pointer">
                            <div className="min-w-0">
                              <p className="text-foreground truncate">{s.label}</p>
                              <p className="text-[10px] font-mono text-muted-foreground truncate">{s.id}</p>
                            </div>
                            <input
                              type="checkbox"
                              checked={granted.has(s.id)}
                              onChange={() => toggle(s.id)}
                              className="h-4 w-4 accent-primary shrink-0"
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {err && <p className="text-xs text-destructive">{err}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="h-8 px-3 rounded-md border border-input text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <Button size="sm" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1.5" />}
                Save
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
