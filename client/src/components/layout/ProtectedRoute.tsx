import { Navigate, useLocation } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import type { Role } from "@/types/access"
import { SplashScreen } from "./SplashScreen"

export default function ProtectedRoute({
  children,
  allowedRoles,
}: {
  children: React.ReactNode
  allowedRoles?: Role[]
}) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <SplashScreen />
  // Remember where the user was headed so login can send them back
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/" replace />

  return <>{children}</>
}
