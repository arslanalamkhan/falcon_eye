import { useCallback, useEffect, useMemo, useState } from "react"
import { api } from "@/lib/api"
import { errorMessage } from "@/lib/utils"
import type { FmsCommand, FmsSiteStatus } from "@/types/fms"

// While a command is in flight the terminal's answer arrives within ~1–3 min;
// this only polls our own backend (which owns the FMS rate-limit budget).
const PENDING_POLL_MS = 4_000

// Results are tagged with the site they belong to, so a late response for a
// site we've navigated away from is never shown for the new one.
type Fetched = { siteId: string; data: FmsSiteStatus | null; error: string | null }

/**
 * Commands for one satellite (FMS) site: recent history, test-mode flag,
 * and the actions. Fetches when enabled, then polls only while a command
 * is pending. Actions throw on failure — callers toast the outcome.
 */
export function useFmsCommands(siteId: string | null, enabled = true) {
  const [fetched, setFetched] = useState<Fetched | null>(null)
  const active = enabled && !!siteId

  const current = active && fetched?.siteId === siteId ? fetched : null
  const status = current?.data ?? null
  const error = current?.error ?? null
  const loading = active && !current

  const refresh = useCallback(async () => {
    if (!siteId) return
    try {
      const data = await api.get<FmsSiteStatus>(`/api/fms/sites/${encodeURIComponent(siteId)}/commands`)
      setFetched({ siteId, data, error: null })
    } catch (err) {
      setFetched((prev) => ({ siteId, data: prev?.siteId === siteId ? prev.data : null, error: errorMessage(err) }))
    }
  }, [siteId])

  useEffect(() => {
    if (!active) return
    // Async fetch — state is only set once the response arrives
    void refresh()
  }, [active, refresh])

  const pendingReset = useMemo(
    () => status?.commands.find((c) => c.kind === "reset" && c.status === "pending") ?? null,
    [status]
  )
  const pendingPoll = useMemo(
    () => status?.commands.find((c) => c.kind === "poll_position" && c.status === "pending") ?? null,
    [status]
  )
  const hasPending = !!status?.commands.some((c) => c.status === "pending")

  useEffect(() => {
    if (!active || !hasPending) return
    const t = setInterval(refresh, PENDING_POLL_MS)
    return () => clearInterval(t)
  }, [active, hasPending, refresh])

  const send = useCallback(async (path: string, body: unknown = {}): Promise<FmsCommand> => {
    if (!siteId) throw new Error("No site selected")
    try {
      const { command } = await api.post<{ command: FmsCommand }>(
        `/api/fms/sites/${encodeURIComponent(siteId)}/${path}`, body
      )
      return command
    } finally {
      await refresh()
    }
  }, [siteId, refresh])

  /** Send ResetSsasToNormal to the terminal. Resolves once FMS accepted it (delivery is tracked in `pendingReset`). */
  const reset = useCallback(() => send("reset"), [send])
  /** Ask the terminal for a fresh position fix (admins). It arrives in the normal feed. */
  const pollPosition = useCallback(() => send("poll-position"), [send])
  /** Super admin: SSAS web test mode on/off. */
  const setTestMode = useCallback((on: boolean) => send("test-mode", { enabled: on }), [send])

  return { status, loading, error, refresh, pendingReset, pendingPoll, reset, pollPosition, setTestMode }
}
