import { Globe, Eye, Lock } from "lucide-react"
import type { ViewScope } from "@/types/access"

export const SCOPE_META: Record<ViewScope, { label: string; description: string; icon: React.ElementType }> = {
  own:      { label: "Own sites only", description: "Sees only its own sites and receivers.",                      icon: Lock },
  selected: { label: "Own + selected", description: "Also sees the departments it oversees (read-only).",         icon: Eye },
  all:      { label: "All departments", description: "Sees every department's sites (read-only outside its own).", icon: Globe },
}
