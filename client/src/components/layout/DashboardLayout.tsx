import type { ReactNode } from "react"
import Sidebar from "./Sidebar"
import Topbar  from "./Topbar"
import AlertPopup from "./AlertPopup"
import { useAlertNotification } from "@/hooks/useAlertNotification"

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { activeAlert, queueLength, dismiss } = useAlertNotification()

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {activeAlert && (
        <AlertPopup
          alert={activeAlert}
          queueLength={queueLength}
          onDismiss={dismiss}
        />
      )}
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-5">
          {children}
        </main>
      </div>
    </div>
  )
}
