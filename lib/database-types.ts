// Database types that match the Supabase schema exactly
// Phase 1.3: TypeScript types with conversion functions

import type {
  Task,
  User,
  ShiftSchedule,
  Department,
  DualTimestamp,
  PauseRecord,
  AuditLogEntry,
  PriorityLevel,
  TaskStatus,
  CategorizedPhotos,
} from "./types"

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
  frequency: "daily" | "weekly" | "biweekly" | "monthly" | "quarterly" | "semiannual" | "annual" | "custom"
  last_completed: string | null
  next_due: string | null
  auto_reset: boolean
  created_at: string
  task_type?: string | null
  active?: boolean | null
  frequency_weeks?: number | null
  day_range_start?: number | null
  day_range_end?: number | null
  created_by?: string | null
  updated_at?: string | null
}

// ============================================================================
// CONVERSION FUNCTIONS: Database → App
// ============================================================================

const DEFAULT_SHIFT = {
  start: "09:00",
  end: "17:00",
  breakStart: undefined as string | undefined,
  breakEnd: undefined as string | undefined,
  hasBreak: false,
}

const STATUS_DB_TO_APP: Record<DatabaseTask["status"], TaskStatus> = {
  pending: "PENDING",
  assigned: "PENDING",
  in_progress: "IN_PROGRESS",
  paused: "PAUSED",
  completed: "COMPLETED",
  verified: "COMPLETED",
  rejected: "REJECTED",
}

const STATUS_APP_TO_DB: Record<TaskStatus, DatabaseTask["status"]> = {
  PENDING: "pending",
  IN_PROGRESS: "in_progress",
  PAUSED: "paused",
  COMPLETED: "completed",
  REJECTED: "rejected",
}

const PRIORITY_DB_TO_APP: Record<NonNullable<DatabaseTask["priority_level"]>, PriorityLevel> = {
  low: "DAILY_TASK",
  medium: "GUEST_REQUEST",
  high: "TIME_SENSITIVE",
  urgent: "TIME_SENSITIVE",
}

const PRIORITY_APP_TO_DB: Record<PriorityLevel, DatabaseTask["priority_level"]> = {
  GUEST_REQUEST: "medium",
  TIME_SENSITIVE: "urgent",
  DAILY_TASK: "low",
  PREVENTIVE_MAINTENANCE: "high",
}

const TASK_STATUS_VALUES: TaskStatus[] = ["PENDING", "IN_PROGRESS", "PAUSED", "COMPLETED", "REJECTED"]

function normalizeDepartment(role: DatabaseUser["role"], department: DatabaseUser["department"]): Department {
  if (department === "housekeeping" || department === "maintenance") {
    return department
  }

  if (role === "front_office" || role === "admin") {
    return "front_desk"
  }

  return "housekeeping"
}

function toTaskStatus(value: unknown): TaskStatus | null {
  if (typeof value !== "string") return null
  const lowercase = value.toLowerCase() as DatabaseTask["status"]
  if (lowercase in STATUS_DB_TO_APP) {
    return STATUS_DB_TO_APP[lowercase]
  }

  const uppercase = value.toUpperCase()
  if ((TASK_STATUS_VALUES as string[]).includes(uppercase)) {
    return uppercase as TaskStatus
  }

  return null
}

function toPriorityLevel(value: unknown): PriorityLevel {
  if (typeof value === "string") {
    const key = value.toLowerCase() as keyof typeof PRIORITY_DB_TO_APP
    if (key in PRIORITY_DB_TO_APP) {
      return PRIORITY_DB_TO_APP[key]
    }

    const uppercase = value.toUpperCase() as PriorityLevel
    if ((["GUEST_REQUEST", "TIME_SENSITIVE", "DAILY_TASK", "PREVENTIVE_MAINTENANCE"] as string[]).includes(uppercase)) {
      return uppercase as PriorityLevel
    }
  }

  return "DAILY_TASK"
}

function parseShiftTiming(raw: string | null) {
  if (!raw) {
    return { ...DEFAULT_SHIFT }
  }

  const trimmed = raw.trim()

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed)
      const start = typeof parsed.start === "string" ? parsed.start : DEFAULT_SHIFT.start
      const end = typeof parsed.end === "string" ? parsed.end : DEFAULT_SHIFT.end
      const breakStart = typeof parsed.breakStart === "string" ? parsed.breakStart : DEFAULT_SHIFT.breakStart
      const breakEnd = typeof parsed.breakEnd === "string" ? parsed.breakEnd : DEFAULT_SHIFT.breakEnd

      return {
        start,
        end,
        breakStart,
        breakEnd,
        hasBreak: Boolean(breakStart && breakEnd),
      }
    } catch (error) {
      console.warn("shift_timing JSON parse failed, falling back to range parsing:", error)
    }
  }

  const match = trimmed.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/)
  if (match) {
    return {
      start: match[1],
      end: match[2],
      breakStart: DEFAULT_SHIFT.breakStart,
      breakEnd: DEFAULT_SHIFT.breakEnd,
      hasBreak: false,
    }
  }

  return { ...DEFAULT_SHIFT }
}

function toDualTimestamp(value?: string | null, fallback?: string | null): DualTimestamp {
  const iso = value ?? fallback ?? new Date().toISOString()
  return { client: iso, server: iso }
}

function parseDualTimestampJson(data: Json | null, fallback?: string | null): DualTimestamp {
  if (!data) {
    return toDualTimestamp(undefined, fallback)
  }

  try {
    const parsed = typeof data === "string" ? JSON.parse(data) : (data as Record<string, string | undefined>)
    const client = typeof parsed?.client === "string" ? parsed.client : undefined
    const server = typeof parsed?.server === "string" ? parsed.server : undefined
    return toDualTimestamp(client ?? server, fallback)
  } catch (error) {
    console.warn("assigned_at JSON parse failed, using fallback:", error)
    return toDualTimestamp(undefined, fallback)
  }
}

function parsePauseHistory(data: Json): PauseRecord[] {
  if (!data) return []

  try {
    const value = typeof data === "string" ? JSON.parse(data) : data
    if (Array.isArray(value)) {
      return value
        .map((entry) => {
          const record = entry as Record<string, any>
          const pausedRaw = record?.paused_at
          const resumedRaw = record?.resumed_at

          const pausedSource =
            typeof pausedRaw === "string" ? pausedRaw : pausedRaw?.server ?? pausedRaw?.client ?? undefined
          const resumedSource =
            resumedRaw === null
              ? null
              : typeof resumedRaw === "string"
                ? resumedRaw
                : resumedRaw?.server ?? resumedRaw?.client ?? undefined

          return {
            paused_at: toDualTimestamp(pausedSource),
            resumed_at: resumedSource === null ? null : resumedSource ? toDualTimestamp(resumedSource) : null,
            reason: typeof record?.reason === "string" ? record.reason : "",
          }
        })
        .filter((entry): entry is PauseRecord => Boolean(entry.paused_at))
    }
  } catch (error) {
    console.warn("pause_history JSON parse failed, defaulting to empty array:", error)
  }

  return []
}

function parseAuditLog(data: Json): AuditLogEntry[] {
  if (!data) return []

  try {
    const value = typeof data === "string" ? JSON.parse(data) : data
    if (Array.isArray(value)) {
      return value
        .map((entry) => {
          const record = entry as Record<string, any>
          const timestampRaw = record?.timestamp
          const timestampSource =
            typeof timestampRaw === "string"
              ? timestampRaw
              : timestampRaw?.server ?? timestampRaw?.client ?? undefined

          return {
            timestamp: toDualTimestamp(timestampSource),
            user_id: typeof record?.user_id === "string" ? record.user_id : "",
            action: typeof record?.action === "string" ? record.action : "",
            old_status: toTaskStatus(record?.old_status),
            new_status: toTaskStatus(record?.new_status),
            details: typeof record?.details === "string" ? record.details : "",
          }
        })
        .filter((entry): entry is AuditLogEntry => Boolean(entry.action))
    }
  } catch (error) {
    console.warn("audit_log JSON parse failed, defaulting to empty array:", error)
  }

  return []
}

function parseCategorizedPhotos(data: Json): CategorizedPhotos | null {
  if (!data) return null

  try {
    const value = typeof data === "string" ? JSON.parse(data) : data
    if (value && typeof value === "object") {
      return value as CategorizedPhotos
    }
  } catch (error) {
    console.warn("categorized_photos JSON parse failed, defaulting to null:", error)
  }

  return null
}

function parsePhotoRequirements(data: Json): {
  simpleRequired: boolean
  simpleCount: number | null
  documentationRequired: boolean
  categories: Task["photo_categories"]
} {
  if (!data) {
    return {
      simpleRequired: false,
      simpleCount: null,
      documentationRequired: false,
      categories: null,
    }
  }

  try {
    const value = typeof data === "string" ? JSON.parse(data) : data

    if (Array.isArray(value)) {
      return {
        simpleRequired: false,
        simpleCount: null,
        documentationRequired: value.length > 0,
        categories: value as Task["photo_categories"],
      }
    }

    if (value && typeof value === "object") {
      const simple = (value as Record<string, any>).simple
      const simpleRequired = Boolean(simple?.required)
      const simpleCount = typeof simple?.count === "number" ? simple.count : null

      return {
        simpleRequired,
        simpleCount,
        documentationRequired: false,
        categories: null,
      }
    }
  } catch (error) {
    console.warn("photo_requirements JSON parse failed, defaulting to null:", error)
  }

  return {
    simpleRequired: false,
    simpleCount: null,
    documentationRequired: false,
    categories: null,
  }
}

export function databaseUserToApp(dbUser: DatabaseUser): User {
  const shift = parseShiftTiming(dbUser.shift_timing)

  return {
    id: dbUser.id,
    name: dbUser.name,
    role: dbUser.role,
    phone: dbUser.phone ?? "",
    department: normalizeDepartment(dbUser.role, dbUser.department),
    shift_start: shift.start,
    shift_end: shift.end,
    has_break: shift.hasBreak,
    break_start: shift.breakStart,
    break_end: shift.breakEnd,
    is_available: true,
  }
}

export function databaseTaskToApp(dbTask: DatabaseTask): Task {
  const assignedAt = parseDualTimestampJson(dbTask.assigned_at, dbTask.created_at)
  const startedAt = dbTask.started_at ? toDualTimestamp(dbTask.started_at) : null
  const completedAt = dbTask.completed_at ? toDualTimestamp(dbTask.completed_at) : null
  const categorizedPhotos = parseCategorizedPhotos(dbTask.categorized_photos)
  const pauseHistory = parsePauseHistory(dbTask.pause_history)
  const auditLog = parseAuditLog(dbTask.audit_log)

  const photoSettings = parsePhotoRequirements(dbTask.photo_requirements)
  const photoCategories = photoSettings.categories

  return {
    id: dbTask.id,
    task_type: dbTask.task_type,
    priority_level: dbTask.priority_level ? PRIORITY_DB_TO_APP[dbTask.priority_level] : "DAILY_TASK",
    status: STATUS_DB_TO_APP[dbTask.status],
    department: "housekeeping",
    assigned_to_user_id: dbTask.assigned_to_user_id ?? "",
    assigned_by_user_id: dbTask.assigned_by_user_id ?? "",
    assigned_at: assignedAt,
    started_at: startedAt,
    completed_at: completedAt,
    expected_duration_minutes: dbTask.estimated_duration ?? 0,
    actual_duration_minutes: dbTask.actual_duration,
    photo_urls: [],
    categorized_photos: categorizedPhotos,
    photo_required: photoSettings.simpleRequired,
    photo_count: photoSettings.simpleCount,
    photo_documentation_required: photoSettings.documentationRequired,
    photo_categories: photoCategories,
    worker_remark: dbTask.worker_remarks ?? "",
    supervisor_remark: dbTask.supervisor_remarks ?? "",
    rating: dbTask.quality_rating ?? null,
    quality_comment: null,
    rating_proof_photo_url: null,
    rejection_proof_photo_url: null,
    room_number: dbTask.room_number ?? "",
    pause_history: pauseHistory,
    audit_log: auditLog,
    is_custom_task: false,
    custom_task_name: null,
    custom_task_category: null,
    custom_task_priority: null,
    custom_task_photo_required: null,
    custom_task_photo_count: null,
    custom_task_processed: false,
    rejection_acknowledged: false,
    rejection_acknowledged_at: null,
    server_updated_at: dbTask.updated_at ?? null,
  }
}

export function databaseShiftScheduleToApp(dbSchedule: DatabaseShiftSchedule): ShiftSchedule {
  return {
    id: dbSchedule.id,
    worker_id: dbSchedule.worker_id,
    schedule_date: dbSchedule.schedule_date,
    shift_start: dbSchedule.shift_start,
    shift_end: dbSchedule.shift_end,
    has_break: Boolean(dbSchedule.break_start && dbSchedule.break_end),
    break_start: dbSchedule.break_start ?? undefined,
    break_end: dbSchedule.break_end ?? undefined,
    is_override: dbSchedule.is_override,
    override_reason: dbSchedule.override_reason ?? undefined,
    notes: undefined,
    created_at: dbSchedule.created_at,
  }
}

// ============================================================================
// CONVERSION FUNCTIONS: App → Database
// ============================================================================

export function appUserToDatabase(
  user: User,
  username?: string,
  passwordHash?: string,
): Omit<DatabaseUser, "created_at"> {
  if (!username || !passwordHash) {
    // Supabase enforces unique credential fields, so we skip sync when they are missing
    throw new Error("Username and password hash are required to sync user records with Supabase")
  }

  // Convert shift object to JSON string
  const shiftTiming = JSON.stringify({
    start: user.shift_start,
    end: user.shift_end,
    breakStart: user.break_start,
    breakEnd: user.break_end,
  })

  const department = user.department === "front_desk" ? null : user.department

  return {
    id: user.id,
    username,
    password_hash: passwordHash,
    name: user.name,
    role: user.role,
    phone: user.phone || null,
    department,
    shift_timing: shiftTiming,
  }
}

export function appTaskToDatabase(task: Task): Omit<DatabaseTask, "created_at" | "updated_at"> {
  const assignedAt = task.assigned_at
    ? {
        client: task.assigned_at.client,
        server: task.assigned_at.server,
      }
    : null

  let photoRequirements: Json = []

  if (task.photo_documentation_required) {
    photoRequirements = (task.photo_categories ?? []) as Json
  } else if (task.photo_required) {
    photoRequirements = {
      simple: {
        required: true,
        count: typeof task.photo_count === "number" ? task.photo_count : null,
      },
    }
  }

  const categorizedPhotos =
    task.categorized_photos ?? ({ room_photos: [], proof_photos: [] } as CategorizedPhotos)

  return {
    id: task.id,
    task_type: task.task_type,
    room_number: task.room_number || null,
    status: STATUS_APP_TO_DB[task.status],
    priority_level: PRIORITY_APP_TO_DB[task.priority_level] ?? null,
    assigned_to_user_id: task.assigned_to_user_id || null,
    assigned_by_user_id: task.assigned_by_user_id || null,
    started_at: task.started_at?.server ?? null,
    completed_at: task.completed_at?.server ?? null,
    verified_at: task.status === "COMPLETED" ? task.completed_at?.server ?? null : null,
    verified_by_user_id: null,
    assigned_at: assignedAt as Json,
    description: task.worker_remark || null,
    special_instructions: task.supervisor_remark || null,
    estimated_duration: task.expected_duration_minutes ?? null,
    actual_duration: task.actual_duration_minutes ?? null,
  categorized_photos: (categorizedPhotos as unknown) as Json,
    worker_remarks: task.worker_remark || null,
    supervisor_remarks: task.supervisor_remark || null,
    quality_rating: task.rating ?? null,
    requires_verification: task.photo_documentation_required ?? task.photo_required ?? false,
    timer_validation_flag: false,
    audit_log: (task.audit_log as unknown) as Json,
    pause_history: (task.pause_history as unknown) as Json,
    photo_requirements: photoRequirements,
  }
}

export function appShiftScheduleToDatabase(schedule: ShiftSchedule): Omit<DatabaseShiftSchedule, "created_at"> {
  return {
    id: schedule.id,
    worker_id: schedule.worker_id,
    schedule_date: schedule.schedule_date,
    shift_start: schedule.shift_start,
    shift_end: schedule.shift_end,
    break_start: schedule.break_start || null,
    break_end: schedule.break_end || null,
    is_override: schedule.is_override || false,
    override_reason: schedule.override_reason || null,
  }
}
