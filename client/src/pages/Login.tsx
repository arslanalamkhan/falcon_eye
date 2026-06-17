import { useState, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import {
  AlertTriangle, Eye, EyeOff, Lock, Mail, Shield,
  Satellite, Radio, MapPin, Camera,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import logoSrc from "@/images/Logo.png"

const FEATURES = [
  { icon: AlertTriangle, label: "Instant Panic Alerts",    desc: "Real-time emergency dispatch to QRF units" },
  { icon: Satellite,     label: "Live GPS Tracking",       desc: "Continuous location monitoring across all sites" },
  { icon: Camera,        label: "RTSP Camera Feeds",       desc: "Live surveillance from on-site cameras" },
  { icon: Radio,         label: "HQ Receiver Network",     desc: "Automated buzzer dispatch to LEA headquarters" },
]

export default function Login() {
  const { login }   = useAuth()
  const navigate    = useNavigate()

  const [email, setEmail]               = useState("")
  const [password, setPassword]         = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError]               = useState("")
  const [loading, setLoading]           = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      await login(email, password)
      navigate("/", { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-screen flex">

      {/* ── Left panel — branding ─────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] flex-col relative bg-card border-r border-border overflow-hidden">

        {/* Subtle grid background */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--border)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        {/* Radial glow behind logo */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-primary/5 blur-3xl pointer-events-none" />

        <div className="relative flex flex-col h-full px-12 py-10">

          {/* Logo + name */}
          <div className="flex flex-col items-center text-center flex-1 justify-center gap-6">
            <img
              src={logoSrc}
              alt="Falcon Eye"
              className="h-64 w-auto object-contain drop-shadow-[0_0_32px_rgba(59,130,246,0.25)]"
            />

            

            {/* Divider */}
            <div className="flex items-center gap-3 w-full max-w-xs">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Capabilities</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Feature list */}
            <ul className="w-full max-w-xs space-y-3">
              {FEATURES.map(({ icon: Icon, label, desc }) => (
                <li key={label} className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 border border-primary/20">
                    <Icon className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-semibold text-foreground">{label}</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-6 border-t border-border">
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Shield className="h-3.5 w-3.5 text-primary" />
              <span>NACTA/NIFTAC</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] text-muted-foreground">System Online</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right panel — form ────────────────────────────────────── */}
      <div className="flex w-full lg:w-1/2 xl:w-[45%] flex-col items-center justify-center bg-background px-6 py-12 relative">

        {/* Mobile-only logo */}
        <div className="flex flex-col items-center mb-8 lg:hidden">
          <img src={logoSrc} alt="Falcon Eye" className="h-20 w-auto object-contain mb-3" />
          <p className="text-xs text-muted-foreground uppercase tracking-widest">Emergency Alert System</p>
        </div>

        <div className="w-full max-w-sm">

          {/* Form header */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground">Sign In</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Access restricted to authorised personnel only
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="user@nacta.gov.pk"
                  required
                  className={cn(
                    "w-full rounded-md border bg-input/30 pl-10 pr-4 py-2.5 text-sm text-foreground",
                    "placeholder:text-muted-foreground/50 border-input",
                    "focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-colors"
                  )}
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className={cn(
                    "w-full rounded-md border bg-input/30 pl-10 pr-10 py-2.5 text-sm text-foreground",
                    "placeholder:text-muted-foreground/50 border-input",
                    "focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-colors"
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                <p className="text-xs text-destructive">{error}</p>
              </div>
            )}

            <Button type="submit" className="w-full h-10" disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                  Authenticating…
                </span>
              ) : "Sign In"}
            </Button>
          </form>

          {/* Mobile footer */}
          <div className="flex items-center justify-center gap-2 mt-8 text-[11px] text-muted-foreground lg:hidden">
            <Shield className="h-3 w-3" />
            <span>NACTA · National Counter Terrorism Authority</span>
          </div>
        </div>
      </div>

    </div>
  )
}
