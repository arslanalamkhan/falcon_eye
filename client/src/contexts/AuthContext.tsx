import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { api } from "@/lib/api"
import type { CurrentUser, Department, Access } from "@/types/access"

type MeResponse = { user: CurrentUser; department: Department; access: Access }

interface AuthContextValue {
  user: CurrentUser | null
  department: Department | null
  access: Access | null
  token: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  refresh: () => Promise<void>
  loading: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]             = useState<CurrentUser | null>(null)
  const [department, setDepartment] = useState<Department | null>(null)
  const [access, setAccess]         = useState<Access | null>(null)
  const [token, setToken]           = useState<string | null>(() => localStorage.getItem("fe_token"))
  const [loading, setLoading]       = useState(true)

  const fetchMe = useCallback(async () => {
    const data = await api.get<MeResponse>('/api/auth/me')
    setUser(data.user)
    setDepartment(data.department)
    setAccess(data.access)
  }, [])

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }
    fetchMe()
      .catch(() => {
        localStorage.removeItem("fe_token")
        setToken(null)
      })
      .finally(() => setLoading(false))
  }, [token, fetchMe])

  async function login(email: string, password: string) {
    const data = await api.post<{ token: string; user: CurrentUser }>('/api/auth/login', { email, password })
    localStorage.setItem("fe_token", data.token)
    setToken(data.token)
    // Full /me fetch (department + access) happens via the token effect above,
    // but set the user immediately so the UI doesn't flash unauthenticated.
    setUser(data.user)
    await fetchMe()
  }

  function logout() {
    localStorage.removeItem("fe_token")
    setToken(null)
    setUser(null)
    setDepartment(null)
    setAccess(null)
  }

  // Re-fetch /me — used after an admin action that changes the current
  // user's own visibility (rare) or just to pull fresh access data.
  async function refresh() {
    try { await fetchMe() } catch { /* handled by 401 global redirect in lib/api.ts */ }
  }

  return (
    <AuthContext.Provider value={{ user, department, access, token, login, logout, refresh, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
