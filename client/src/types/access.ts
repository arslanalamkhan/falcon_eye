// Shared access-control types — role, department, and the visible-site
// access set returned by GET /api/auth/me and used throughout the app.

export type Role = 'super_admin' | 'dept_admin' | 'supervisor' | 'operator'

export type ViewScope = 'own' | 'all' | 'selected'

export type Department = {
  id: number
  code: string
  name: string
  view_scope: ViewScope
  is_head: boolean
  active: boolean
}

export type VisibleSite = {
  id: string
  department_id: number
  department_code: string
}

export type Access = {
  allSites: boolean
  siteIds: string[] | null
  sites: VisibleSite[]
}

export type CurrentUser = {
  id: number
  email: string
  role: Role
  full_name: string
}

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: 'Super Admin',
  dept_admin:  'Department Admin',
  supervisor:  'Supervisor',
  operator:    'Operator',
}

export const ADMIN_ROLES: Role[] = ['super_admin', 'dept_admin']

export function isAdminRole(role: Role | undefined): boolean {
  return !!role && ADMIN_ROLES.includes(role)
}
