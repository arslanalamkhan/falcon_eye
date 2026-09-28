import * as React from "react"
import { cn } from "@/lib/utils"

// min-w-0: cards are often grid/flex children; without it, long truncated
// text sets their min-content width and overflows the page on phones.
function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("min-w-0 rounded-xl border border-border bg-card text-card-foreground shadow-card", className)}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5", className)}
      {...props}
    />
  )
}

function CardTitle({ className, icon: Icon, children, ...props }: React.HTMLAttributes<HTMLHeadingElement> & { icon?: React.ElementType }) {
  return (
    <h2 className={cn("flex items-center gap-2 text-sm font-semibold text-foreground", className)} {...props}>
      {Icon && <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />}
      {children}
    </h2>
  )
}

function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-xs text-muted-foreground", className)} {...props} />
}

function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4 sm:p-5", className)} {...props} />
}

function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex items-center gap-2 border-t border-border px-4 py-3 sm:px-5", className)} {...props} />
  )
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter }
