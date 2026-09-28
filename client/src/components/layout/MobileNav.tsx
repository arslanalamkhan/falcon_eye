import { NavLink } from "react-router-dom"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/AuthContext"
import { navItemsFor } from "./navigation"

/** Thumb-reachable bottom tab bar for phones (hidden from md up). */
export default function MobileNav({ alertCount }: { alertCount: number }) {
  const { user } = useAuth()
  const items = navItemsFor(user?.role)

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 pb-safe backdrop-blur-xl md:hidden"
      aria-label="Primary"
    >
      <ul className={cn("mx-auto grid h-[var(--mobile-nav-h)] max-w-md", items.length >= 4 ? "grid-cols-4" : "grid-cols-3")}>
        {items.map((item) => {
          const badge = item.to === "/" ? alertCount : 0
          return (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  cn(
                    "flex h-full flex-col items-center justify-center gap-1 text-2xs font-medium transition-colors",
                    isActive ? "text-primary" : "text-muted-foreground active:text-foreground"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={cn("relative flex h-8 w-14 items-center justify-center rounded-full transition-colors", isActive && "bg-primary/15")}>
                      <item.icon className="h-5 w-5" />
                      {badge > 0 && (
                        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-2xs font-bold leading-none text-danger-foreground ring-2 ring-background">
                          {badge}
                        </span>
                      )}
                    </span>
                    {item.short}
                  </>
                )}
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
