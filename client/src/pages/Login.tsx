import { useState, type FormEvent } from "react"
import { Navigate, useLocation, useNavigate } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import {
  Eye, EyeOff, Lock, Mail, ShieldCheck, Siren, Satellite, Camera, Radio, CircleAlert, ArrowRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input, Field } from "@/components/ui/input"
import { usePageTitle } from "@/hooks/usePageTitle"
import logoFull from "@/images/logo-full.png"
import logoMark from "@/images/logo-mark.png"

const CAPABILITIES = [
  { icon: Siren,     label: "Instant panic alerts",  desc: "Sub-second dispatch to routed QRF and LEA headquarters" },
  { icon: Satellite, label: "Live GPS tracking",     desc: "Cellular and satellite positions for trains and mines" },
  { icon: Camera,    label: "On-site camera feeds",  desc: "RTSP and cloud video, one click from any alert" },
  { icon: Radio,     label: "HQ receiver network",   desc: "Department-scoped routing to buzzer receivers" },
]

export default function Login() {
  usePageTitle("Sign in")
  const { login, user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? "/"

  const [email, setEmail]               = useState("")
  const [password, setPassword]         = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [capsLock, setCapsLock]         = useState(false)
  const [error, setError]               = useState("")
  const [submitting, setSubmitting]     = useState(false)

  if (!authLoading && user) return <Navigate to={from} replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError("")
    setSubmitting(true)
    try {
      await login(email, password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed")
      setSubmitting(false)
    }
  }

  const detectCaps = (e: React.KeyboardEvent) => setCapsLock(e.getModifierState?.("CapsLock") ?? false)

  return (
    <div className="relative flex min-h-dvh overflow-hidden bg-background">
      {/* Backdrop */}
      <div className="pointer-events-none absolute inset-0 bg-grid [mask-image:radial-gradient(ellipse_at_30%_40%,black,transparent_75%)]" aria-hidden />
      <div className="pointer-events-none absolute -left-40 top-1/4 h-[36rem] w-[36rem] rounded-full bg-primary/15 blur-[120px]" aria-hidden />
      <div className="pointer-events-none absolute -bottom-40 right-0 h-[28rem] w-[28rem] rounded-full bg-primary/10 blur-[120px]" aria-hidden />

      {/* ── Brand panel (lg+) ─────────────────────────────────────── */}
      <section className="relative hidden flex-1 flex-col justify-between p-12 lg:flex xl:p-16">
        <div className="flex items-center gap-3">
          <img src={logoMark} alt="" className="h-10 w-10 rounded-lg ring-1 ring-primary/30" />
          <div className="leading-tight">
            <p className="text-sm font-bold tracking-[0.2em]">FALCON EYE</p>
            <p className="text-xs text-muted-foreground">NACTA · NIFTAC</p>
          </div>
        </div>

        <div className="max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Emergency alert & situational awareness</p>
          <h1 className="mt-4 text-4xl font-bold leading-[1.1] tracking-tight xl:text-5xl">
            Every alert, every site,
            <span className="block bg-gradient-to-r from-primary to-info bg-clip-text text-transparent">in one command view.</span>
          </h1>
          <p className="mt-5 max-w-md text-base text-muted-foreground">
            Real-time monitoring for Pakistan Railways trains and remote mining sites, shared securely across partner departments.
          </p>

          <ul className="mt-10 grid grid-cols-2 gap-4">
            {CAPABILITIES.map(({ icon: Icon, label, desc }) => (
              <li key={label} className="rounded-xl border border-border bg-card/40 p-4 backdrop-blur-sm">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <p className="mt-3 text-sm font-semibold">{label}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{desc}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-success" />
          Restricted system — authorised personnel only. Administrative actions are audited.
        </div>
      </section>

      {/* ── Sign-in panel ─────────────────────────────────────────── */}
      <section className="relative flex w-full flex-col items-center justify-center px-5 py-10 lg:w-[480px] lg:shrink-0 lg:border-l lg:border-border lg:bg-card/50 lg:backdrop-blur-xl xl:w-[540px]">
        <div className="w-full max-w-sm">
          <img src={logoFull} alt="Falcon Eye" className="mx-auto mb-6 h-40 w-40 rounded-3xl object-cover shadow-glow-primary lg:h-44 lg:w-44" />

          <div className="mb-7 text-center">
            <h2 className="text-2xl font-semibold tracking-tight">Welcome back</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">Sign in with your department account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Email address">
              <Input
                type="email"
                icon={Mail}
                autoComplete="username"
                inputMode="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@department.gov.pk"
                required
                className="h-11 sm:h-11"
              />
            </Field>

            <Field label="Password" hint={capsLock ? <span className="text-warning">Caps Lock is on</span> : undefined}>
              <Input
                type={showPassword ? "text" : "password"}
                icon={Lock}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={detectCaps}
                onKeyUp={detectCaps}
                placeholder="••••••••"
                required
                className="h-11 sm:h-11"
                trailing={
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
              />
            </Field>

            {error && (
              <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2.5 text-sm text-danger animate-in fade-in-0 slide-in-from-top-1">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <Button type="submit" size="lg" className="w-full" loading={submitting}>
              {submitting ? "Signing in…" : <>Sign in <ArrowRight /></>}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Forgot your password? Contact your department administrator.
          </p>
          <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground lg:hidden">
            <ShieldCheck className="h-3.5 w-3.5 text-success" />
            Authorised personnel only · NACTA
          </p>
        </div>
      </section>
    </div>
  )
}
