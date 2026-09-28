import * as React from "react"
import { ChevronDown, Search, X } from "lucide-react"
import { cn } from "@/lib/utils"

const controlBase =
  "flex h-10 w-full rounded-lg border border-input bg-background/60 px-3 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground/70 hover:border-muted-foreground/40 focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-danger sm:h-9"

// ── Input ────────────────────────────────────────────────────────────
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Icon rendered inside the field on the left. */
  icon?: React.ElementType
  /** Element rendered inside the field on the right (e.g. a toggle button). */
  trailing?: React.ReactNode
  mono?: boolean
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, icon: Icon, trailing, mono, ...props }, ref) => {
    if (!Icon && !trailing) {
      return <input ref={ref} className={cn(controlBase, mono && "font-mono", className)} {...props} />
    }
    return (
      <div className="relative w-full">
        {Icon && (
          <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        )}
        <input
          ref={ref}
          className={cn(controlBase, Icon && "pl-9", trailing && "pr-10", mono && "font-mono", className)}
          {...props}
        />
        {trailing && <div className="absolute right-1.5 top-1/2 -translate-y-1/2">{trailing}</div>}
      </div>
    )
  }
)
Input.displayName = "Input"

// ── SearchInput — Input with a search icon and a clear button ───────
function SearchInput({ value, onChange, placeholder = "Search…", className, ...props }: Omit<InputProps, "onChange" | "value"> & {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <Input
      type="search"
      icon={Search}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      className={cn("[&::-webkit-search-cancel-button]:hidden", className)}
      trailing={value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : undefined}
      {...props}
    />
  )
}

// ── Select — styled native select (best UX on mobile) ──────────────
const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className="relative w-full">
      <select ref={ref} className={cn(controlBase, "cursor-pointer appearance-none pr-9", className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
    </div>
  )
)
Select.displayName = "Select"

// ── Label + Field ────────────────────────────────────────────────────
function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-xs font-medium text-foreground/90", className)} {...props} />
}

/**
 * Label + control + optional hint/error. Wires `htmlFor`/`id` and
 * `aria-describedby` automatically when the child is a single element.
 */
function Field({ label, hint, error, required, className, children }: {
  label: string
  hint?: React.ReactNode
  error?: string
  required?: boolean
  className?: string
  children: React.ReactElement<{ id?: string; "aria-describedby"?: string; "aria-invalid"?: boolean }>
}) {
  const id = React.useId()
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {required && <span className="ml-0.5 text-danger" aria-hidden>*</span>}
      </Label>
      {React.cloneElement(children, {
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
      })}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-danger">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

export { Input, SearchInput, Select, Label, Field }
