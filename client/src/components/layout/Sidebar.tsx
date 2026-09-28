import { NavLink } from "react-router-dom"
import { PanelLeftClose, PanelLeftOpen, Building2, Globe } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/AuthContext"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import { usePersistentState } from "@/hooks/usePersistentState"
import { Tip } from "@/components/ui/tooltip"
import { navItemsFor } from "./navigation"
import logoMark from "@/images/logo-mark.png"

const SCOPE_LABEL = { own: "Own sites", all: "All departments", selected: "Selected departments" } as const

export default function Sidebar({ alertCount }: { alertCount: number }) {
  const { user, department } = useAuth()
  const isDesktop = useMediaQuery("(min-width: 1024px)")
  const [collapsed, setCollapsed] = usePersistentState("fe.sidebar.collapsed", false)
  // Tablets always get the compact rail; desktops follow the user's preference
  const compact = !isDesktop || collapsed
  const items = navItemsFor(user?.role)

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-300 ease-out-expo md:flex",
        compact ? "w-[72px]" : "w-64"
      )}
      aria-label="Primary"
    >
      {/* Brand */}
      <div className={cn("flex h-[var(--topbar-h)] shrink-0 items-center gap-3 border-b border-sidebar-border", compact ? "justify-center px-2" : "px-4")}>
        <img src={logoMark} alt="" className="h-9 w-9 rounded-lg object-cover ring-1 ring-primary/30" />
        {!compact && (
          <div className="min-w-0 leading-tight">
            <p className="text-sm font-bold tracking-[0.18em] text-foreground">FALCON EYE</p>
            <p className="text-2xs text-muted-foreground">Command Center</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {!compact && (
          <p className="px-3 pb-2 text-2xs font-semibold uppercase tracking-wider text-muted-foreground/70">Navigation</p>
        )}
        {items.map((item) => {
          const badge = item.to === "/" && alertCount > 0 ? alertCount : 0
          return (
            <Tip key={item.to} content={item.label} side="right" disabled={!compact}>
              <NavLink
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  cn(
                    "group relative flex h-10 items-center gap-3 rounded-lg text-sm font-medium transition-colors",
                    compact ? "justify-center px-0" : "px-3",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-sidebar-primary" aria-hidden />}
                    <item.icon className={cn("h-[18px] w-[18px] shrink-0", isActive ? "text-sidebar-primary" : "text-muted-foreground group-hover:text-foreground")} />
                    {!compact && <span className="flex-1 truncate">{item.label}</span>}
                    {badge > 0 && (
                      <span
                        className={cn(
                          "flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-2xs font-bold text-danger-foreground shadow-glow-danger",
                          compact && "absolute right-2 top-1 h-4 min-w-4 px-1"
                        )}
                        aria-label={`${badge} active alert${badge === 1 ? "" : "s"}`}
                      >
                        {badge}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            </Tip>
          )
        })}
      </nav>

      {/* Department + collapse */}
      <div className="space-y-2 border-t border-sidebar-border p-3">
        {department && (
          <Tip content={`${department.name} · ${SCOPE_LABEL[department.view_scope]}`} side="right" disabled={!compact}>
            <div className={cn("flex items-center gap-3 rounded-lg border border-sidebar-border bg-sidebar-accent/40", compact ? "justify-center p-2" : "p-2.5")}>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
                {department.view_scope === "all" ? <Globe className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
              </div>
              {!compact && (
                <div className="min-w-0 leading-tight">
                  <p className="truncate text-xs font-semibold text-foreground">{department.code}</p>
                  <p className="truncate text-2xs text-muted-foreground">{SCOPE_LABEL[department.view_scope]}</p>
                </div>
              )}
            </div>
          </Tip>
        )}
        {isDesktop && (
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className={cn(
              "flex h-9 w-full items-center gap-2 rounded-lg text-xs font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground",
              compact ? "justify-center" : "px-3"
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <><PanelLeftClose className="h-4 w-4" /> Collapse</>}
          </button>
        )}
      </div>
    </aside>
  )
}
