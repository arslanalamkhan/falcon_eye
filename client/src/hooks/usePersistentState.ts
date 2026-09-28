import { useEffect, useState } from "react"

// useState that survives reloads via localStorage. For per-viewer UI
// conveniences only (sidebar collapsed, grid layout) — never for data.
// Storage access is wrapped because it can throw in private mode.
export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw === null ? initial : (JSON.parse(raw) as T)
    } catch {
      return initial
    }
  })

  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* storage unavailable */ }
  }, [key, value])

  return [value, setValue] as const
}
