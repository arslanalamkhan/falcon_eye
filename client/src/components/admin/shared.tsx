// Shared building blocks reused across Admin panel tabs.
import { Lock } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { SkeletonRows } from "@/components/ui/skeleton"
import { ROLE_LABELS, type Role } from "@/types/access"

const ROLE_BADGE_VARIANT: Record<Role, "default" | "info" | "secondary" | "outline"> = {
  super_admin: "default",
  dept_admin:  "info",
  supervisor:  "secondary",
  operator:    "outline",
}

export function RoleBadge({ role }: { role: Role }) {
  return <Badge variant={ROLE_BADGE_VARIANT[role]} size="sm">{ROLE_LABELS[role]}</Badge>
}

export function DepartmentBadge({ code, className }: { code: string; className?: string }) {
  return <Badge variant="outline" size="sm" className={cn("font-mono", className)}>{code}</Badge>
}

/** Marks a row the current admin can see but not change (another department's data). */
export function ReadOnlyHint({ label = "Read-only" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-2xs text-muted-foreground" title="Managed by another department">
      <Lock className="h-3 w-3" /> {label}
    </span>
  )
}

/** Search/filter controls on the left, primary action on the right (stacks on phones). */
export function PanelToolbar({ children, actions }: { children?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">{children}</div>
      {actions && <div className="flex shrink-0 gap-2 [&>*]:flex-1 sm:[&>*]:flex-none">{actions}</div>}
    </div>
  )
}

export function PanelSkeleton() {
  return (
    <Card className="p-5">
      <SkeletonRows rows={6} />
    </Card>
  )
}

export function KeyValue({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-0.5 truncate text-sm">{children}</div>
    </div>
  )
}
