// Shared types for the Admin panel's tab components.
import type { Role, ViewScope } from "@/types/access"

export type Site = {
  id: string; label: string; type: string; region: string; active: boolean
  source: string; owner_id: number | null; owner_name: string | null
  department_id: number; department_code: string; department_name: string
  /** FMS satellite sites only — terminal is in SSAS web test mode */
  fms_test_mode: boolean; fms_mobile_id: string | null
}

export type Receiver = {
  id: string; label: string; lea: string; city: string; active: boolean
  owner_id: number | null; owner_name: string | null
  department_id: number; department_code: string; department_name: string
}

export type CameraRow = {
  id: number; site_id: string; label: string; ip: string | null; port: number
  channel: number; subtype: number; active: boolean; site_label: string; site_type: string
  stream_type: string; imou_device_id: string | null; imou_channel_id: string
  site_owner_id: number | null; site_department_id: number; site_department_code: string
}

export type UserRow = {
  id: number; email: string; full_name: string; role: Role; active: boolean
  department_id: number; department_code: string; created_at: string
}

export type OversightTarget = { id: number; code: string; name: string }

export type DepartmentRow = {
  id: number; code: string; name: string; view_scope: ViewScope
  is_head: boolean; active: boolean; created_at: string
  user_count: number; site_count: number; receiver_count: number
  oversight_targets: OversightTarget[]
}

/** A terminal reporting to FMS that no site is registered for yet */
export type UnregisteredTerminal = {
  mobile_id: string
  asset_name: string
  last_report_type: string
  lat: number
  lng: number
  report_count: number
  first_seen: string
  last_seen: string
  alarm_recent: boolean
}

export type AuditEntry = {
  id: number; actor_id: number | null; actor_email: string | null; actor_name: string | null
  department_id: number | null; department_code: string | null
  action: string; entity_type: string; entity_id: string | null
  details: unknown; created_at: string
}

export type AdminData = { sites: Site[]; receivers: Receiver[]; routes: { site_id: string; receiver_id: string }[] }

export type RouteKey = string   // `${siteId}:${receiverId}`
export function rk(siteId: string, receiverId: string): RouteKey { return `${siteId}:${receiverId}` }
