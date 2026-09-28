import { Fragment } from "react"
import { MoreHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"

export type Column<T> = {
  id: string
  header: React.ReactNode
  cell: (row: T) => React.ReactNode
  className?: string
  /**
   * How the column appears in the stacked card view on phones:
   * `title`/`subtitle` form the card heading, `field` becomes a labelled
   * row, `hidden` is desktop-only. Defaults to `field`.
   */
  mobile?: "title" | "subtitle" | "field" | "hidden"
}

/**
 * Table on md+ screens, stacked cards on phones — so admin lists never
 * force horizontal page scroll on mobile.
 */
function DataTable<T>({ columns, rows, rowKey, actions, empty, rowClassName, className }: {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string | number
  actions?: (row: T) => React.ReactNode
  empty?: React.ReactNode
  rowClassName?: (row: T) => string | undefined
  className?: string
}) {
  if (rows.length === 0) return <>{empty}</>

  const titleCol    = columns.find((c) => c.mobile === "title") ?? columns[0]
  const subtitleCol = columns.find((c) => c.mobile === "subtitle")
  const fieldCols   = columns.filter((c) => c !== titleCol && c !== subtitleCol && c.mobile !== "hidden")

  return (
    <div className={className}>
      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {columns.map((c) => (
                <th
                  key={c.id}
                  scope="col"
                  className={cn("whitespace-nowrap px-4 py-2.5 text-left text-xs font-medium text-muted-foreground first:pl-5", c.className)}
                >
                  {c.header}
                </th>
              ))}
              {actions && <th scope="col" className="w-12 px-4 py-2.5"><span className="sr-only">Actions</span></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={rowKey(row)} className={cn("transition-colors hover:bg-accent/40", rowClassName?.(row))}>
                {columns.map((c) => (
                  <td key={c.id} className={cn("px-4 py-3 align-middle first:pl-5", c.className)}>
                    {c.cell(row)}
                  </td>
                ))}
                {actions && <td className="px-4 py-3 text-right">{actions(row)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ul className="divide-y divide-border md:hidden">
        {rows.map((row) => (
          <li key={rowKey(row)} className={cn("px-4 py-3.5", rowClassName?.(row))}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-foreground">{titleCol.cell(row)}</div>
                {subtitleCol && <div className="mt-0.5 text-xs text-muted-foreground">{subtitleCol.cell(row)}</div>}
              </div>
              {actions && <div className="-mr-1.5 -mt-1 shrink-0">{actions(row)}</div>}
            </div>
            {fieldCols.length > 0 && (
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5">
                {fieldCols.map((c) => (
                  <div key={c.id} className="min-w-0">
                    <dt className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">{c.header}</dt>
                    <dd className="mt-0.5 min-w-0 text-sm">{c.cell(row)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

export type RowAction = {
  label: string
  icon?: React.ElementType
  onSelect: () => void
  destructive?: boolean
  hidden?: boolean
  /** Adds a separator above this item. */
  separated?: boolean
}

/** "⋯" menu for per-row actions. Renders nothing if every action is hidden. */
function RowActions({ actions, label = "Row actions" }: { actions: RowAction[]; label?: string }) {
  const visible = actions.filter((a) => !a.hidden)
  if (visible.length === 0) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={label}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {visible.map((a, i) => (
          <Fragment key={a.label}>
            {a.separated && i > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem icon={a.icon} destructive={a.destructive} onSelect={a.onSelect}>
              {a.label}
            </DropdownMenuItem>
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export { DataTable, RowActions }
