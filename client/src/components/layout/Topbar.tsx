import { Bell, Search, Wifi, WifiOff, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { useNavigate } from "react-router-dom"

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
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
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
        <SystemStatusPill online={true} />
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
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={handleLogout}
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  )
}
