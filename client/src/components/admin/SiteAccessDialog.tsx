import { useState, useEffect, useMemo } from "react"
import { toast } from "sonner"
import { MapPin, Check } from "lucide-react"
import { api } from "@/lib/api"
import { cn, errorMessage } from "@/lib/utils"
import { pluralize } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { SearchInput } from "@/components/ui/input"
import { SkeletonRows } from "@/components/ui/skeleton"
import {
  Dialog, DialogContent, DialogHeader, DialogBody, DialogFooter, DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import type { Site } from "./types"

// Lets a department admin (or super admin) choose which sites an operator
// can see. Candidates are the sites already visible to the admin within the
// operator's department; the server re-validates on save regardless.
export function SiteAccessDialog({ userId, userName, candidateSites, onClose }: {
  userId: number; userName: string; candidateSites: Site[]; onClose: () => void
}) {
  const [granted, setGranted] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState("")
  const [search, setSearch]   = useState("")

  useEffect(() => {
    api.get<string[]>(`/api/users/${userId}/sites`)
      .then((ids) => setGranted(new Set(ids)))
      .catch((err) => setError(errorMessage(err, "Couldn't load current access")))
      .finally(() => setLoading(false))
  }, [userId])

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = q
      ? candidateSites.filter((s) => s.label.toLowerCase().includes(q) || s.id.toLowerCase().includes(q))
      : candidateSites
    const byDept = new Map<string, Site[]>()
    for (const s of filtered) byDept.set(s.department_code, [...(byDept.get(s.department_code) ?? []), s])
    return [...byDept.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [candidateSites, search])

  const toggle = (id: string) => setGranted((prev) => {
    const s = new Set(prev)
    if (s.has(id)) s.delete(id)
    else s.add(id)
    return s
  })

  const setMany = (sites: Site[], on: boolean) => setGranted((prev) => {
    const s = new Set(prev)
    for (const site of sites) {
      if (on) s.add(site.id)
      else s.delete(site.id)
    }
    return s
  })

  const save = async () => {
    setError("")
    setSaving(true)
    try {
      await api.put(`/api/users/${userId}/sites`, { siteIds: [...granted] })
      toast.success(`Site access updated`, { description: `${userName} can now see ${pluralize(granted.size, "site")}.` })
      onClose()
    } catch (err) {
      setError(errorMessage(err, "Failed to save"))
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent size="md">
        <DialogHeader icon={MapPin}>
          <DialogTitle>Site access</DialogTitle>
          <DialogDescription>Choose which sites {userName} can monitor.</DialogDescription>
        </DialogHeader>

        <div className="shrink-0 px-5 pb-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Search sites…" />
        </div>

        <DialogBody className="min-h-[12rem] space-y-4">
          {loading ? (
            <SkeletonRows rows={4} />
          ) : grouped.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {candidateSites.length === 0 ? "This department has no sites yet." : "No sites match."}
            </p>
          ) : (
            grouped.map(([dept, deptSites]) => {
              const allOn = deptSites.every((s) => granted.has(s.id))
              return (
                <section key={dept}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <h3 className="font-mono text-2xs font-semibold uppercase tracking-wider text-muted-foreground">{dept}</h3>
                    <button type="button" onClick={() => setMany(deptSites, !allOn)} className="text-xs font-medium text-primary hover:underline">
                      {allOn ? "Clear all" : "Select all"}
                    </button>
                  </div>
                  <ul className="overflow-hidden rounded-lg border border-border">
                    {deptSites.map((s) => {
                      const on = granted.has(s.id)
                      return (
                        <li key={s.id} className="border-b border-border last:border-0">
                          <label className={cn("flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors", on ? "bg-primary/10" : "hover:bg-accent/40")}>
                            <input type="checkbox" checked={on} onChange={() => toggle(s.id)} className="peer sr-only" />
                            <span className={cn(
                              "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring",
                              on ? "border-primary bg-primary text-primary-foreground" : "border-input"
                            )}>
                              {on && <Check className="h-3.5 w-3.5" />}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">{s.label}</span>
                              <span className="block truncate font-mono text-xs text-muted-foreground">{s.id}</span>
                            </span>
                          </label>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )
            })
          )}
          {error && <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        </DialogBody>

        <DialogFooter className="sm:justify-between">
          <p className="hidden self-center text-xs text-muted-foreground sm:block">{pluralize(granted.size, "site")} selected</p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={save} loading={saving} disabled={loading}>Save access</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
