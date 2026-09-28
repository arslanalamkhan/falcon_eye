// Shared building blocks reused across Admin panel tabs.
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Loader2, Trash2, Eye } from "lucide-react"
import type { Role } from "@/types/access"

export const ROLE_BADGE_VARIANT: Record<Role, 'danger' | 'warning' | 'info' | 'success'> = {
  super_admin: 'danger',
  dept_admin:  'warning',
  supervisor:  'info',
  operator:    'success',
}

export function CountBadge({ n }: { n: number }) {
  return (
    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">{n}</span>
  )
}

export function DepartmentBadge({ code }: { code: string }) {
  return <Badge variant="info" className="text-[10px] font-mono">{code}</Badge>
}

export function FormField({ label, value, onChange, placeholder, required, mono, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; required?: boolean; mono?: boolean; type?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className={cn(
          "h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary",
          mono && "font-mono"
        )}
      />
    </div>
  )
}

export function EntityTable({ columns, rows, onDelete, deletingId, canDelete, extraAction, extraActionIcon: ExtraIcon = Eye, extraActionTitle = 'Manage' }: {
  columns: string[]
  rows: { key: string; cells: React.ReactNode[] }[]
  onDelete?: (id: string) => void
  deletingId: string | null
  canDelete?: (id: string) => boolean
  extraAction?: (id: string) => void
  extraActionIcon?: React.ElementType
  extraActionTitle?: string
}) {
  if (rows.length === 0) return (
    <div className="rounded-lg border border-border py-12 text-center text-sm text-muted-foreground">
      No entries yet.
    </div>
  )
  const hasActionsCol = !!onDelete || !!extraAction
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/30">
          <tr>
            {columns.map(c => (
              <th key={c} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">{c}</th>
            ))}
            {hasActionsCol && <th className="px-4 py-2.5 w-16" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map(({ key, cells }) => (
            <tr key={key} className="hover:bg-muted/20 transition-colors">
              {cells.map((cell, i) => (
                <td key={i} className="px-4 py-3 text-foreground">{cell}</td>
              ))}
              {hasActionsCol && (
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {extraAction && (
                      <button
                        onClick={() => extraAction(key)}
                        className="text-muted-foreground hover:text-primary transition-colors"
                        title={extraActionTitle}
                      >
                        <ExtraIcon className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {onDelete && (!canDelete || canDelete(key)) && (
                      <button
                        onClick={() => onDelete(key)}
                        disabled={deletingId === key}
                        className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                      >
                        {deletingId === key
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
