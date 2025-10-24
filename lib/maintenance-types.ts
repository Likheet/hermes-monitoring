import type { DualTimestamp } from "./types"

export type MaintenanceTaskType = "ac_indoor" | "ac_outdoor" | "fan" | "exhaust" | "lift" | "all"
export type MaintenanceArea = "a_block" | "b_block" | "both"
export type ScheduleFrequency =
  | "daily"
  | "weekly"
  | "biweekly"
  | "monthly"
  | "quarterly"
  | "semiannual"
  | "annual"
  | "custom"

export interface MaintenanceSchedule {
  id: string
  task_type: MaintenanceTaskType
  area: MaintenanceArea
  frequency: ScheduleFrequency
  auto_reset: boolean
  active: boolean
  created_at: DualTimestamp
  schedule_name?: string
  last_completed?: string | null
  next_due?: string | null
  updated_at?: string | null
  frequency_weeks?: number | null
  day_range_start?: number | null
  day_range_end?: number | null
  created_by?: string | null
  metadata_version?: number
}

export const MAINTENANCE_TASK_TYPES: ReadonlyArray<MaintenanceTaskType> = [
  "ac_indoor",
  "ac_outdoor",
  "fan",
  "exhaust",
  "lift",
  "all",
]

export const MAINTENANCE_AREAS: ReadonlyArray<MaintenanceArea> = ["a_block", "b_block", "both"]

export const MAINTENANCE_FREQUENCIES: ReadonlyArray<ScheduleFrequency> = [
  "daily",
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
  "semiannual",
  "annual",
  "custom",
]

export interface MaintenanceTask {
  id: string
  schedule_id: string
  room_number?: string
  lift_id?: string
  task_type: MaintenanceTaskType
  location: string
  description: string
  status: "pending" | "in_progress" | "paused" | "completed"
  assigned_to?: string
  started_at?: string
  paused_at?: string
  completed_at?: string
  timer_duration?: number // Total elapsed time in seconds
  photos: string[]
  categorized_photos?: {
    before_photos?: string[]
    during_photos?: string[]
    after_photos?: string[]
  }
  notes?: string
  expected_duration_minutes?: number
  period_month: number
  period_year: number
  created_at: string
}

export interface ShiftSchedule {
  id: string
  worker_id: string
  schedule_date: string // Format: "YYYY-MM-DD"
  // Legacy single shift fields (for backward compatibility)
  shift_start: string // Format: "HH:MM"
  shift_end: string // Format: "HH:MM"
  has_break: boolean
  break_start?: string // Format: "HH:MM"
  break_end?: string // Format: "HH:MM"
  // Explicit dual-shift fields
  shift_1_start?: string // Format: "HH:MM"
  shift_1_end?: string // Format: "HH:MM"
  shift_1_break_start?: string // Format: "HH:MM"
  shift_1_break_end?: string // Format: "HH:MM"
  has_shift_2?: boolean
  is_dual_shift?: boolean
  shift_2_start?: string // Format: "HH:MM"
  shift_2_end?: string // Format: "HH:MM"
  shift_2_has_break?: boolean
  shift_2_break_start?: string // Format: "HH:MM"
  shift_2_break_end?: string // Format: "HH:MM"
  is_override: boolean // true if this is a holiday/leave/off-duty day
  override_reason?: string // "holiday", "leave", "sick", "emergency", etc.
  notes?: string
  created_at: string
}

export const TASK_TYPE_LABELS: Record<MaintenanceTaskType, string> = {
  ac_indoor: "AC Indoor Unit",
  ac_outdoor: "AC Outdoor Unit",
  fan: "Fan",
  exhaust: "Exhaust Fan",
  lift: "Lift Maintenance",
  all: "All Tasks (Complete Maintenance)",
}

export const AREA_LABELS: Record<MaintenanceArea, string> = {
  a_block: "A Block (60 rooms)",
  b_block: "B Block (42 rooms)",
  both: "Both Blocks (102 rooms)",
}

export const FREQUENCY_LABELS: Record<ScheduleFrequency, string> = {
  daily: "Daily",
  weekly: "Weekly",
  biweekly: "Every 2 Weeks (Bi-weekly)",
  monthly: "Monthly (Deadline: End of Month)",
  quarterly: "Quarterly",
  semiannual: "Every 6 Months (Semi-annual)",
  annual: "Annual",
  custom: "Custom Frequency",
}
