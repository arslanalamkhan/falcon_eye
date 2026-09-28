import { LayoutDashboard, MapPinned, Camera, SlidersHorizontal } from "lucide-react"
import type { Role } from "@/types/access"

export type NavItem = {
  to: string
  label: string
  /** Shorter label for the mobile bottom bar. */
  short: string
  description: string
  icon: React.ElementType
  roles?: Role[]
}

// Single source for the sidebar, mobile bar, top bar title and command palette.
export const NAV_ITEMS: NavItem[] = [
  { to: "/",        label: "Dashboard",    short: "Overview", description: "Live overview, alerts and site status", icon: LayoutDashboard },
  { to: "/map",     label: "Live Map",     short: "Map",      description: "Real-time GPS positions of every site", icon: MapPinned },
  { to: "/cameras", label: "Camera Feeds", short: "Cameras",  description: "Live surveillance video per site",       icon: Camera },
  { to: "/admin",   label: "Administration", short: "Admin",  description: "Departments, users, sites and routing", icon: SlidersHorizontal, roles: ["super_admin", "dept_admin"] },
]

export function navItemsFor(role: Role | undefined): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.roles || (role && item.roles.includes(role)))
}

export function matchNavItem(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => (item.to === "/" ? pathname === "/" : pathname.startsWith(item.to)))
}
