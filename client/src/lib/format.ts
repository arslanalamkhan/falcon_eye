// Display formatters shared across pages. Pure functions only.

/** "just now", "4m ago", "2h 10m ago", "3d ago" — `now` lets callers re-render on a tick. */
export function timeAgo(iso: string | undefined | null, now: number = Date.now()): string {
  if (!iso) return "—"
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return "—"
  const mins = Math.floor((now - t) / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return mins % 60 ? `${hrs}h ${mins % 60}m ago` : `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return days < 30 ? `${days}d ago` : new Date(t).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })
}

/** "33.6844° N, 73.0479° E" (handles southern/western hemispheres too). */
export function formatCoords(lat?: string | number | null, lng?: string | number | null, digits = 4): string {
  const la = typeof lat === "number" ? lat : parseFloat(lat ?? "")
  const ln = typeof lng === "number" ? lng : parseFloat(lng ?? "")
  if (Number.isNaN(la) || Number.isNaN(ln)) return "No GPS fix"
  return `${Math.abs(la).toFixed(digits)}° ${la >= 0 ? "N" : "S"}, ${Math.abs(ln).toFixed(digits)}° ${ln >= 0 ? "E" : "W"}`
}

export function formatDateTime(iso: string | undefined | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString("en-PK", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })
}

export function formatDate(iso: string | undefined | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })
}

export function formatTime(iso: string | undefined | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })
}

export function initials(name: string): string {
  return name
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?"
}

export function pluralize(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}
