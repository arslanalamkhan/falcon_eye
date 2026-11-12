// Falcon Mega Track (FMS) satellite terminal commands — the shapes returned
// by /api/fms/*. A command is sent to FMS, which relays it to the terminal
// over satellite; `status` tracks delivery (FMS ForwardMessageStatus).

export type FmsCommandKind = 'reset' | 'poll_position' | 'test_mode_on' | 'test_mode_off'

/** pending → completed (terminal received it) | failed | timed_out (no answer in ~3 min) */
export type FmsCommandStatus = 'pending' | 'completed' | 'failed' | 'timed_out'

export type FmsForwardStatus =
  | 'SUBMITTED' | 'RECEIVED' | 'ERROR' | 'DELIVERY_FAILED' | 'TIMED_OUT'
  | 'CANCELLED' | 'WAITING' | 'NA' | 'TRANSMITTED'

export type FmsCommand = {
  id: number
  site_id: string
  kind: FmsCommandKind
  status: FmsCommandStatus
  forward_message_id: number | null
  forward_status: FmsForwardStatus | null
  error_code: string | null
  /** Human-readable outcome, safe to show */
  description: string | null
  requested_by_name: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
}

/** GET /api/fms/sites/:siteId/commands */
export type FmsSiteStatus = {
  site_id: string
  mobile_id: string
  /** Terminal is in SSAS web test mode — a panic press sends a TEST, not a real alert */
  test_mode: boolean
  /** Last 24 h, newest first */
  commands: FmsCommand[]
}

export const FMS_COMMAND_LABELS: Record<FmsCommandKind, string> = {
  reset:         'Alarm reset',
  poll_position: 'Position request',
  test_mode_on:  'Test mode on',
  test_mode_off: 'Test mode off',
}

export const FMS_STATUS_LABELS: Record<FmsCommandStatus, string> = {
  pending:   'Waiting for terminal',
  completed: 'Delivered',
  failed:    'Failed',
  timed_out: 'No response',
}
