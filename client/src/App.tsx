import { lazy, Suspense } from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { Toaster } from "sonner"
import { AuthProvider } from "@/contexts/AuthContext"
import type { Role } from "@/types/access"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ConfirmProvider } from "@/components/ui/confirm-dialog"
import ProtectedRoute from "@/components/layout/ProtectedRoute"
import DashboardLayout from "@/components/layout/DashboardLayout"
import { PageLoader } from "@/components/layout/SplashScreen"
import Login from "@/pages/Login"

// Route-level code splitting: Leaflet (map) and hls.js (cameras) are only
// downloaded when those pages are opened.
const Dashboard = lazy(() => import("@/pages/Dashboard"))
const LiveMap   = lazy(() => import("@/pages/LiveMap"))
const Cameras   = lazy(() => import("@/pages/Cameras"))
const Admin     = lazy(() => import("@/pages/Admin"))

function ProtectedPage({ children, allowedRoles, fullBleed }: {
  children: React.ReactNode
  allowedRoles?: Role[]
  fullBleed?: boolean
}) {
  return (
    <ProtectedRoute allowedRoles={allowedRoles}>
      <DashboardLayout fullBleed={fullBleed}>
        <Suspense fallback={<PageLoader />}>{children}</Suspense>
      </DashboardLayout>
    </ProtectedRoute>
  )
}

function App() {
  return (
    <BrowserRouter>
      <TooltipProvider delayDuration={250}>
        <AuthProvider>
          <ConfirmProvider>
            <Routes>
              <Route path="/login"   element={<Login />} />
              <Route path="/"        element={<ProtectedPage><Dashboard /></ProtectedPage>} />
              <Route path="/map"     element={<ProtectedPage fullBleed><LiveMap /></ProtectedPage>} />
              <Route path="/cameras" element={<ProtectedPage><Cameras /></ProtectedPage>} />
              <Route path="/admin"   element={<ProtectedPage allowedRoles={['super_admin', 'dept_admin']}><Admin /></ProtectedPage>} />
              <Route path="*"        element={<Navigate to="/" replace />} />
            </Routes>
          </ConfirmProvider>
        </AuthProvider>
        <Toaster
          theme="dark"
          position="top-right"
          closeButton
          toastOptions={{
            classNames: {
              toast: "!rounded-xl !border !border-border !bg-popover !text-popover-foreground !shadow-pop",
              description: "!text-muted-foreground",
              success: "[&_[data-icon]]:!text-success",
              error: "[&_[data-icon]]:!text-danger",
            },
          }}
        />
      </TooltipProvider>
    </BrowserRouter>
  )
}

export default App
