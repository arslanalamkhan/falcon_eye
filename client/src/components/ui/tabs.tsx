import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"

export type TabItem<T extends string> = {
  id: T
  label: string
  icon?: React.ElementType
  count?: number
}

/**
 * Accessible, horizontally scrollable tab bar (role="tablist") with
 * arrow-key navigation. Controlled — the parent owns `value`.
 */
function Tabs<T extends string>({ items, value, onChange, className }: {
  items: TabItem<T>[]
  value: T
  onChange: (id: T) => void
  className?: string
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const activeIndex = items.findIndex((i) => i.id === value)

  // Keep the active tab in view when the bar overflows (phones, deep links)
  useEffect(() => {
    refs.current[activeIndex]?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" })
  }, [activeIndex])

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    const last = items.length - 1
    let next = -1
    if (e.key === "ArrowRight") next = index === last ? 0 : index + 1
    if (e.key === "ArrowLeft")  next = index === 0 ? last : index - 1
    if (e.key === "Home") next = 0
    if (e.key === "End")  next = last
    if (next >= 0) {
      e.preventDefault()
      refs.current[next]?.focus()
      onChange(items[next].id)
    }
  }

  return (
    <div
      role="tablist"
      className={cn(
        "scrollbar-none -mx-4 flex gap-1 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0",
        className
      )}
    >
      {items.map(({ id, label, icon: Icon, count }, i) => {
        const active = id === value
        return (
          <button
            key={id}
            ref={(el) => { refs.current[i] = el }}
            role="tab"
            type="button"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "relative -mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring rounded-t-md",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
            )}
          >
            {Icon && <Icon className={cn("h-4 w-4", active ? "text-primary" : "")} aria-hidden />}
            {label}
            {count !== undefined && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-px font-mono text-2xs tabular-nums",
                  active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                )}
              >
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/** Compact pill filter group (e.g. department chips). */
function ChipGroup<T extends string>({ options, value, onChange, allLabel = "All", className }: {
  options: { value: T; label: string }[]
  value: T | null
  onChange: (value: T | null) => void
  allLabel?: string
  className?: string
}) {
  const chip = (active: boolean) => cn(
    "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    active
      ? "border-primary/40 bg-primary/15 text-primary"
      : "border-border bg-card/50 text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground"
  )
  return (
    <div className={cn("scrollbar-none flex items-center gap-1.5 overflow-x-auto", className)} role="group">
      <button type="button" aria-pressed={value === null} onClick={() => onChange(null)} className={chip(value === null)}>
        {allLabel}
      </button>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(chip(value === o.value), "font-mono")}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export { Tabs, ChipGroup }
