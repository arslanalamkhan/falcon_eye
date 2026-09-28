import * as React from "react"
import * as DropdownPrimitive from "@radix-ui/react-dropdown-menu"
import { cn } from "@/lib/utils"

const DropdownMenu        = DropdownPrimitive.Root
const DropdownMenuTrigger = DropdownPrimitive.Trigger
const DropdownMenuGroup   = DropdownPrimitive.Group

function DropdownMenuContent({ className, sideOffset = 6, align = "end", ...props }: React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Content>) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content
        sideOffset={sideOffset}
        align={align}
        className={cn(
          "z-50 min-w-[12rem] overflow-hidden rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-pop",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          className
        )}
        {...props}
      />
    </DropdownPrimitive.Portal>
  )
}

function DropdownMenuItem({ className, icon: Icon, destructive, children, ...props }: React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Item> & {
  icon?: React.ElementType
  destructive?: boolean
}) {
  return (
    <DropdownPrimitive.Item
      className={cn(
        "relative flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none transition-colors",
        "focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        destructive && "text-danger focus:bg-danger/10 focus:text-danger",
        className
      )}
      {...props}
    >
      {Icon && <Icon className={cn("h-4 w-4 shrink-0", destructive ? "text-danger" : "text-muted-foreground")} aria-hidden />}
      {children}
    </DropdownPrimitive.Item>
  )
}

function DropdownMenuLabel({ className, ...props }: React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Label>) {
  return <DropdownPrimitive.Label className={cn("px-2.5 py-1.5 text-xs font-medium text-muted-foreground", className)} {...props} />
}

function DropdownMenuSeparator({ className, ...props }: React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Separator>) {
  return <DropdownPrimitive.Separator className={cn("-mx-1.5 my-1.5 h-px bg-border", className)} {...props} />
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup,
}
