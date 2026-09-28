import { useEffect, useState } from "react"

// Returns Date.now(), refreshed every `intervalMs`. Lets relative labels
// ("4m ago") stay current without each component running its own timer.
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
