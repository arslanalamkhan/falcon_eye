import { useEffect, useState } from "react"
import { useLocation } from "react-router-dom"
import { Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import type { ConnectionState } from "@/hooks/useFirebaseConnection"
import type { AlertEvent } from "@/hooks/useAlertNotification"
import { matchNavItem } from "./navigation"
import { AlertBell } from "./AlertBell"
import { UserMenu } from "./UserMenu"
import logoMark from "@/images/logo-mark.png"

export default function Topbar({ activeAlerts, connection, onOpenSearch }: {
  activeAlerts: AlertEvent[]
  connection: ConnectionState
  onOpenSearch: () => void
}) {
  const { pathname } = useLocation()
  const page = matchNavItem(pathname)
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)

  return (
    <header className="sticky top-0 z-30 flex h-[var(--topbar-h)] shrink-0 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-xl supports-[backdrop-filter]:bg-background/65 sm:px-6">
      {/* Mobile brand */}
      <img src={logoMark} alt="Falcon Eye" className="h-8 w-8 rounded-md object-cover ring-1 ring-primary/30 md:hidden" />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{page?.label ?? "Falcon Eye"}</p>
        <p className="hidden truncate text-xs text-muted-foreground sm:block">{page?.description}</p>
      </div>

      {/* Search trigger */}
      <button
        type="button"
        onClick={onOpenSearch}
        className="hidden h-9 w-60 shrink-0 items-center xl:w-72 whitespace-nowrap gap-2 rounded-lg border border-input bg-card/60 px-3 text-sm text-muted-foreground transition-colors hover:border-muted-foreground/40 hover:text-foreground lg:flex"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 truncate whitespace-nowrap text-left">Search sites & pages…</span>
        <kbd className="shrink-0 rounded border border-border bg-muted px-1.5 font-mono text-2xs">{isMac ? "⌘" : "Ctrl"} K</kbd>
      </button>
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onOpenSearch} aria-label="Search">
        <Search />
      </Button>

      <ConnectionPill state={connection} />
      <AlertBell alerts={activeAlerts} />
      <UserMenu />
    </header>
  )
}

function ConnectionPill({ state }: { state: ConnectionState }) {
  return (
    <div
      className={cn(
        "hidden h-9 items-center gap-2 rounded-lg border px-3 text-xs font-medium xl:flex",
        state === "online"     && "border-success/25 bg-success/10 text-success",
        state === "connecting" && "border-border bg-card/60 text-muted-foreground",
        state === "offline"    && "border-danger/30 bg-danger/10 text-danger"
      )}
      role="status"
      aria-live="polite"
    >
      <span className="relative flex h-2 w-2">
        {state === "online" && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-50" />}
        <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
      </span>
      {state === "online" ? "Live" : state === "connecting" ? "Connecting" : "Offline"}
      <span className="h-3.5 w-px bg-current opacity-25" aria-hidden />
      <Clock />
    </div>
  )
}

// Isolated so the per-second tick doesn't re-render the whole top bar
function Clock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <time className="font-mono tabular-nums text-foreground/90" dateTime={now.toISOString()}>
      {now.toLocaleTimeString("en-PK", { hour12: false })}
    </time>
  )
}
