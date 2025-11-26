// Database types that match the Supabase schema exactly
// Phase 1.3: TypeScript types with conversion functions

import type {
  Task,
  User,
  ShiftSchedule,
  Department,
  RecurringFrequency,
  DualTimestamp,
  PauseRecord,
  AuditLogEntry,
  PriorityLevel,
  TaskStatus,
  CategorizedPhotos,
  TaskCategory,
  Priority,
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
  role: "worker" | "supervisor" | "front_office" | "manager" | "admin"
  phone: string | null
  department: "housekeeping" | "maintenance" | "housekeeping-dept" | "maintenance-dept" | "admin" | null
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
  estimated_duration: number | null
  actual_duration: number | null
  categorized_photos: Json
  worker_remarks: string | null
  supervisor_remarks: string | null
  quality_rating: number | null
  requires_verification: boolean
  audit_log: Json
  pause_history: Json
  photo_requirements: Json
  department: Department | null
  // Custom task fields
  is_custom_task: boolean
  custom_task_name: string | null
  custom_task_category: string | null
  custom_task_priority: string | null
  custom_task_photo_required: boolean | null
  custom_task_photo_count: number | null
  custom_task_is_recurring: boolean | null
  custom_task_recurring_frequency: string | null
  custom_task_requires_specific_time: boolean | null
  custom_task_recurring_time: string | null
  custom_task_recurring_days: string[] | null
}

export interface DatabaseShiftSchedule {
  id: string
  worker_id: string
  schedule_date: string
  // Legacy single shift fields (for backward compatibility)
  shift_start: string | null
  shift_end: string | null
  break_start: string | null
  break_end: string | null
  // Dual shift fields
  shift_1_start: string | null
  shift_1_end: string | null
  shift_1_break_start: string | null
  shift_1_break_end: string | null
  shift_2_start: string | null
  shift_2_end: string | null
  shift_2_break_start: string | null
  shift_2_break_end: string | null
  shift_2_has_break?: boolean
  has_shift_2: boolean
  is_dual_shift: boolean
  is_override: boolean
  override_reason: string | null
  notes: string | null
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
  notes: string | null
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
  assigned_to?: string[] | null
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
  isDualShift: false,
  hasShift2: false,
  shift2Start: undefined as string | undefined,
  shift2End: undefined as string | undefined,
  shift2HasBreak: false,
  shift2BreakStart: undefined as string | undefined,
  shift2BreakEnd: undefined as string | undefined,
}

const STATUS_DB_TO_APP: Record<DatabaseTask["status"], TaskStatus> = {
  pending: "PENDING",
  assigned: "PENDING",
  in_progress: "IN_PROGRESS",
  paused: "PAUSED",
  completed: "COMPLETED",
  verified: "VERIFIED",
  rejected: "REJECTED",
}

const STATUS_APP_TO_DB: Record<TaskStatus, DatabaseTask["status"]> = {
  PENDING: "pending",
  IN_PROGRESS: "in_progress",
  PAUSED: "paused",
  COMPLETED: "completed",
  VERIFIED: "verified",
  REJECTED: "rejected",
}

const PRIORITY_DB_TO_APP: Record<NonNullable<DatabaseTask["priority_level"]>, PriorityLevel> = {
  low: "DAILY_TASK",
  medium: "GUEST_REQUEST",
  high: "PREVENTIVE_MAINTENANCE",
  urgent: "TIME_SENSITIVE",
}

const PRIORITY_APP_TO_DB: Record<PriorityLevel, DatabaseTask["priority_level"]> = {
  DAILY_TASK: "low",
  GUEST_REQUEST: "medium",
  PREVENTIVE_MAINTENANCE: "high",
  TIME_SENSITIVE: "urgent",
}

const TASK_STATUS_VALUES: TaskStatus[] = ["PENDING", "IN_PROGRESS", "PAUSED", "COMPLETED", "REJECTED"]
const TASK_CATEGORY_VALUES: TaskCategory[] = [
  "GUEST_REQUEST",
  "ROOM_CLEANING",
  "COMMON_AREA",
  "PREVENTIVE_MAINTENANCE",
  "TIME_SENSITIVE",
]
const PRIORITY_VALUES: Priority[] = ["urgent", "high", "medium", "low"]
const RECURRING_FREQUENCY_VALUES: RecurringFrequency[] = [
  "daily",
  "weekly",
  "biweekly",
  "monthly",
  "custom",
]

function normalizeDepartment(role: DatabaseUser["role"], department: DatabaseUser["department"]): Department {
  if (
    department === "housekeeping" ||
    department === "maintenance" ||
    department === "admin" ||
    department === "housekeeping-dept" ||
    department === "maintenance-dept"
  ) {
    return department
  }

  if (role === "front_office" || role === "manager" || role === "admin") {
    return "front_office"
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

function toCustomTaskCategory(value: unknown): TaskCategory | null {
  if (typeof value === "string") {
    const upper = value.toUpperCase() as TaskCategory
    if ((TASK_CATEGORY_VALUES as string[]).includes(upper)) {
      return upper as TaskCategory
    }
  }

  return null
}

function toCustomTaskPriority(value: unknown): Priority | null {
  if (typeof value === "string") {
    const lower = value.toLowerCase() as Priority
    if ((PRIORITY_VALUES as string[]).includes(lower)) {
      return lower as Priority
    }
  }

  return null
}

function toTaskDepartment(value: DatabaseTask["department"]): Department {
  if (
    value === "housekeeping" ||
    value === "maintenance" ||
    value === "front_office" ||
    value === "admin" ||
    value === "housekeeping-dept" ||
    value === "maintenance-dept"
  ) {
    return value
  }

  return "housekeeping"
}

function toRecurringFrequency(value: unknown): RecurringFrequency | null {
  if (typeof value !== "string") {
    return null
  }

  const normalized = value.toLowerCase() as RecurringFrequency
  if ((RECURRING_FREQUENCY_VALUES as string[]).includes(normalized)) {
    return normalized as RecurringFrequency
  }

  return null
}

function toRecurringDays(value: DatabaseTask["custom_task_recurring_days"]): string[] | null {
  if (!value) {
    return null
  }

  if (Array.isArray(value)) {
    const validDays = value.filter((entry): entry is string => typeof entry === "string")
    return validDays.length > 0 ? validDays : null
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) {
        const validDays = parsed.filter((entry): entry is string => typeof entry === "string")
        return validDays.length > 0 ? validDays : null
      }
    } catch (error) {
      console.warn("custom_task_recurring_days parse failed, defaulting to null:", error)
    }
  }

  return null
}

function parseShiftTiming(raw: string | null) {
  if (!raw) {
    return { ...DEFAULT_SHIFT }
  }

  const trimmed = raw.trim()

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) ?? {}
      const shift1Source =
        parsed && typeof parsed.shift1 === "object" && parsed.shift1 !== null ? parsed.shift1 : parsed
      const shift2Source =
        parsed && typeof parsed.shift2 === "object" && parsed.shift2 !== null
          ? parsed.shift2
          : parsed && typeof parsed.secondary_shift === "object" && parsed.secondary_shift !== null
            ? parsed.secondary_shift
            : parsed && typeof parsed.secondaryShift === "object" && parsed.secondaryShift !== null
              ? parsed.secondaryShift
              : null

      const start =
        typeof shift1Source.start === "string"
          ? shift1Source.start
          : typeof parsed.start === "string"
            ? parsed.start
            : DEFAULT_SHIFT.start
      const end =
        typeof shift1Source.end === "string"
          ? shift1Source.end
          : typeof parsed.end === "string"
            ? parsed.end
            : DEFAULT_SHIFT.end
      const breakStart =
        typeof shift1Source.breakStart === "string"
          ? shift1Source.breakStart
          : typeof shift1Source.break_start === "string"
            ? shift1Source.break_start
            : typeof parsed.breakStart === "string"
              ? parsed.breakStart
              : typeof parsed.break_start === "string"
                ? parsed.break_start
                : DEFAULT_SHIFT.breakStart
      const breakEnd =
        typeof shift1Source.breakEnd === "string"
          ? shift1Source.breakEnd
          : typeof shift1Source.break_end === "string"
            ? shift1Source.break_end
            : typeof parsed.breakEnd === "string"
              ? parsed.breakEnd
              : typeof parsed.break_end === "string"
                ? parsed.break_end
                : DEFAULT_SHIFT.breakEnd

      const shift2Start =
        shift2Source && typeof shift2Source.start === "string"
          ? shift2Source.start
          : typeof parsed.shift2Start === "string"
            ? parsed.shift2Start
            : typeof parsed.shift_2_start === "string"
              ? parsed.shift_2_start
              : DEFAULT_SHIFT.shift2Start
      const shift2End =
        shift2Source && typeof shift2Source.end === "string"
          ? shift2Source.end
          : typeof parsed.shift2End === "string"
            ? parsed.shift2End
            : typeof parsed.shift_2_end === "string"
              ? parsed.shift_2_end
              : DEFAULT_SHIFT.shift2End
      const shift2BreakStart =
        shift2Source && typeof shift2Source.breakStart === "string"
          ? shift2Source.breakStart
          : shift2Source && typeof shift2Source.break_start === "string"
            ? shift2Source.break_start
            : typeof parsed.shift2BreakStart === "string"
              ? parsed.shift2BreakStart
              : typeof parsed.shift_2_break_start === "string"
                ? parsed.shift_2_break_start
                : DEFAULT_SHIFT.shift2BreakStart
      const shift2BreakEnd =
        shift2Source && typeof shift2Source.breakEnd === "string"
          ? shift2Source.breakEnd
          : shift2Source && typeof shift2Source.break_end === "string"
            ? shift2Source.break_end
            : typeof parsed.shift2BreakEnd === "string"
              ? parsed.shift2BreakEnd
              : typeof parsed.shift_2_break_end === "string"
                ? parsed.shift_2_break_end
                : DEFAULT_SHIFT.shift2BreakEnd

      const rawHasShift2 = parsed.hasShift2 ?? parsed.has_shift_2
      const hasShift2 =
        typeof rawHasShift2 === "boolean" ? rawHasShift2 : Boolean(shift2Start && shift2End)
      const isDualShift = Boolean(parsed.isDualShift ?? parsed.is_dual_shift ?? hasShift2)
      const shift2HasBreak = Boolean(shift2BreakStart && shift2BreakEnd)

      return {
        start,
        end,
        breakStart,
        breakEnd,
        hasBreak: Boolean(breakStart && breakEnd),
        isDualShift,
        hasShift2,
        shift2Start: shift2Start ?? undefined,
        shift2End: shift2End ?? undefined,
        shift2HasBreak,
        shift2BreakStart: shift2BreakStart ?? undefined,
        shift2BreakEnd: shift2BreakEnd ?? undefined,
      }
    } catch (error) {
      console.warn("shift_timing JSON parse failed, falling back to range parsing:", error)
    }
  }

  const match = trimmed.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/)
  if (match) {
    return {
      ...DEFAULT_SHIFT,
      start: match[1],
      end: match[2],
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function extractTimestampSource(raw: unknown): string | undefined {
  if (typeof raw === "string") {
    return raw
  }

  if (isRecord(raw)) {
    const server = raw["server"]
    if (typeof server === "string") {
      return server
    }

    const client = raw["client"]
    if (typeof client === "string") {
      return client
    }
  }

  return undefined
}

function parsePauseHistory(data: Json): PauseRecord[] {
  if (!data) return []

  try {
    const value = typeof data === "string" ? JSON.parse(data) : data
    if (Array.isArray(value)) {
      return value
        .map<PauseRecord | null>((entry) => {
          if (!isRecord(entry)) {
            return null
          }

          const pausedSource = extractTimestampSource(entry["paused_at"])
          if (!pausedSource) {
            return null
          }

          const resumedRaw = entry["resumed_at"]
          let resumedTimestamp: DualTimestamp | null = null

          if (resumedRaw === null) {
            resumedTimestamp = null
          } else {
            const resumedSource = extractTimestampSource(resumedRaw)
            resumedTimestamp = resumedSource ? toDualTimestamp(resumedSource) : null
          }

          const reasonRaw = entry["reason"]

          return {
            paused_at: toDualTimestamp(pausedSource),
            resumed_at: resumedTimestamp,
            reason: typeof reasonRaw === "string" ? reasonRaw : "",
          }
        })
        .filter((entry): entry is PauseRecord => entry !== null)
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
        .map<AuditLogEntry | null>((entry) => {
          if (!isRecord(entry)) {
            return null
          }

          const timestampSource = extractTimestampSource(entry["timestamp"])
          if (!timestampSource) {
            return null
          }

          const userIdRaw = entry["user_id"]
          const actionRaw = entry["action"]
          const oldStatusRaw = entry["old_status"]
          const newStatusRaw = entry["new_status"]
          const detailsRaw = entry["details"]

          return {
            timestamp: toDualTimestamp(timestampSource),
            user_id: typeof userIdRaw === "string" ? userIdRaw : "",
            action: typeof actionRaw === "string" ? actionRaw : "",
            old_status: toTaskStatus(oldStatusRaw),
            new_status: toTaskStatus(newStatusRaw),
            details: typeof detailsRaw === "string" ? detailsRaw : "",
          }
        })
        .filter((entry): entry is AuditLogEntry => entry !== null && Boolean(entry.action))
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

    if (isRecord(value)) {
      const simpleRaw = value["simple"]
      const simpleRecord = isRecord(simpleRaw) ? simpleRaw : null
      const simpleRequired = Boolean(simpleRecord?.["required"])
      const simpleCountValue = simpleRecord?.["count"]
      const simpleCount = typeof simpleCountValue === "number" ? simpleCountValue : null

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
    is_dual_shift: shift.isDualShift,
    has_shift_2: shift.hasShift2,
    shift_2_start: shift.shift2Start,
    shift_2_end: shift.shift2End,
    shift_2_has_break: shift.shift2HasBreak,
    shift_2_break_start: shift.shift2BreakStart,
    shift_2_break_end: shift.shift2BreakEnd,
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
    department: toTaskDepartment(dbTask.department),
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
    is_custom_task: dbTask.is_custom_task ?? false,
    custom_task_name: dbTask.custom_task_name ?? null,
    custom_task_category: toCustomTaskCategory(dbTask.custom_task_category),
    custom_task_priority: toCustomTaskPriority(dbTask.custom_task_priority),
    custom_task_photo_required: dbTask.custom_task_photo_required ?? null,
    custom_task_photo_count: dbTask.custom_task_photo_count ?? null,
    custom_task_is_recurring: dbTask.custom_task_is_recurring ?? null,
    custom_task_recurring_frequency: toRecurringFrequency(dbTask.custom_task_recurring_frequency),
    custom_task_requires_specific_time: dbTask.custom_task_requires_specific_time ?? null,
    custom_task_recurring_time: dbTask.custom_task_recurring_time ?? null,
    custom_task_recurring_days: toRecurringDays(dbTask.custom_task_recurring_days),
    custom_task_processed: false,
    rejection_acknowledged: false,
    rejection_acknowledged_at: null,
    server_updated_at: dbTask.updated_at ?? null,
  }
}

export function databaseShiftScheduleToApp(dbSchedule: DatabaseShiftSchedule): ShiftSchedule {
  // For dual shifts, prioritize shift_1 fields, fall back to legacy fields
  const shiftStart = dbSchedule.shift_1_start || dbSchedule.shift_start
  const shiftEnd = dbSchedule.shift_1_end || dbSchedule.shift_end
  const breakStart = dbSchedule.shift_1_break_start || dbSchedule.break_start
  const breakEnd = dbSchedule.shift_1_break_end || dbSchedule.break_end
  const shift1HasBreak = Boolean(breakStart && breakEnd)
  const shift2HasBreak = Boolean(dbSchedule.shift_2_break_start && dbSchedule.shift_2_break_end)
  const hasShift2 =
    dbSchedule.has_shift_2 || Boolean(dbSchedule.shift_2_start && dbSchedule.shift_2_end)
  const isDualShift = dbSchedule.is_dual_shift || hasShift2

  return {
    id: dbSchedule.id,
    worker_id: dbSchedule.worker_id,
    schedule_date: dbSchedule.schedule_date,
    shift_start: shiftStart ?? "09:00",
    shift_end: shiftEnd ?? "17:00",
    has_break: shift1HasBreak,
    break_start: shift1HasBreak ? breakStart ?? undefined : undefined,
    break_end: shift1HasBreak ? breakEnd ?? undefined : undefined,
    shift_1_start: shiftStart ?? undefined,
    shift_1_end: shiftEnd ?? undefined,
    shift_1_break_start: shift1HasBreak ? breakStart ?? undefined : undefined,
    shift_1_break_end: shift1HasBreak ? breakEnd ?? undefined : undefined,
    is_override: dbSchedule.is_override,
    override_reason: dbSchedule.override_reason ?? undefined,
    notes: dbSchedule.notes ?? undefined,
    created_at: dbSchedule.created_at,
    // Dual shift specific fields
    has_shift_2: hasShift2,
    is_dual_shift: isDualShift,
    shift_2_start: dbSchedule.shift_2_start ?? undefined,
    shift_2_end: dbSchedule.shift_2_end ?? undefined,
    shift_2_has_break: shift2HasBreak,
    shift_2_break_start: shift2HasBreak ? dbSchedule.shift_2_break_start ?? undefined : undefined,
    shift_2_break_end: shift2HasBreak ? dbSchedule.shift_2_break_end ?? undefined : undefined,
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
    shift1: {
      start: user.shift_start,
      end: user.shift_end,
      hasBreak: user.has_break,
      breakStart: user.break_start ?? null,
      breakEnd: user.break_end ?? null,
    },
    shift2:
      user.has_shift_2 || user.is_dual_shift
        ? {
          start: user.shift_2_start ?? null,
          end: user.shift_2_end ?? null,
          hasBreak: user.shift_2_has_break ?? false,
          breakStart: user.shift_2_break_start ?? null,
          breakEnd: user.shift_2_break_end ?? null,
        }
        : null,
    isDualShift: Boolean(user.is_dual_shift ?? user.has_shift_2),
    hasShift2: Boolean(user.has_shift_2),
  })

  const department = user.department === "front_office" ? null : user.department

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
    estimated_duration: task.expected_duration_minutes ?? null,
    actual_duration: task.actual_duration_minutes ?? null,
    categorized_photos: (categorizedPhotos as unknown) as Json,
    worker_remarks: task.worker_remark || null,
    supervisor_remarks: task.supervisor_remark || null,
    quality_rating: task.rating ?? null,
    requires_verification: task.photo_documentation_required ?? task.photo_required ?? false,
    audit_log: (task.audit_log as unknown) as Json,
    pause_history: (task.pause_history as unknown) as Json,
    photo_requirements: photoRequirements,
    department: task.department || null,
    // Custom task fields
    is_custom_task: task.is_custom_task ?? false,
    custom_task_name: task.custom_task_name ?? null,
    custom_task_category: task.custom_task_category ?? null,
    custom_task_priority: task.custom_task_priority ?? null,
    custom_task_photo_required: task.custom_task_photo_required ?? null,
    custom_task_photo_count: task.custom_task_photo_count ?? null,
    custom_task_is_recurring: task.custom_task_is_recurring ?? null,
    custom_task_recurring_frequency: task.custom_task_recurring_frequency ?? null,
    custom_task_requires_specific_time: task.custom_task_requires_specific_time ?? null,
    custom_task_recurring_time: task.custom_task_recurring_time ?? null,
    custom_task_recurring_days: task.custom_task_recurring_days ?? null,
  }
}

export function appShiftScheduleToDatabase(schedule: ShiftSchedule): Omit<DatabaseShiftSchedule, "created_at"> {
  const shift1Start = schedule.shift_1_start ?? schedule.shift_start ?? null
  const shift1End = schedule.shift_1_end ?? schedule.shift_end ?? null
  const shift1BreakStart = schedule.shift_1_break_start ?? schedule.break_start ?? null
  const shift1BreakEnd = schedule.shift_1_break_end ?? schedule.break_end ?? null
  const shift1HasBreak = Boolean(shift1BreakStart && shift1BreakEnd)

  const shift2Start = schedule.shift_2_start ?? null
  const shift2End = schedule.shift_2_end ?? null
  const shift2BreakStart = schedule.shift_2_break_start ?? null
  const shift2BreakEnd = schedule.shift_2_break_end ?? null
  const shift2HasBreak = Boolean(shift2BreakStart && shift2BreakEnd)

  const hasShift2 = Boolean(schedule.has_shift_2 ?? (shift2Start && shift2End))
  const isDualShift = Boolean(schedule.is_dual_shift ?? hasShift2)

  return {
    id: schedule.id,
    worker_id: schedule.worker_id,
    schedule_date: schedule.schedule_date,
    shift_start: shift1Start,
    shift_end: shift1End,
    break_start: shift1HasBreak ? shift1BreakStart : null,
    break_end: shift1HasBreak ? shift1BreakEnd : null,
    shift_1_start: shift1Start,
    shift_1_end: shift1End,
    shift_1_break_start: shift1HasBreak ? shift1BreakStart : null,
    shift_1_break_end: shift1HasBreak ? shift1BreakEnd : null,
    shift_2_start: hasShift2 ? shift2Start : null,
    shift_2_end: hasShift2 ? shift2End : null,
    shift_2_break_start: shift2HasBreak ? shift2BreakStart : null,
    shift_2_break_end: shift2HasBreak ? shift2BreakEnd : null,
    has_shift_2: hasShift2,
    is_dual_shift: isDualShift,
    is_override: schedule.is_override || false,
    override_reason: schedule.override_reason || null,
    notes:
      typeof schedule.notes === "string" && schedule.notes.trim().length > 0 ? schedule.notes.trim() : null,
  }
}
