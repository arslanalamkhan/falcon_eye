import { cn } from "@/lib/utils"

/** Accessible on/off switch (role="switch"). */
function Switch({ checked, onCheckedChange, disabled, label, className }: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  /** Accessible name — required since the switch has no visible text. */
  label: string
  className?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-success" : "bg-input",
        className
      )}
    >
      <span
        className={cn(
          "pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ease-out-expo",
          checked ? "translate-x-4" : "translate-x-0.5"
        )}
      />
    </button>
  )
}

export { Switch }
