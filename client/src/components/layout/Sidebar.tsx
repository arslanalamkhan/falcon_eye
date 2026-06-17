import { useState } from "react"
import { NavLink } from "react-router-dom"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"
import { useAuth } from "@/contexts/AuthContext"
import type { Role } from "@/contexts/AuthContext"
import {
  LayoutDashboard,
  MapPin,
  Camera,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import logoSrc from "@/images/Logo.png"

type NavItem = {
  icon: React.ElementType
  label: string
  to: string
  allowedRoles?: Role[]
}

const navItems: { group: string; items: NavItem[] }[] = [
  {
    group: "Overview",
    items: [
      { icon: LayoutDashboard, label: "Dashboard",    to: "/"        },
      { icon: MapPin,          label: "Live Map",     to: "/map"     },
      { icon: Camera,          label: "Camera Feeds", to: "/cameras" },
    ],
  },
  {
    group: "System",
    items: [
      { icon: SlidersHorizontal, label: "Admin Panel", to: "/admin", allowedRoles: ['admin', 'supervisor'] },
    ],
  },
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const { user } = useAuth()

  const visibleGroups = navItems
    .map(group => ({
      ...group,
      items: group.items.filter(item =>
        !item.allowedRoles || (user && item.allowedRoles.includes(user.role))
      ),
    }))
    .filter(group => group.items.length > 0)

  return (
    <aside
      className={cn(
        "relative flex flex-col h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300 ease-in-out",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo */}
      <div className={cn("flex items-center justify-center px-4 py-4", collapsed && "px-2")}>
        <img
          src={logoSrc}
          alt="Falcon Eye"
          className={cn("object-contain transition-all duration-300", collapsed ? "h-8 w-8" : "h-14 w-auto")}
        />
      </div>

      <Separator className="bg-sidebar-border" />

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {visibleGroups.map((group) => (
          <div key={group.group} className="mb-4">
            {!collapsed && (
              <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {group.group}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.label}>
                  <NavLink
                    to={item.to}
                    end={item.to === "/"}
                    title={collapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      cn(
                        "w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-primary"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                        collapsed && "justify-center px-0"
                      )
                    }
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!collapsed && (
                      <span className="flex-1 text-left">{item.label}</span>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <Separator className="bg-sidebar-border" />

      {/* Collapse toggle */}
      <div className="p-2">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "w-full flex items-center gap-2 rounded-md px-3 py-2 text-xs text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors",
            collapsed && "justify-center px-0"
          )}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  )
}
