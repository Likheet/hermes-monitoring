// Core type definitions for the resort task management system

import type { TaskCategory, Priority } from "./task-definitions"
export type { TaskCategory, Priority } from "./task-definitions"

export type UserRole = "worker" | "supervisor" | "front_office" | "admin"
export type Department = "housekeeping" | "maintenance" | "front_desk"
export type TaskStatus = "PENDING" | "IN_PROGRESS" | "PAUSED" | "COMPLETED" | "REJECTED"
export type PriorityLevel = "GUEST_REQUEST" | "TIME_SENSITIVE" | "DAILY_TASK" | "PREVENTIVE_MAINTENANCE"

// Dual timestamp structure for anti-tampering
export interface DualTimestamp {
  client: string
  server: string
}

export interface User {
  id: string
  name: string
  role: UserRole
  phone: string
  department: Department
  shift_start: string // Format: "HH:MM" (24-hour format)
  shift_end: string // Format: "HH:MM" (24-hour format)
  has_break: boolean
  break_start?: string // Format: "HH:MM" (24-hour format)
  break_end?: string // Format: "HH:MM" (24-hour format)
  is_available: boolean
}

export interface PauseRecord {
  paused_at: DualTimestamp
  resumed_at: DualTimestamp | null
  reason: string
}

export interface CategorizedPhotos {
  room_photos: string[] // Full-room photos post-service
  proof_photos: string[] // Proof-of-completion photos
}

export interface Task {
  id: string
  task_type: string
  priority_level: PriorityLevel
  status: TaskStatus
  department: Department
  assigned_to_user_id: string
  assigned_by_user_id: string
  assigned_at: DualTimestamp
  started_at: DualTimestamp | null
  completed_at: DualTimestamp | null
  expected_duration_minutes: number
  actual_duration_minutes: number | null
  photo_urls: string[] // Deprecated - keeping for backward compatibility
  categorized_photos: CategorizedPhotos | null
  photo_required: boolean
  worker_remark: string
  supervisor_remark: string
  rating: number | null
  quality_comment: string | null
  rating_proof_photo_url: string | null
  rejection_proof_photo_url: string | null
  room_number: string
  pause_history: PauseRecord[]
  audit_log: AuditLogEntry[]
  is_custom_task?: boolean
  custom_task_name?: string | null
  custom_task_category?: TaskCategory | null
  custom_task_priority?: Priority | null
  custom_task_photo_required?: boolean | null
  custom_task_photo_count?: number | null
}

export interface AuditLogEntry {
  timestamp: DualTimestamp
  user_id: string
  action: string
  old_status: TaskStatus | null
  new_status: TaskStatus | null
  details: string
}

export interface EscalationAlert {
  task_id: string
  alert_type: "15_MIN" | "20_MIN" | "50_PERCENT_OVERTIME"
  triggered_at: DualTimestamp
  acknowledged: boolean
}

export interface TaskIssue {
  id: string
  task_id: string
  reported_by_user_id: string
  reported_at: DualTimestamp
  issue_description: string
  status: "OPEN" | "RESOLVED"
}

export interface ShiftSchedule {
  id: string
  worker_id: string
  schedule_date: string // Format: "YYYY-MM-DD"
  shift_start: string // Format: "HH:MM"
  shift_end: string // Format: "HH:MM"
  has_break: boolean
  break_start?: string // Format: "HH:MM"
  break_end?: string // Format: "HH:MM"
  is_override: boolean // true if this is a holiday/leave/off-duty day
  override_reason?: string // "Holiday", "Leave", "Sick", "Emergency", etc.
  notes?: string
  created_at: string
}
