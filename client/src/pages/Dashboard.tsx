import { Link } from "react-router-dom"
import { Siren, Radar, Satellite, Activity, MapPinned } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/layout/PageHeader"
import { StatCard } from "@/components/dashboard/StatCard"
import { ActiveAlertsBanner } from "@/components/dashboard/ActiveAlertsBanner"
import { RecentAlerts } from "@/components/dashboard/RecentAlerts"
import { SiteStatusList } from "@/components/dashboard/SiteStatusList"
import { useFirebaseData } from "@/hooks/useFirebaseData"
import { useAuth } from "@/contexts/AuthContext"

export default function Dashboard() {
  const { user, department } = useAuth()
  const {
    sites, alertSites, recentAlerts, todayAlertCount, departmentCodes, sitesLoaded, alertsLoaded,
  } = useFirebaseData()

  const reporting  = sites.filter((s) => s.reported)
  const liveGps    = reporting.filter((s) => s.gps?.status === "live").length
  const awaiting   = sites.length - reporting.length
  const alertCount = alertSites.length

  const scope = department?.view_scope === "all"
    ? "All departments"
    : department ? `${department.name}${departmentCodes.length > 1 ? " + overseen departments" : ""}` : ""

  const emptyHint = user?.role === "operator"
    ? "You haven't been assigned any sites yet. Ask your department administrator to grant access."
    : "No sites are registered for your department yet. Add one from Administration → Sites."

  return (
    <>
      <PageHeader
        title="Situational overview"
        description={scope}
        actions={
          <Button asChild variant="outline">
            <Link to="/map"><MapPinned /> Open live map</Link>
          </Button>
        }
      />

      <ActiveAlertsBanner sites={alertSites} />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard
          label="Active alerts"
          value={alertCount}
          icon={Siren}
          tone={alertCount > 0 ? "danger" : "success"}
          sub={alertCount > 0 ? "Immediate response required" : "All sites clear"}
          loading={!sitesLoaded}
        />
        <StatCard
          label="Sites monitored"
          value={sites.length}
          icon={Radar}
          sub={awaiting > 0 ? `${reporting.length} reporting · ${awaiting} awaiting data` : `${reporting.length} reporting`}
          loading={!sitesLoaded}
        />
        <StatCard
          label="Live GPS"
          value={reporting.length ? `${liveGps}/${reporting.length}` : "—"}
          icon={Satellite}
          tone={reporting.length === 0 ? "default" : liveGps < reporting.length ? "warning" : "success"}
          progress={reporting.length ? liveGps / reporting.length : undefined}
          sub={reporting.length === 0
            ? "No sites reporting yet"
            : reporting.length - liveGps > 0 ? `${reporting.length - liveGps} on last-known position` : "All positions live"}
          loading={!sitesLoaded}
        />
        <StatCard
          label="Alerts today"
          value={todayAlertCount}
          icon={Activity}
          sub="Panic events since midnight (UTC)"
          loading={!alertsLoaded}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-5 xl:gap-5">
        <RecentAlerts alerts={recentAlerts} loading={!alertsLoaded} className="xl:col-span-3" />
        <SiteStatusList
          sites={sites}
          departmentCodes={departmentCodes}
          loading={!sitesLoaded}
          emptyHint={emptyHint}
          className="xl:col-span-2"
        />
      </div>
    </>
  )
}
