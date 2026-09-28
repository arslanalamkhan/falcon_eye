import { usePageTitle } from "@/hooks/usePageTitle"
import { cn } from "@/lib/utils"

/** Consistent page title block. Also sets the browser tab title. */
export function PageHeader({ title, description, actions, className }: {
  title: string
  description?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  usePageTitle(title)
  return (
    <div className={cn("mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
