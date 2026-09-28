import { useEffect, useState, type ReactNode } from "react"
import { WifiOff } from "lucide-react"
import { cn } from "@/lib/utils"
import { setAlertCountInTitle } from "@/lib/title"
import { useAlertNotification } from "@/hooks/useAlertNotification"
import { useFirebaseConnection } from "@/hooks/useFirebaseConnection"
import Sidebar from "./Sidebar"
import Topbar from "./Topbar"
import MobileNav from "./MobileNav"
import AlertPopup from "./AlertPopup"
import CommandPalette from "./CommandPalette"

export default function DashboardLayout({ children, fullBleed = false }: {
  children: ReactNode
  /** Edge-to-edge content with a fixed height (the live map). */
  fullBleed?: boolean
}) {
  const { activeAlert, queueLength, dismiss, activeAlerts } = useAlertNotification()
  const connection = useFirebaseConnection()
  const [searchOpen, setSearchOpen] = useState(false)

  // Ctrl/⌘+K opens the command palette from anywhere
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setSearchOpen((o) => !o)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  useEffect(() => {
    setAlertCountInTitle(activeAlerts.length)
  }, [activeAlerts.length])

  return (
    <div className="flex min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-[70] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <Sidebar alertCount={activeAlerts.length} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar activeAlerts={activeAlerts} connection={connection} onOpenSearch={() => setSearchOpen(true)} />

        {connection === "offline" && (
          <div role="alert" className="flex items-center justify-center gap-2 border-b border-danger/30 bg-danger/10 px-4 py-2 text-xs font-medium text-danger">
            <WifiOff className="h-3.5 w-3.5 shrink-0" />
            Live feed disconnected — alerts and positions may be out of date. Reconnecting…
          </div>
        )}

        <main
          id="main"
          className={cn(
            fullBleed
              ? "relative h-content min-h-0 overflow-hidden"
              : "flex-1 px-4 pb-[calc(var(--mobile-nav-h)+env(safe-area-inset-bottom)+1.5rem)] pt-5 sm:px-6 md:pb-10 lg:px-8 lg:pt-7"
          )}
        >
          {fullBleed ? children : <div className="mx-auto w-full max-w-[1600px]">{children}</div>}
        </main>
      </div>

      <MobileNav alertCount={activeAlerts.length} />
      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />

      {activeAlert && <AlertPopup alert={activeAlert} queueLength={queueLength} onDismiss={dismiss} />}
    </div>
  )
}
