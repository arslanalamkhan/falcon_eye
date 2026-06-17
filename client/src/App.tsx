import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider } from "@/contexts/AuthContext"
import type { Role } from "@/contexts/AuthContext"
import ProtectedRoute from "@/components/layout/ProtectedRoute"
import DashboardLayout from "@/components/layout/DashboardLayout"
import Dashboard from "@/pages/Dashboard"
import LiveMap    from "@/pages/LiveMap"
import Cameras    from "@/pages/Cameras"
import Admin      from "@/pages/Admin"
import Login      from "@/pages/Login"

function ProtectedPage({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: Role[] }) {
  return (
    <ProtectedRoute allowedRoles={allowedRoles}>
      <DashboardLayout>{children}</DashboardLayout>
    </ProtectedRoute>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/"         element={<ProtectedPage><Dashboard /></ProtectedPage>} />
          <Route path="/map"      element={<ProtectedPage><LiveMap /></ProtectedPage>} />
          <Route path="/cameras"  element={<ProtectedPage><Cameras /></ProtectedPage>} />
          <Route path="/admin"    element={<ProtectedPage allowedRoles={['admin', 'supervisor']}><Admin /></ProtectedPage>} />
          <Route path="*"      element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
