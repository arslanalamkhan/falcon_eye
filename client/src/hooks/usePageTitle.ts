import { useEffect } from "react"
import { setPageTitle } from "@/lib/title"

export function usePageTitle(title: string) {
  useEffect(() => {
    setPageTitle(title)
  }, [title])
}
