import { createClient } from "@/lib/supabase/client"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Task, User, ShiftSchedule } from "./types"
import {
  AREA_LABELS,
  MAINTENANCE_AREAS,
  MAINTENANCE_FREQUENCIES,
  MAINTENANCE_TASK_TYPES,
  TASK_TYPE_LABELS,
  type MaintenanceArea,
  type MaintenanceSchedule,
  type MaintenanceTask,
  type MaintenanceTaskType,
  type ScheduleFrequency,
} from "./maintenance-types"
import {
  databaseTaskToApp,
  appTaskToDatabase,
  databaseUserToApp,
  appUserToDatabase,
  databaseShiftScheduleToApp,
  appShiftScheduleToDatabase,
  type DatabaseTask,
  type DatabaseUser,
  type DatabaseMaintenanceSchedule,
  type DatabaseShiftSchedule,
} from "./database-types"

const CACHE_TTL_MS = 30_000
const TASK_FETCH_LIMIT = 200

type DatabaseTaskSummary = Pick<
  DatabaseTask,
  | "id"
  | "task_type"
  | "room_number"
  | "status"
  | "priority_level"
  | "assigned_to_user_id"
  | "assigned_by_user_id"
  | "created_at"
  | "updated_at"
  | "started_at"
  | "completed_at"
  | "assigned_at"
  | "estimated_duration"
  | "actual_duration"
  | "worker_remarks"
  | "supervisor_remarks"
  | "photo_requirements"
  | "requires_verification"
  | "is_custom_task"
  | "custom_task_name"
  | "custom_task_category"
  | "custom_task_priority"
  | "custom_task_photo_required"
  | "custom_task_photo_count"
  | "custom_task_is_recurring"
  | "custom_task_recurring_frequency"
  | "custom_task_requires_specific_time"
  | "custom_task_recurring_time"
>

type CacheKey =
  | "tasks"
  | "users"
  | "shift_schedules"
  | "maintenance_schedules"
  | "maintenance_tasks"

type CacheEntry<T> = {
  data: T
  timestamp: number
}

const cacheStore: Partial<Record<CacheKey, CacheEntry<unknown>>> = {}

const now = () => Date.now()

function getCachedValue<T>(key: CacheKey, forceRefresh?: boolean): T | null {
  if (forceRefresh) {
    return null
  }

  const entry = cacheStore[key]
  if (!entry) {
    return null
  }

  if (now() - entry.timestamp > CACHE_TTL_MS) {
    delete cacheStore[key]
    return null
  }

  return entry.data as T
}

function setCachedValue<T>(key: CacheKey, data: T) {
  cacheStore[key] = {
    data,
    timestamp: now(),
  }
}

function invalidateCache(...keys: CacheKey[]) {
  for (const key of keys) {
    delete cacheStore[key]
  }
}

const SUPABASE_FAILURE_COOLDOWN_MS = 15_000
const lastSupabaseFailureLog: Partial<Record<string, number>> = {}

function logSupabaseFailure(scope: CacheKey | "bootstrap", error: unknown) {
  const now = Date.now()
  const lastLogged = lastSupabaseFailureLog[scope]
  if (lastLogged && now - lastLogged < SUPABASE_FAILURE_COOLDOWN_MS) {
    return
  }
  lastSupabaseFailureLog[scope] = now

  const message = error instanceof Error ? error.message : String(error)
  const isNetwork =
    /fetch failed/i.test(message) || /ECONN|ENOTFOUND|ETIMEDOUT/i.test(message)
  const logger = isNetwork ? console.warn : console.error
  logger(`[supabase] ${scope} fetch failed; continuing with cached data`, error)
}

function parseTimeToMinutes(time: string | null | undefined): number {
  if (!time) {
    return 0
  }

  const parts = time.split(":")
  const hours = Number.parseInt(parts[0] ?? "0", 10)
  const minutes = Number.parseInt(parts[1] ?? "0", 10)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return 0
  }

  return hours * 60 + minutes
}

export interface LoadOptions {
  forceRefresh?: boolean
}

function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function normalizeMaintenanceStatus(status: MaintenanceTask["status"]): "pending" | "in_progress" | "completed" | "verified" {
  switch (status) {
    case "pending":
      return "pending"
    case "in_progress":
      return "in_progress"
    case "completed":
      return "completed"
    case "paused":
      return "in_progress"
    default:
      return "pending"
  }
}

export async function loadTasksFromSupabase(
  options: LoadOptions = {},
  supabaseOverride?: SupabaseClient,
): Promise<Task[]> {
  const cached = getCachedValue<Task[]>("tasks", options.forceRefresh)
  if (cached) {
    return cached
  }

  try {
    const supabase = supabaseOverride ?? createClient()
    const { data, error } = await supabase
      .from("tasks")
      .select(
        [
          "id",
          "task_type",
          "room_number",
          "status",
          "priority_level",
          "assigned_to_user_id",
          "assigned_by_user_id",
          "created_at",
          "updated_at",
          "started_at",
          "completed_at",
          "assigned_at",
          "estimated_duration",
          "actual_duration",
          "worker_remarks",
          "supervisor_remarks",
          "photo_requirements",
          "requires_verification",
          // Custom task fields
          "is_custom_task",
          "custom_task_name",
          "custom_task_category",
          "custom_task_priority",
          "custom_task_photo_required",
          "custom_task_photo_count",
          "custom_task_is_recurring",
          "custom_task_recurring_frequency",
          "custom_task_requires_specific_time",
          "custom_task_recurring_time",
        ].join(","),
      )
      .order("updated_at", { ascending: false })
      .limit(TASK_FETCH_LIMIT)

    if (error) {
      console.error("[v0] Error loading tasks from Supabase:", error)
      throw new Error(`Failed to load tasks: ${error.message}`)
    }

    const rows = (data ?? []) as DatabaseTaskSummary[]

    const mapped = rows.map((row) =>
      databaseTaskToApp({
        id: row.id,
        task_type: row.task_type,
        room_number: row.room_number,
        status: row.status,
        priority_level: row.priority_level,
        assigned_to_user_id: row.assigned_to_user_id,
        assigned_by_user_id: row.assigned_by_user_id,
        created_at: row.created_at,
        updated_at: row.updated_at,
        started_at: row.started_at ?? null,
        completed_at: row.completed_at ?? null,
        verified_at: null,
        verified_by_user_id: null,
        assigned_at: row.assigned_at ?? null,
        description: null,
        special_instructions: null,
        estimated_duration: row.estimated_duration ?? null,
        actual_duration: row.actual_duration ?? null,
        categorized_photos: [],
        worker_remarks: row.worker_remarks ?? null,
        supervisor_remarks: row.supervisor_remarks ?? null,
        quality_rating: null,
        requires_verification: row.requires_verification ?? false,
        timer_validation_flag: false,
        audit_log: [],
        pause_history: [],
        photo_requirements: row.photo_requirements ?? null,
        // Custom task fields
        is_custom_task: row.is_custom_task ?? false,
        custom_task_name: row.custom_task_name ?? null,
        custom_task_category: row.custom_task_category ?? null,
        custom_task_priority: row.custom_task_priority ?? null,
        custom_task_photo_required: row.custom_task_photo_required ?? null,
        custom_task_photo_count: row.custom_task_photo_count ?? null,
        custom_task_is_recurring: row.custom_task_is_recurring ?? null,
        custom_task_recurring_frequency: row.custom_task_recurring_frequency ?? null,
        custom_task_requires_specific_time: row.custom_task_requires_specific_time ?? null,
        custom_task_recurring_time: row.custom_task_recurring_time ?? null,
      } as DatabaseTask),
    )
    setCachedValue("tasks", mapped)

    console.log(`[v0] Loaded ${mapped.length} tasks from Supabase`)
    return mapped
  } catch (error) {
    logSupabaseFailure("tasks", error)
    return []
  }
}

export async function loadUsersFromSupabase(
  options: LoadOptions = {},
  supabaseOverride?: SupabaseClient,
): Promise<User[]> {
  const cached = getCachedValue<User[]>("users", options.forceRefresh)
  if (cached) {
    return cached
  }

  try {
    const supabase = supabaseOverride ?? createClient()
    const { data, error } = await supabase
      .from("users")
      .select("id, username, name, role, phone, department, shift_timing, created_at")
      .order("name", { ascending: true })

    if (error) {
      console.error("[v0] Error loading users from Supabase:", error)
      throw new Error(`Failed to load users: ${error.message}`)
    }

  const mapped = ((data ?? []) as DatabaseUser[]).map((dbUser) => databaseUserToApp(dbUser))
    setCachedValue("users", mapped)

    console.log(`[v0] Loaded ${mapped.length} users from Supabase`)
    return mapped
  } catch (error) {
    logSupabaseFailure("users", error)
    return []
  }
}

export async function saveTaskToSupabase(task: Task): Promise<boolean> {
  try {
    const supabase = createClient()
    const dbTask = appTaskToDatabase(task)

    console.log("[v0] Saving task to Supabase:", {
      id: task.id,
      status: task.status,
      hasAuditLog: !!dbTask.audit_log,
      hasPauseHistory: !!dbTask.pause_history,
    })

    const { error } = await supabase.from("tasks").upsert(dbTask)

    if (error) {
      console.error("[v0] Error saving task to Supabase:", error)
      throw new Error(`Failed to save task: ${error.message}`)
    }

    invalidateCache("tasks")
    console.log("[v0] ✅ Task saved to Supabase:", task.id)
    return true
  } catch (error) {
    console.error("[v0] Exception saving task:", error)
    return false
  }
}

export async function saveUserToSupabase(
  user: User,
  credentials: { username: string; passwordHash: string },
): Promise<boolean> {
  try {
    const supabase = createClient()

    const dbUser = appUserToDatabase(user, credentials.username, credentials.passwordHash)

    const { error } = await supabase.from("users").upsert(dbUser)

    if (error) {
      console.error("[v0] Error saving user to Supabase:", error)
      throw new Error(`Failed to save user: ${error.message}`)
    }

    invalidateCache("users")
    console.log("[v0] ✅ User saved to Supabase:", user.id)
    return true
  } catch (error) {
    console.error("[v0] Exception saving user:", error)
    return false
  }
}

export async function loadShiftSchedulesFromSupabase(
  options: LoadOptions = {},
  supabaseOverride?: SupabaseClient,
): Promise<ShiftSchedule[]> {
  const cached = getCachedValue<ShiftSchedule[]>("shift_schedules", options.forceRefresh)
  if (cached) {
    return cached
  }

  try {
    const supabase = supabaseOverride ?? createClient()
    
    // Add diagnostic log to check database connection and schema
    console.log("[v0] DEBUG: Checking shift_schedules schema...")
    
    const baseColumns = [
      "id",
      "worker_id",
      "schedule_date",
      "shift_start",
      "shift_end",
      "break_start",
      "break_end",
      "shift_1_start",
      "shift_1_end",
      "shift_1_break_start",
      "shift_1_break_end",
      "shift_2_start",
      "shift_2_end",
      "shift_2_break_start",
      "shift_2_break_end",
      "has_shift_2",
      "is_dual_shift",
      "is_override",
      "override_reason",
      "notes",
      "created_at",
    ] as const

    const legacyColumns = [
      "id",
      "worker_id",
      "schedule_date",
      "shift_start",
      "shift_end",
      "break_start",
      "break_end",
      "is_override",
      "override_reason",
      "notes",
      "created_at",
    ] as const

    const executeQuery = async (columns: readonly string[]) =>
      supabase
        .from("shift_schedules")
        .select(columns.join(","))
        .order("schedule_date", { ascending: true })

    let { data, error } = await executeQuery(baseColumns)

    if (error && error.code === "42703") {
      console.warn(
        "[v0] shift_schedules dual-shift columns missing in Supabase; falling back to legacy schema.",
      )
      console.log("[v0] DEBUG: Schema error details:", {
        errorCode: error.code,
        errorMessage: error.message,
        details: error.details
      })
      const legacyResult = await executeQuery(legacyColumns)
      data = legacyResult.data
      error = legacyResult.error
    }

    if (error) {
      console.error("[v0] Error loading shift schedules from Supabase:", error)
      throw new Error(`Failed to load shift schedules: ${error.message}`)
    }

    const mapped = ((data ?? []) as Partial<DatabaseShiftSchedule>[]).map((dbSchedule) => {
      // When dual-shift columns are missing, the select query returns legacy shape.
      const enriched: DatabaseShiftSchedule = {
        id: dbSchedule.id ?? "",
        worker_id: dbSchedule.worker_id ?? "",
        schedule_date: dbSchedule.schedule_date ?? "",
        shift_start: dbSchedule.shift_start ?? null,
        shift_end: dbSchedule.shift_end ?? null,
        break_start: dbSchedule.break_start ?? null,
        break_end: dbSchedule.break_end ?? null,
        shift_1_start: "shift_1_start" in dbSchedule ? dbSchedule.shift_1_start ?? null : dbSchedule.shift_start ?? null,
        shift_1_end: "shift_1_end" in dbSchedule ? dbSchedule.shift_1_end ?? null : dbSchedule.shift_end ?? null,
        shift_1_break_start:
          "shift_1_break_start" in dbSchedule ? dbSchedule.shift_1_break_start ?? null : dbSchedule.break_start ?? null,
        shift_1_break_end:
          "shift_1_break_end" in dbSchedule ? dbSchedule.shift_1_break_end ?? null : dbSchedule.break_end ?? null,
        shift_2_start: "shift_2_start" in dbSchedule ? dbSchedule.shift_2_start ?? null : null,
        shift_2_end: "shift_2_end" in dbSchedule ? dbSchedule.shift_2_end ?? null : null,
        shift_2_break_start: "shift_2_break_start" in dbSchedule ? dbSchedule.shift_2_break_start ?? null : null,
        shift_2_break_end: "shift_2_break_end" in dbSchedule ? dbSchedule.shift_2_break_end ?? null : null,
        has_shift_2: "has_shift_2" in dbSchedule ? Boolean(dbSchedule.has_shift_2) : false,
        shift_2_has_break: "shift_2_has_break" in dbSchedule ? Boolean(dbSchedule.shift_2_has_break) : false,
        is_dual_shift: "is_dual_shift" in dbSchedule ? Boolean(dbSchedule.is_dual_shift) : false,
        is_override: Boolean(dbSchedule.is_override),
        override_reason: dbSchedule.override_reason ?? null,
        notes: dbSchedule.notes ?? null,
        created_at: dbSchedule.created_at ?? new Date().toISOString(),
      }

      // Infer dual-shift style only when the break spans an unusually long window (legacy data).
      if (
        !enriched.is_dual_shift &&
        !enriched.has_shift_2 &&
        enriched.shift_start &&
        enriched.shift_end &&
        enriched.break_start &&
        enriched.break_end
      ) {
        const breakStartMinutes = parseTimeToMinutes(enriched.break_start)
        const breakEndMinutes = parseTimeToMinutes(enriched.break_end)
        const inferredGap = Math.max(0, breakEndMinutes - breakStartMinutes)

        // Treat as an inter-shift gap only if the pause lasts at least 2 hours.
        if (inferredGap >= 120) {
          enriched.shift_1_start = enriched.shift_start
          enriched.shift_1_end = enriched.break_start
          enriched.shift_2_start = enriched.break_end
          enriched.shift_2_end = enriched.shift_end
          enriched.has_shift_2 = true
          enriched.is_dual_shift = true
        }
      }

      return databaseShiftScheduleToApp(enriched)
    })

    setCachedValue("shift_schedules", mapped)
    console.log(`[v0] Loaded ${mapped.length} shift schedules from Supabase`)
    return mapped
  } catch (error) {
    logSupabaseFailure("shift_schedules", error)
    return []
  }
}

export async function saveShiftScheduleToSupabase(schedule: ShiftSchedule): Promise<boolean> {
  try {
    const supabase = createClient()
    const dbSchedule = appShiftScheduleToDatabase(schedule)
    let { error } = await supabase.from("shift_schedules").upsert(dbSchedule)

    if (error && error.code === "42703") {
      console.warn(
        "[v0] shift_schedules dual-shift columns missing in Supabase; retrying save with legacy schema.",
      )
      // Use legacy columns but preserve dual shift data in legacy format if possible
      const legacyPayload = {
        id: dbSchedule.id,
        worker_id: dbSchedule.worker_id,
        schedule_date: dbSchedule.schedule_date,
        shift_start: dbSchedule.shift_start,
        shift_end: dbSchedule.shift_end,
        break_start: dbSchedule.break_start,
        break_end: dbSchedule.break_end,
        is_override: dbSchedule.is_override,
        override_reason: dbSchedule.override_reason,
        notes: dbSchedule.notes,
      }
      const fallback = await supabase.from("shift_schedules").upsert(legacyPayload)
      error = fallback.error

      if (!error) {
        console.log("[v0] ⚠️ Shift schedule saved with legacy schema only - dual shift features may be limited")
      }
    }

    if (error) {
      console.error("[v0] Error saving shift schedule to Supabase:", error)
      throw new Error(`Failed to save shift schedule: ${error.message}`)
    }

    invalidateCache("shift_schedules")
    console.log("[v0] ✅ Shift schedule saved to Supabase:", schedule.id)

    // Also clear client-side storage cache to ensure consistency
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem("hermes-cache-shifts-v1")
      } catch (error) {
        console.warn("[v0] Failed to clear client-side shift cache:", error)
      }
    }

    return true
  } catch (error) {
    console.error("[v0] Exception saving shift schedule:", error)
    return false
  }
}

export async function deleteShiftScheduleFromSupabase(scheduleId: string): Promise<boolean> {
  try {
    const supabase = createClient()
    const { error } = await supabase.from("shift_schedules").delete().eq("id", scheduleId)

    if (error) {
      console.error("[v0] Error deleting shift schedule from Supabase:", error)
      throw new Error(`Failed to delete shift schedule: ${error.message}`)
    }

    invalidateCache("shift_schedules")
    console.log("[v0] ✅ Shift schedule deleted from Supabase:", scheduleId)

    // Also clear client-side storage cache to ensure consistency
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem("hermes-cache-shifts-v1")
      } catch (error) {
        console.warn("[v0] Failed to clear client-side shift cache:", error)
      }
    }

    return true
  } catch (error) {
    console.error("[v0] Exception deleting shift schedule:", error)
    return false
  }
}

export async function loadMaintenanceSchedulesFromSupabase(
  options: LoadOptions = {},
): Promise<MaintenanceSchedule[]> {
  const cached = getCachedValue<MaintenanceSchedule[]>("maintenance_schedules", options.forceRefresh)
  if (cached) {
    return cached
  }

  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("maintenance_schedules")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[v0] Error loading maintenance schedules from Supabase:", error)
      throw new Error(`Failed to load maintenance schedules: ${error.message}`)
    }

    const mapped = ((data ?? []) as DatabaseMaintenanceSchedule[]).map((dbSchedule) =>
      databaseToMaintenanceSchedule(dbSchedule),
    )
    setCachedValue("maintenance_schedules", mapped)

    console.log(`[v0] Loaded ${mapped.length} maintenance schedules from Supabase`)
    return mapped
  } catch (error) {
    console.error("[v0] Exception loading maintenance schedules:", error)
    return []
  }
}

export async function saveMaintenanceScheduleToSupabase(schedule: MaintenanceSchedule): Promise<boolean> {
  try {
    const supabase = createClient()
    const dbSchedule = maintenanceScheduleToDatabase(schedule)
    const { error } = await supabase.from("maintenance_schedules").upsert(dbSchedule)

    if (error) {
      console.error("[v0] Error saving maintenance schedule to Supabase:", error)
      throw new Error(`Failed to save maintenance schedule: ${error.message}`)
    }

    invalidateCache("maintenance_schedules")
    console.log("[v0] ✅ Maintenance schedule saved to Supabase:", schedule.id)
    return true
  } catch (error) {
    console.error("[v0] Exception saving maintenance schedule:", error)
    return false
  }
}

export async function deleteMaintenanceScheduleFromSupabase(scheduleId: string): Promise<boolean> {
  try {
    const supabase = createClient()
    const { error } = await supabase.from("maintenance_schedules").delete().eq("id", scheduleId)

    if (error) {
      console.error("[v0] Error deleting maintenance schedule from Supabase:", error)
      throw new Error(`Failed to delete maintenance schedule: ${error.message}`)
    }

    invalidateCache("maintenance_schedules", "maintenance_tasks")
    console.log("[v0] ✅ Maintenance schedule deleted from Supabase:", scheduleId)
    return true
  } catch (error) {
    console.error("[v0] Exception deleting maintenance schedule:", error)
    return false
  }
}

export async function loadMaintenanceTasksFromSupabase(options: LoadOptions = {}): Promise<MaintenanceTask[]> {
  const cached = getCachedValue<MaintenanceTask[]>("maintenance_tasks", options.forceRefresh)
  if (cached) {
    return cached
  }

  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("maintenance_tasks")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[v0] Error loading maintenance tasks from Supabase:", error)
      throw new Error(`Failed to load maintenance tasks: ${error.message}`)
    }

    const mapped = (data || []).map(databaseToMaintenanceTask)
    setCachedValue("maintenance_tasks", mapped)

    console.log(`[v0] Loaded ${mapped.length} maintenance tasks from Supabase`)
    return mapped
  } catch (error) {
    console.error("[v0] Exception loading maintenance tasks:", error)
    return []
  }
}

export async function saveMaintenanceTaskToSupabase(task: MaintenanceTask): Promise<boolean> {
  try {
    const supabase = createClient()
    const dbTask = maintenanceTaskToDatabase(task)
    const { error } = await supabase.from("maintenance_tasks").upsert(dbTask)

    if (error) {
      console.error("[v0] Error saving maintenance task to Supabase:", error)
      throw new Error(`Failed to save maintenance task: ${error.message}`)
    }

    invalidateCache("maintenance_tasks")
    console.log("[v0] ✅ Maintenance task saved to Supabase:", task.id)
    return true
  } catch (error) {
    console.error("[v0] Exception saving maintenance task:", error)
    return false
  }
}

interface MaintenanceScheduleMetadata {
  version?: number
  label?: string
  task_type?: string
  area?: string
  frequency?: string
  auto_reset?: boolean
  active?: boolean
  created_at?: {
    client?: string | null
    server?: string | null
  }
  last_completed?: string | null
  next_due?: string | null
  frequency_weeks?: number | null
  day_range_start?: number | null
  day_range_end?: number | null
  created_by?: string | null
  updated_at?: string | null
}

function isMaintenanceTaskTypeValue(value: unknown): value is MaintenanceTaskType {
  return typeof value === "string" && MAINTENANCE_TASK_TYPES.includes(value as MaintenanceTaskType)
}

function isMaintenanceAreaValue(value: unknown): value is MaintenanceArea {
  return typeof value === "string" && MAINTENANCE_AREAS.includes(value as MaintenanceArea)
}

function isScheduleFrequencyValue(value: unknown): value is ScheduleFrequency {
  return typeof value === "string" && MAINTENANCE_FREQUENCIES.includes(value as ScheduleFrequency)
}

function sanitizeIsoDate(value?: string | null): string | null {
  if (!value) {
    return null
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date.toISOString()
}

function toDualTimestampFromParts(client?: string | null, server?: string | null) {
  const serverIso = sanitizeIsoDate(server) ?? new Date().toISOString()
  const clientIso = sanitizeIsoDate(client) ?? serverIso
  return { client: clientIso, server: serverIso }
}

function buildScheduleLabel(schedule: MaintenanceSchedule): string {
  const taskLabel = TASK_TYPE_LABELS[schedule.task_type] ?? schedule.task_type
  const areaLabel = AREA_LABELS[schedule.area] ?? schedule.area
  return `${taskLabel} • ${areaLabel}`
}

function parseMaintenanceScheduleMetadata(raw: unknown): MaintenanceScheduleMetadata {
  if (typeof raw !== "string") {
    return {}
  }

  const trimmed = raw.trim()
  if (!trimmed) {
    return {}
  }

  const firstChar = trimmed[0]
  if (firstChar !== "{" && firstChar !== "[") {
    return { label: trimmed }
  }

  try {
    const parsed = JSON.parse(trimmed)
    if (parsed && typeof parsed === "object") {
      return parsed as MaintenanceScheduleMetadata
    }
  } catch (error) {
    console.warn("[v0] maintenance schedule metadata parse failed, using fallback label:", error)
  }

  return { label: trimmed }
}

function maintenanceScheduleToDatabase(schedule: MaintenanceSchedule) {
  if (!isValidUuid(schedule.id)) {
    throw new Error(`Maintenance schedule id must be a UUID. Received: ${schedule.id}`)
  }

  const frequency = isScheduleFrequencyValue(schedule.frequency) ? schedule.frequency : "monthly"
  const dbFrequencyValue = frequency === "custom" ? "monthly" : frequency
  const timestamp = toDualTimestampFromParts(schedule.created_at?.client, schedule.created_at?.server)
  const lastCompleted = sanitizeIsoDate(schedule.last_completed)
  const nextDue = sanitizeIsoDate(schedule.next_due)
  const updatedAt = sanitizeIsoDate(schedule.updated_at)

  const metadata: MaintenanceScheduleMetadata = {
    version: typeof schedule.metadata_version === "number" ? schedule.metadata_version : 1,
    label: schedule.schedule_name ?? buildScheduleLabel(schedule),
    task_type: schedule.task_type,
    area: schedule.area,
    frequency,
    auto_reset: schedule.auto_reset,
    active: schedule.active,
    created_at: timestamp,
    last_completed: lastCompleted,
    next_due: nextDue,
    frequency_weeks: typeof schedule.frequency_weeks === "number" ? schedule.frequency_weeks : null,
    day_range_start: typeof schedule.day_range_start === "number" ? schedule.day_range_start : null,
    day_range_end: typeof schedule.day_range_end === "number" ? schedule.day_range_end : null,
    created_by: schedule.created_by ?? null,
    updated_at: updatedAt,
  }

  return {
    id: schedule.id,
    schedule_name: JSON.stringify(metadata),
    area: schedule.area,
    frequency: dbFrequencyValue,
    auto_reset: schedule.auto_reset,
    last_completed: lastCompleted,
    next_due: nextDue,
    created_at: timestamp.server,
  }
}

function databaseToMaintenanceSchedule(dbSchedule: DatabaseMaintenanceSchedule): MaintenanceSchedule {
  const metadata = parseMaintenanceScheduleMetadata(dbSchedule.schedule_name)

  const area = isMaintenanceAreaValue(metadata.area)
    ? metadata.area
    : isMaintenanceAreaValue(dbSchedule.area)
      ? (dbSchedule.area as MaintenanceArea)
      : "both"

  const frequency = isScheduleFrequencyValue(metadata.frequency)
    ? metadata.frequency
    : isScheduleFrequencyValue(dbSchedule.frequency)
      ? (dbSchedule.frequency as ScheduleFrequency)
      : "monthly"

  const candidateTaskType = metadata.task_type ?? dbSchedule.task_type
  const taskType = isMaintenanceTaskTypeValue(candidateTaskType) ? candidateTaskType : "ac_indoor"

  const active =
    typeof metadata.active === "boolean"
      ? metadata.active
      : typeof dbSchedule.active === "boolean"
        ? dbSchedule.active
        : true

  const autoReset =
    typeof metadata.auto_reset === "boolean"
      ? metadata.auto_reset
      : typeof dbSchedule.auto_reset === "boolean"
        ? dbSchedule.auto_reset
        : Boolean(dbSchedule.auto_reset)

  const createdAtMeta = metadata.created_at ?? {}
  const createdAtServer = sanitizeIsoDate(createdAtMeta.server ?? dbSchedule.created_at) ?? new Date().toISOString()
  const createdAtClient = sanitizeIsoDate(createdAtMeta.client) ?? createdAtServer

  const lastCompleted = sanitizeIsoDate(dbSchedule.last_completed ?? metadata.last_completed)
  const nextDue = sanitizeIsoDate(dbSchedule.next_due ?? metadata.next_due)

  const frequencyWeeks =
    typeof metadata.frequency_weeks === "number"
      ? metadata.frequency_weeks
      : typeof dbSchedule.frequency_weeks === "number"
        ? dbSchedule.frequency_weeks
        : null

  const dayRangeStart =
    typeof metadata.day_range_start === "number"
      ? metadata.day_range_start
      : typeof dbSchedule.day_range_start === "number"
        ? dbSchedule.day_range_start
        : null

  const dayRangeEnd =
    typeof metadata.day_range_end === "number"
      ? metadata.day_range_end
      : typeof dbSchedule.day_range_end === "number"
        ? dbSchedule.day_range_end
        : null

  const scheduleLabel =
    typeof metadata.label === "string" && metadata.label.trim().length > 0
      ? metadata.label
      : typeof dbSchedule.schedule_name === "string"
        ? dbSchedule.schedule_name
        : undefined

  const createdBy =
    typeof metadata.created_by === "string"
      ? metadata.created_by
      : typeof dbSchedule.created_by === "string"
        ? dbSchedule.created_by
        : null

  const updatedAt = sanitizeIsoDate(metadata.updated_at ?? dbSchedule.updated_at)
  const metadataVersion = typeof metadata.version === "number" ? metadata.version : undefined

  return {
    id: dbSchedule.id,
    task_type: taskType,
    area,
    frequency,
    auto_reset: Boolean(autoReset),
    active,
    created_at: {
      client: createdAtClient,
      server: createdAtServer,
    },
    schedule_name: scheduleLabel,
    last_completed: lastCompleted ?? undefined,
    next_due: nextDue ?? undefined,
    frequency_weeks: frequencyWeeks ?? undefined,
    day_range_start: dayRangeStart ?? undefined,
    day_range_end: dayRangeEnd ?? undefined,
    created_by: createdBy ?? undefined,
    updated_at: updatedAt ?? undefined,
    metadata_version: metadataVersion,
  }
}

function maintenanceTaskToDatabase(task: MaintenanceTask): any {
  if (!isValidUuid(task.id)) {
    throw new Error(`Maintenance task id must be a UUID. Received: ${task.id}`)
  }

  const scheduleId = isValidUuid(task.schedule_id) ? task.schedule_id : null
  const assignedTo = isValidUuid(task.assigned_to) ? task.assigned_to : null
  const startedAt = task.started_at ? new Date(task.started_at).toISOString() : null
  const completedAt = task.completed_at ? new Date(task.completed_at).toISOString() : null
  const timerDuration =
    typeof task.timer_duration === "number" ? Math.max(Math.round(task.timer_duration), 0) : null
  const photosPayload =
    task.categorized_photos && Object.keys(task.categorized_photos).length > 0
      ? task.categorized_photos
      : Array.isArray(task.photos)
        ? task.photos
        : []
  const sanitizedNotes =
    typeof task.notes === "string" && task.notes.trim().length > 0 ? task.notes.trim() : null

  return {
    id: task.id,
    schedule_id: scheduleId,
    task_type: task.task_type,
    room_number: task.room_number || null,
    ac_location: task.location,
    status: normalizeMaintenanceStatus(task.status),
    assigned_to: assignedTo,
    started_at: startedAt,
    completed_at: completedAt,
    timer_duration: timerDuration,
    photos: photosPayload,
    notes: sanitizedNotes,
    period_month: task.period_month ?? null,
    period_year: task.period_year ?? null,
    created_at: task.created_at ? new Date(task.created_at).toISOString() : new Date().toISOString(),
  }
}

function databaseToMaintenanceTask(dbTask: any): MaintenanceTask {
  const startedAt =
    typeof dbTask.started_at === "string"
      ? dbTask.started_at
      : dbTask.started_at?.client ?? dbTask.started_at?.server ?? undefined

  const completedAt =
    typeof dbTask.completed_at === "string"
      ? dbTask.completed_at
      : dbTask.completed_at?.client ?? dbTask.completed_at?.server ?? undefined

  const rawTimerDuration =
    typeof dbTask.timer_duration === "number"
      ? dbTask.timer_duration
      : typeof dbTask.timer_duration?.client === "number"
        ? dbTask.timer_duration.client
        : undefined
  const timerDuration = typeof rawTimerDuration === "number" ? Math.max(rawTimerDuration, 0) : undefined

  const photos = Array.isArray(dbTask.photos) ? dbTask.photos : undefined
  const categorizedPhotos =
    dbTask.photos && !Array.isArray(dbTask.photos) && typeof dbTask.photos === "object"
      ? dbTask.photos
      : undefined
  const notes = typeof dbTask.notes === "string" ? dbTask.notes : undefined

  return {
    id: dbTask.id,
    schedule_id: dbTask.schedule_id,
    task_type: dbTask.task_type,
    room_number: dbTask.room_number || undefined,
    location: dbTask.ac_location || "",
    description: `${dbTask.task_type} - ${dbTask.room_number || "N/A"}`,
    status: dbTask.status,
    assigned_to: dbTask.assigned_to || undefined,
    started_at: startedAt,
    completed_at: completedAt,
    timer_duration: timerDuration,
    photos: photos ?? [],
    categorized_photos: categorizedPhotos,
    period_month: dbTask.period_month,
    period_year: dbTask.period_year,
    created_at: dbTask.created_at,
    notes,
  }
}
