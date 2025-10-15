export type MaintenanceTaskType = "ac_indoor" | "ac_outdoor" | "fan" | "exhaust" | "lift" | "all"
export type MaintenanceArea = "a_block" | "b_block" | "both"
export type ScheduleFrequency = "monthly" | "biweekly" | "semiannual"

export interface MaintenanceSchedule {
  id: string
  task_type: MaintenanceTaskType
  area: MaintenanceArea
  frequency: ScheduleFrequency
  auto_reset: boolean
  active: boolean
  created_at: {
    client: string
    server: string
  }
}

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
  monthly: "Monthly (Deadline: End of Month)",
  biweekly: "Every 2 Weeks (Bi-weekly)",
  semiannual: "Every 6 Months (Semi-annual)",
}
