import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { api } from "@/lib/api"

export type Role = 'admin' | 'supervisor' | 'operator'

interface User {
  id: number
  email: string
  role: Role
  full_name: string
}

interface AuthContextValue {
  user: User | null
  token: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  loading: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("fe_token"))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }
    api.get<{ user: User }>('/api/auth/me')
      .then(({ user }) => setUser(user))
      .catch(() => {
        localStorage.removeItem("fe_token")
        setToken(null)
      })
      .finally(() => setLoading(false))
  }, [token])

  async function login(email: string, password: string) {
    const data = await api.post<{ token: string; user: User }>('/api/auth/login', { email, password })
    localStorage.setItem("fe_token", data.token)
    setToken(data.token)
    setUser(data.user)
  }

  function logout() {
    localStorage.removeItem("fe_token")
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
