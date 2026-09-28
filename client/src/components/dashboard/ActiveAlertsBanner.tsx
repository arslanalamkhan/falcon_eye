import { Link } from "react-router-dom"
import { Siren, LocateFixed, Camera } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useNow } from "@/hooks/useNow"
import { formatCoords, timeAgo, pluralize } from "@/lib/format"
import type { SiteData } from "@/hooks/useFirebaseData"

/** Unmissable strip at the top of the dashboard while any visible site is in alert. */
export function ActiveAlertsBanner({ sites }: { sites: SiteData[] }) {
  const now = useNow(15_000)
  if (sites.length === 0) return null

  return (
    <section
      aria-labelledby="active-alerts-heading"
      className="mb-6 overflow-hidden rounded-xl border border-danger/50 bg-gradient-to-br from-danger/15 via-danger/[0.07] to-transparent shadow-glow-danger"
    >
      <div className="flex items-center gap-3 border-b border-danger/25 px-4 py-3 sm:px-5">
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-danger/20 text-danger">
          <span className="absolute inset-0 rounded-full bg-danger/30 animate-ping-slow" aria-hidden />
          <Siren className="relative h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h2 id="active-alerts-heading" className="text-sm font-bold uppercase tracking-wider text-danger">
            {pluralize(sites.length, "active panic alert")}
          </h2>
          <p className="text-xs text-danger/80">Immediate response required — receivers remain active until reset.</p>
        </div>
      </div>

      <ul className="divide-y divide-danger/15">
        {sites.map((s) => (
          <li key={s.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-foreground">{s.label}</p>
              <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                <span className="font-mono">{s.id}{s.department_code ? ` · ${s.department_code}` : ""}</span>
                <span>Triggered {timeAgo(s.last_alert, now)}</span>
                <span>{formatCoords(s.gps?.lat, s.gps?.lng)}</span>
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button asChild size="sm" className="flex-1 bg-danger text-danger-foreground hover:bg-danger/90 sm:flex-none">
                <Link to={`/map?site=${encodeURIComponent(s.id)}`}><LocateFixed /> Locate</Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="flex-1 sm:flex-none">
                <Link to={`/cameras?site=${encodeURIComponent(s.id)}`}><Camera /> Cameras</Link>
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
