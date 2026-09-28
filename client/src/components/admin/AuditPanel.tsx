import { useState, useEffect } from "react"
import { api } from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCw } from "lucide-react"
import type { AuditEntry } from "./types"

const ACTION_VARIANT = (action: string): 'danger' | 'warning' | 'info' | 'success' => {
  if (action.endsWith('.delete')) return 'danger'
  if (action.endsWith('.create')) return 'success'
  if (action.includes('password') || action.includes('route')) return 'warning'
  return 'info'
}

export function AuditPanel({ isSuper }: { isSuper: boolean }) {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const rows = await api.get<AuditEntry[]>('/api/admin/audit?limit=200')
      setEntries(rows)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {isSuper ? 'System-wide activity log.' : "Your department's activity log."}
        </p>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading audit log…</span>
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-lg border border-border py-12 text-center text-sm text-muted-foreground">
          No activity recorded yet.
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr>
                {['When', 'Actor', ...(isSuper ? ['Department'] : []), 'Action', 'Entity'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entries.map(e => (
                <tr key={e.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(e.created_at).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' })}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-foreground">
                    {e.actor_name || e.actor_email || <span className="text-muted-foreground">system</span>}
                  </td>
                  {isSuper && (
                    <td className="px-4 py-2.5">
                      {e.department_code && <Badge variant="info" className="text-[10px] font-mono">{e.department_code}</Badge>}
                    </td>
                  )}
                  <td className="px-4 py-2.5">
                    <Badge variant={ACTION_VARIANT(e.action)} className="text-[10px] font-mono">{e.action}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono">
                    {e.entity_type}{e.entity_id ? `:${e.entity_id}` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
