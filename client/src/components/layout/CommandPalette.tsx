import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Search, CornerDownLeft, MapPin, TrainFront, Pickaxe, Radio } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/AuthContext"
import { navItemsFor } from "./navigation"

type Result = {
  id: string
  group: "Pages" | "Sites"
  label: string
  hint: string
  icon: React.ElementType
  to: string
}

const SITE_ICON = { train: TrainFront, mine: Pickaxe, other: Radio } as const

/** Ctrl/⌘+K quick switcher — jump to a page or locate any visible site on the map. */
export default function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { user, access } = useAuth()
  const navigate = useNavigate()
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase()
    const pages: Result[] = navItemsFor(user?.role).map((p) => ({
      id: `page:${p.to}`, group: "Pages", label: p.label, hint: p.description, icon: p.icon, to: p.to,
    }))
    const sites: Result[] = (access?.sites ?? []).map((s) => ({
      id: `site:${s.id}`, group: "Sites", label: s.label, hint: `${s.id} · ${s.department_code}`,
      icon: SITE_ICON[s.type] ?? MapPin, to: `/map?site=${encodeURIComponent(s.id)}`,
    }))
    const match = (r: Result) => !q || r.label.toLowerCase().includes(q) || r.hint.toLowerCase().includes(q)
    return [...pages.filter(match), ...sites.filter(match).slice(0, 30)]
  }, [query, user?.role, access])

  const go = (r: Result | undefined) => {
    if (!r) return
    navigate(r.to)
    close()
  }

  const close = () => {
    onOpenChange(false)
    setQuery("")
    setActive(0)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, results.length - 1)) }
    if (e.key === "ArrowUp")   { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)) }
    if (e.key === "Enter")     { e.preventDefault(); go(results[active]) }
  }

  let lastGroup = ""

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed inset-x-3 top-3 z-50 mx-auto flex max-h-[80dvh] max-w-xl flex-col overflow-hidden rounded-xl border border-border bg-popover shadow-pop focus:outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-4 sm:top-[12vh]"
          aria-describedby={undefined}
        >
          <DialogPrimitive.Title className="sr-only">Search</DialogPrimitive.Title>
          <div className="flex items-center gap-3 border-b border-border px-4">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActive(0) }}
              onKeyDown={onKeyDown}
              placeholder="Search sites and pages…"
              className="h-12 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              role="combobox"
              aria-expanded
              aria-controls="command-results"
              aria-activedescendant={results[active]?.id}
            />
            <kbd className="hidden rounded border border-border bg-muted px-1.5 font-mono text-2xs text-muted-foreground sm:block">Esc</kbd>
          </div>

          <ul id="command-results" role="listbox" className="flex-1 overflow-y-auto p-2">
            {results.length === 0 && (
              <li className="px-3 py-10 text-center text-sm text-muted-foreground">No matches for “{query}”</li>
            )}
            {results.map((r, i) => {
              const header = r.group !== lastGroup ? r.group : null
              lastGroup = r.group
              return (
                <li key={r.id} role="presentation">
                  {header && <p className="px-2.5 pb-1 pt-2 text-2xs font-semibold uppercase tracking-wider text-muted-foreground/70">{header}</p>}
                  <div
                    id={r.id}
                    role="option"
                    aria-selected={i === active}
                    onMouseMove={() => setActive(i)}
                    onClick={() => go(r)}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2",
                      i === active ? "bg-accent text-accent-foreground" : "text-foreground"
                    )}
                  >
                    <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md border", i === active ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-muted/50 text-muted-foreground")}>
                      <r.icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{r.label}</p>
                      <p className="truncate text-xs text-muted-foreground">{r.hint}</p>
                    </div>
                    {i === active && <CornerDownLeft className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </li>
              )
            })}
          </ul>

          <div className="hidden items-center gap-4 border-t border-border px-4 py-2 text-2xs text-muted-foreground sm:flex">
            <span><kbd className="font-mono">↑↓</kbd> navigate</span>
            <span><kbd className="font-mono">↵</kbd> open</span>
            <span className="ml-auto">Sites open on the live map</span>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
