import logoMark from "@/images/logo-mark.png"

/** Branded full-screen loader — shown while the session is verified and while lazy pages load. */
export function SplashScreen({ label = "Securing session…" }: { label?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-background" role="status" aria-live="polite">
      <div className="relative">
        <span className="absolute inset-0 rounded-2xl bg-primary/30 animate-ping-slow" aria-hidden />
        <img src={logoMark} alt="" className="relative h-16 w-16 rounded-2xl ring-1 ring-primary/40 shadow-glow-primary" />
      </div>
      <div className="text-center">
        <p className="text-sm font-bold tracking-[0.25em] text-foreground">FALCON EYE</p>
        <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}

/** In-shell loader for lazy route chunks (keeps sidebar/topbar visible). */
export function PageLoader() {
  return (
    <div className="flex h-[50vh] items-center justify-center" role="status" aria-label="Loading page">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
    </div>
  )
}
