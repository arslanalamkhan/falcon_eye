import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

const Dialog        = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogClose   = DialogPrimitive.Close

function DialogOverlay({ className, ...props }: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      className={cn(
        "fixed inset-0 z-50 bg-black/65 backdrop-blur-sm",
        "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

const SIZES = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-2xl",
} as const

/**
 * Bottom sheet on phones (thumb-reachable, full width), centered modal
 * from `sm` up. Scrolls internally when content is taller than the screen.
 */
function DialogContent({ className, overlayClassName, children, size = "md", hideClose, ...props }: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  size?: keyof typeof SIZES
  hideClose?: boolean
  /** e.g. a higher z-index for dialogs that must stack above the alert takeover */
  overlayClassName?: string
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay className={overlayClassName} />
      <DialogPrimitive.Content
        className={cn(
          "fixed z-50 flex w-full flex-col border-border bg-popover text-popover-foreground shadow-pop focus:outline-none",
          // Mobile: bottom sheet
          "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-2xl border-t pb-safe",
          // sm+: centered dialog
          "sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[88dvh] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:border sm:pb-0",
          SIZES[size],
          "duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
          "data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
          "sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:slide-in-from-left-1/2 sm:data-[state=open]:slide-in-from-top-[48%] sm:data-[state=closed]:slide-out-to-left-1/2 sm:data-[state=closed]:slide-out-to-top-[48%]",
          className
        )}
        {...props}
      >
        {/* Drag-handle affordance on the mobile sheet */}
        <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30 sm:hidden" aria-hidden />
        {children}
        {!hideClose && (
          <DialogPrimitive.Close
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

function DialogHeader({ className, icon: Icon, iconClassName, children, ...props }: React.HTMLAttributes<HTMLDivElement> & {
  icon?: React.ElementType
  iconClassName?: string
}) {
  return (
    <div className={cn("flex shrink-0 items-start gap-3 px-5 pb-2 pt-4 pr-12 sm:pt-5", className)} {...props}>
      {Icon && (
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary", iconClassName)}>
          <Icon className="h-4 w-4" aria-hidden />
        </div>
      )}
      <div className="min-w-0 flex-1 space-y-1">{children}</div>
    </div>
  )
}

function DialogBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("min-h-0 flex-1 overflow-y-auto px-5 py-3", className)} {...props} />
}

function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex shrink-0 flex-col-reverse gap-2 border-t border-border px-5 py-3.5 sm:flex-row sm:justify-end [&>button]:w-full sm:[&>button]:w-auto",
        className
      )}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn("text-base font-semibold leading-tight text-foreground", className)} {...props} />
}

function DialogDescription({ className, ...props }: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn("text-sm text-muted-foreground", className)} {...props} />
}

export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
