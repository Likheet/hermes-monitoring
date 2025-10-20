// Database types that match the Supabase schema exactly
// Phase 1.3: TypeScript types with conversion functions

import type { Task, User, ShiftSchedule } from "./types"

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

// ============================================================================
// DATABASE ROW TYPES (Exact match to Supabase schema)
// ============================================================================

export interface DatabaseUser {
  id: string
  username: string
  password_hash: string
  name: string
  role: "worker" | "supervisor" | "front_office" | "admin"
  phone: string | null
  department: "housekeeping" | "maintenance" | null
  shift_timing: string | null
  created_at: string
}

export interface DatabaseTask {
  id: string
  task_type: string
  room_number: string | null
  status: "pending" | "assigned" | "in_progress" | "paused" | "completed" | "verified" | "rejected"
  priority_level: "low" | "medium" | "high" | "urgent" | null
  assigned_to_user_id: string | null
  assigned_by_user_id: string | null
  created_at: string
  updated_at: string
  started_at: string | null
  completed_at: string | null
  verified_at: string | null
  verified_by_user_id: string | null
  assigned_at: Json | null
  description: string | null
  special_instructions: string | null
  estimated_duration: number | null
  actual_duration: number | null
  categorized_photos: Json
  worker_remarks: string | null
  supervisor_remarks: string | null
  quality_rating: number | null
  requires_verification: boolean
  timer_validation_flag: boolean
  audit_log: Json
  pause_history: Json
  photo_requirements: Json
}

export interface DatabaseShiftSchedule {
  id: string
  worker_id: string
  schedule_date: string
  shift_start: string
  shift_end: string
  break_start: string | null
  break_end: string | null
  is_override: boolean
  override_reason: string | null
  created_at: string
}

export interface DatabaseMaintenanceTask {
  id: string
  assigned_to: string | null
  status: "pending" | "in_progress" | "completed" | "verified"
  ac_location: string | null
  task_type: string
  room_number: string | null
  period_year: number | null
  period_month: number | null
  schedule_id: string | null
  started_at: string | null
  completed_at: string | null
  photos: Json
  timer_duration: number | null
  created_at: string
}

export interface DatabaseMaintenanceSchedule {
  id: string
  schedule_name: string
  area: string
  frequency: "daily" | "weekly" | "biweekly" | "monthly" | "quarterly" | "semiannual" | "annual"
  last_completed: string | null
  next_due: string | null
  auto_reset: boolean
  created_at: string
}

// ============================================================================
// CONVERSION FUNCTIONS: Database → App
// ============================================================================

export function databaseUserToApp(dbUser: DatabaseUser): User {
  // Parse shift_timing JSON string to shift object
  let shift = {
    start: "09:00",
    end: "17:00",
    breakStart: "12:00",
    breakEnd: "13:00",
  }

  if (dbUser.shift_timing) {
    try {
      const parsed = JSON.parse(dbUser.shift_timing)
      shift = {
        start: parsed.start || "09:00",
        end: parsed.end || "17:00",
        breakStart: parsed.breakStart || "12:00",
        breakEnd: parsed.breakEnd || "13:00",
      }
    } catch (e) {
      console.error("[v0] Error parsing shift_timing:", e)
    }
  }

  return {
    id: dbUser.id,
    name: dbUser.name,
    role: dbUser.role,
    phone: dbUser.phone || "",
    department: dbUser.department || "housekeeping",
    shift_start: shift.start,
    shift_end: shift.end,
    break_start: shift.breakStart,
    break_end: shift.breakEnd,
  }
}

export function databaseTaskToApp(dbTask: DatabaseTask): Task {
  // Parse JSONB fields
  const categorizedPhotos =
    typeof dbTask.categorized_photos === "string"
      ? JSON.parse(dbTask.categorized_photos)
      : dbTask.categorized_photos || []

  const auditLog = typeof dbTask.audit_log === "string" ? JSON.parse(dbTask.audit_log) : dbTask.audit_log || []

  const pauseHistory =
    typeof dbTask.pause_history === "string" ? JSON.parse(dbTask.pause_history) : dbTask.pause_history || []

  const photoRequirements =
    typeof dbTask.photo_requirements === "string"
      ? JSON.parse(dbTask.photo_requirements)
      : dbTask.photo_requirements || []

  // Parse assigned_at JSONB (dual timestamp)
  let assignedAt = { client: null, server: null }
  if (dbTask.assigned_at) {
    const parsed = typeof dbTask.assigned_at === "string" ? JSON.parse(dbTask.assigned_at) : dbTask.assigned_at
    assignedAt = {
      client: parsed.client || null,
      server: parsed.server || null,
    }
  }

  return {
    id: dbTask.id,
    type: dbTask.task_type,
    roomNumber: dbTask.room_number || "",
    status: dbTask.status,
    priority: dbTask.priority_level || "medium",
    assignedTo: dbTask.assigned_to_user_id || "",
    assignedBy: dbTask.assigned_by_user_id || "",
    assignedAt: assignedAt,
    startedAt: dbTask.started_at ? { client: dbTask.started_at, server: dbTask.started_at } : null,
    completedAt: dbTask.completed_at ? { client: dbTask.completed_at, server: dbTask.completed_at } : null,
    verifiedAt: dbTask.verified_at || null,
    verifiedBy: dbTask.verified_by_user_id || null,
    description: dbTask.description || "",
    specialInstructions: dbTask.special_instructions || "",
    estimatedDuration: dbTask.estimated_duration || 30,
    actualDuration: dbTask.actual_duration || null,
    categorizedPhotos: categorizedPhotos,
    workerRemarks: dbTask.worker_remarks || "",
    supervisorRemarks: dbTask.supervisor_remarks || "",
    qualityRating: dbTask.quality_rating || null,
    requiresVerification: dbTask.requires_verification,
    timerValidationFlag: dbTask.timer_validation_flag,
    audit_log: auditLog,
    pause_history: pauseHistory,
    photoRequirements: photoRequirements,
  }
}

export function databaseShiftScheduleToApp(dbSchedule: DatabaseShiftSchedule): ShiftSchedule {
  return {
    id: dbSchedule.id,
    workerId: dbSchedule.worker_id,
    date: dbSchedule.schedule_date,
    shiftStart: dbSchedule.shift_start,
    shiftEnd: dbSchedule.shift_end,
    breakStart: dbSchedule.break_start || undefined,
    breakEnd: dbSchedule.break_end || undefined,
    isOverride: dbSchedule.is_override,
    overrideReason: dbSchedule.override_reason || undefined,
  }
}

// ============================================================================
// CONVERSION FUNCTIONS: App → Database
// ============================================================================

export function appUserToDatabase(
  user: User,
  username: string,
  passwordHash: string,
): Omit<DatabaseUser, "created_at"> {
  // Convert shift object to JSON string
  const shiftTiming = JSON.stringify({
    start: user.shift_start,
    end: user.shift_end,
    breakStart: user.break_start,
    breakEnd: user.break_end,
  })

  return {
    id: user.id,
    username,
    password_hash: passwordHash,
    name: user.name,
    role: user.role,
    phone: user.phone || null,
    department: user.department || null,
    shift_timing: shiftTiming,
  }
}

export function appTaskToDatabase(task: Task): Omit<DatabaseTask, "created_at" | "updated_at"> {
  // Convert assigned_at to JSONB
  const assignedAt = task.assignedAt
    ? {
        client: task.assignedAt.client,
        server: task.assignedAt.server,
      }
    : null

  return {
    id: task.id,
    task_type: task.type,
    room_number: task.roomNumber || null,
    status: task.status,
    priority_level: task.priority,
    assigned_to_user_id: task.assignedTo || null,
    assigned_by_user_id: task.assignedBy || null,
    started_at: task.startedAt?.server || null,
    completed_at: task.completedAt?.server || null,
    verified_at: task.verifiedAt || null,
    verified_by_user_id: task.verifiedBy || null,
    assigned_at: assignedAt as Json,
    description: task.description || null,
    special_instructions: task.specialInstructions || null,
    estimated_duration: task.estimatedDuration || null,
    actual_duration: task.actualDuration || null,
    categorized_photos: task.categorizedPhotos as Json,
    worker_remarks: task.workerRemarks || null,
    supervisor_remarks: task.supervisorRemarks || null,
    quality_rating: task.qualityRating || null,
    requires_verification: task.requiresVerification || false,
    timer_validation_flag: task.timerValidationFlag || false,
    audit_log: task.audit_log as Json,
    pause_history: task.pause_history as Json,
    photo_requirements: task.photoRequirements as Json,
  }
}

export function appShiftScheduleToDatabase(schedule: ShiftSchedule): Omit<DatabaseShiftSchedule, "created_at"> {
  return {
    id: schedule.id,
    worker_id: schedule.workerId,
    schedule_date: schedule.date,
    shift_start: schedule.shiftStart,
    shift_end: schedule.shiftEnd,
    break_start: schedule.breakStart || null,
    break_end: schedule.breakEnd || null,
    is_override: schedule.isOverride || false,
    override_reason: schedule.overrideReason || null,
  }
}
