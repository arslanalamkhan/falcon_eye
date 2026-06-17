import { Bell, Search, Wifi, WifiOff, LogOut, KeyRound, Loader2, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { useNavigate } from "react-router-dom"
import { ref, onValue } from "firebase/database"
import { db } from "@/lib/firebase"
import { api } from "@/lib/api"

function SystemStatusPill({ online }: { online: boolean }) {
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium">
      {online ? (
        <>
          <Wifi className="h-3 w-3 text-emerald-400" />
          <span className="text-emerald-400">Firebase Connected</span>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
        </>
      ) : (
        <>
          <WifiOff className="h-3 w-3 text-red-400" />
          <span className="text-red-400">Offline</span>
        </>
      )}
    </div>
  )
}

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

export default function Topbar() {
  const [time, setTime] = useState(new Date())
  const [firebaseOnline, setFirebaseOnline] = useState(false)
  const [changePwOpen, setChangePwOpen] = useState(false)
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const connRef = ref(db, ".info/connected")
    return onValue(connRef, (snap) => setFirebaseOnline(snap.val() === true))
  }, [])

  function handleLogout() {
    logout()
    navigate("/login", { replace: true })
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card/50 px-4 backdrop-blur-sm">
      {/* Left */}
      <div className="flex items-center gap-3">
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold text-foreground">Operational Dashboard</span>
          <span className="text-[11px] text-muted-foreground">
            {time.toLocaleDateString("en-PK", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </span>
        </div>
      </div>

      {/* Center */}
      <div className="hidden md:flex items-center gap-2">
        <SystemStatusPill online={firebaseOnline} />
        <div className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          <span>Live Monitoring</span>
          <span className="font-mono text-foreground">
            {time.toLocaleTimeString("en-PK", { hour12: false })}
          </span>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
          <Search className="h-4 w-4" />
        </Button>

        <div className="relative">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
            <Bell className="h-4 w-4" />
          </Button>
          <Badge
            variant="danger"
            className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[9px] font-bold flex items-center justify-center rounded-full"
          >
            3
          </Badge>
        </div>

        <div className="flex items-center gap-2 ml-1 pl-3 border-l border-border">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
              {user ? initials(user.full_name || user.email) : "??"}
            </AvatarFallback>
          </Avatar>
          <div className="hidden lg:flex flex-col leading-none">
            <span className="text-xs font-semibold text-foreground">
              {user?.full_name ?? "Operator"}
            </span>
            <span className="text-[10px] text-muted-foreground capitalize">{user?.role ?? ""}</span>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-primary"
          onClick={() => setChangePwOpen(true)}
          title="Change password"
        >
          <KeyRound className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={handleLogout}
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>

      <ChangeOwnPasswordDialog
        open={changePwOpen}
        onClose={() => setChangePwOpen(false)}
      />
    </header>
  )
}

// ── Change own password dialog (requires current password) ─────────
function ChangeOwnPasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [current, setCurrent]     = useState('')
  const [newPw, setNewPw]         = useState('')
  const [confirm, setConfirm]     = useState('')
  const [saving, setSaving]       = useState(false)
  const [err, setErr]             = useState('')
  const [success, setSuccess]     = useState(false)

  function reset() {
    setCurrent(''); setNewPw(''); setConfirm('')
    setErr(''); setSuccess(false); setSaving(false)
  }

  function handleOpenChange(o: boolean) {
    if (!o) { reset(); onClose() }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPw !== confirm) { setErr('Passwords do not match'); return }
    setErr('')
    setSaving(true)
    try {
      await api.patch('/api/auth/password', { currentPassword: current, newPassword: newPw })
      setSuccess(true)
      setTimeout(() => { reset(); onClose() }, 1500)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change Password</DialogTitle>
          <DialogDescription>Enter your current password then choose a new one</DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="flex items-center gap-2 py-2 text-sm text-emerald-400">
            <Check className="h-4 w-4" /> Password changed successfully
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <PasswordField label="Current Password" value={current} onChange={setCurrent} placeholder="Your current password" />
            <PasswordField label="New Password"     value={newPw}   onChange={setNewPw}   placeholder="Min. 8 characters" />
            <PasswordField label="Confirm New Password" value={confirm} onChange={setConfirm} placeholder="Repeat new password" />
            {err && <p className="text-xs text-destructive">{err}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => { reset(); onClose() }}
                className="h-8 px-3 rounded-md border border-input text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium flex items-center gap-1.5 hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {saving
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <KeyRound className="h-3.5 w-3.5" />}
                Update Password
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

function PasswordField({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{label}</label>
      <input
        type="password"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required
        className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  )
}
