import { createClient } from "@/lib/supabase/client"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Task, User, ShiftSchedule, CategorizedPhotos } from "./types"
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
  type DatabaseMaintenanceTask,
  type DatabaseShiftSchedule,
  type Json,
} from "./database-types"

const CACHE_TTL_MS = 30_000
const TASK_FETCH_LIMIT = 1000
const TASK_FETCH_LIMIT_WITH_PHOTOS = 80

const TASK_SUMMARY_COLUMNS = [
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
  "custom_task_recurring_days",
  "department",
] as const

type DatabaseTaskSummaryBase = Pick<
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
  | "custom_task_recurring_days"
  | "department"
>

type DatabaseTaskSummary = DatabaseTaskSummaryBase & {
  categorized_photos?: DatabaseTask["categorized_photos"]
}

type DatabaseTaskPhotosRow = Pick<DatabaseTask, "id" | "categorized_photos" | "updated_at">

const STATUS_APP_TO_DB_MAP: Record<Task["status"], DatabaseTask["status"]> = {
  PENDING: "pending",
  IN_PROGRESS: "in_progress",
  PAUSED: "paused",
  COMPLETED: "completed",
  VERIFIED: "verified",
  REJECTED: "rejected",
}

const DEFAULT_HISTORY_LIMIT = 120

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

export interface LoadOptions {
  forceRefresh?: boolean
  includePhotos?: boolean
}

function parseCategorizedPhotosJson(value: Json): CategorizedPhotos | null {
  if (!value) {
    return null
  }

  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value
    if (parsed && typeof parsed === "object") {
      return parsed as CategorizedPhotos
    }
  } catch (error) {
    console.warn("[supabase] categorized photo payload could not be parsed", error)
  }

  return null
}

function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
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

type TimestampRecord = { client?: string | null; server?: string | null }
type TimerRecord = { client?: number | null; server?: number | null }
type TimestampValue = string | null | TimestampRecord
type TimerValue = number | null | TimerRecord

type MaintenanceTaskRow = Omit<DatabaseMaintenanceTask, "started_at" | "completed_at" | "timer_duration" | "photos"> & {
  started_at: TimestampValue
  completed_at: TimestampValue
  timer_duration: TimerValue
  photos: Json
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isTimestampRecord(value: unknown): value is TimestampRecord {
  if (!isRecord(value)) {
    return false
  }

  const client = value.client
  const server = value.server

  return (typeof client === "string" && client.length > 0) || (typeof server === "string" && server.length > 0)
}

function extractTimestamp(value: TimestampValue): string | undefined {
  if (typeof value === "string") {
    return value
  }

  if (value === null) {
    return undefined
  }

  if (isTimestampRecord(value)) {
    if (typeof value.server === "string" && value.server.length > 0) {
      return value.server
    }

    if (typeof value.client === "string" && value.client.length > 0) {
      return value.client
    }
  }

  return undefined
}

function isTimerRecord(value: unknown): value is TimerRecord {
  if (!isRecord(value)) {
    return false
  }

  return typeof value.client === "number" || typeof value.server === "number"
}

function extractTimerDuration(value: TimerValue): number | undefined {
  if (typeof value === "number") {
    return value
  }

  if (isTimerRecord(value)) {
    if (typeof value.client === "number") {
      return value.client
    }

    if (typeof value.server === "number") {
      return value.server
    }
  }

  return undefined
}

function extractStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined
  }

  return value.filter((item): item is string => typeof item === "string")
}

function buildCategorizedPhotos(value: Record<string, unknown>): MaintenanceTask["categorized_photos"] | undefined {
  const before = extractStringArray(value["before_photos"])
  const during = extractStringArray(value["during_photos"])
  const after = extractStringArray(value["after_photos"])

  if (!before && !during && !after) {
    return undefined
  }

  const categorized: MaintenanceTask["categorized_photos"] = {}

  if (before && before.length > 0) {
    categorized.before_photos = before
  }

  if (during && during.length > 0) {
    categorized.during_photos = during
  }

  if (after && after.length > 0) {
    categorized.after_photos = after
  }

  return categorized
}

function toMaintenanceTaskType(value: string): MaintenanceTaskType {
  return MAINTENANCE_TASK_TYPES.includes(value as MaintenanceTaskType) ? (value as MaintenanceTaskType) : "all"
}

export async function loadTasksFromSupabase(
  options: LoadOptions = {},
  supabaseOverride?: SupabaseClient,
): Promise<Task[]> {
  const shouldUseCache = !options.includePhotos
  if (shouldUseCache) {
    const cached = getCachedValue<Task[]>("tasks", options.forceRefresh)
    if (cached) {
      return cached
    }
  }

  try {
    const supabase = supabaseOverride ?? createClient()

    const limit = options.includePhotos ? TASK_FETCH_LIMIT_WITH_PHOTOS : TASK_FETCH_LIMIT

    const { data, error } = await supabase
      .from("tasks")
      .select(TASK_SUMMARY_COLUMNS.join(","))
      .order("updated_at", { ascending: false })
      .limit(limit)

    if (error) {
      console.error("[v0] Error loading tasks from Supabase:", error)
      throw new Error(`Failed to load tasks: ${error.message}`)
    }

    const rows = (data ?? []) as DatabaseTaskSummary[]
    let categorizedPhotosMap: Map<string, DatabaseTask["categorized_photos"]> | null = null

    if (options.includePhotos && rows.length > 0) {
      const prioritizedIds = rows
        .filter((row) => {
          if (!row) return false
          const requiresVerification = row.requires_verification === true
          const status = typeof row.status === "string" ? row.status.toLowerCase() : ""
          const inProgressLike = status === "in_progress" || status === "paused"
          const completed = status === "completed" || status === "verified"
          return requiresVerification || inProgressLike || completed
        })
        .map((row) => row.id)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
        .slice(0, 20) // Reduced from 40 to 20 to avoid timeout

      if (prioritizedIds.length > 0) {
        // Add timeout to abort slow queries faster
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 3000) // 3 second timeout

        try {
          const { data: photoRows, error: photosError } = await supabase
            .from("tasks")
            .select("id,categorized_photos")
            .in("id", prioritizedIds)
            .limit(prioritizedIds.length)
            .abortSignal(controller.signal)

          clearTimeout(timeoutId)

          if (photosError) {
            console.warn("[supabase] categorized photo fetch failed; continuing without photos", photosError)
          } else if (photoRows) {
            categorizedPhotosMap = new Map<string, DatabaseTask["categorized_photos"]>()
            for (const row of photoRows as Array<{ id: string; categorized_photos: DatabaseTask["categorized_photos"] }>) {
              if (row?.id) {
                categorizedPhotosMap.set(row.id, row.categorized_photos ?? null)
              }
            }
          }
        } catch (error) {
          clearTimeout(timeoutId)
          if ((error as Error).name === 'AbortError') {
            console.warn("[supabase] categorized photo fetch aborted due to timeout; continuing without photos")
          } else {
            console.warn("[supabase] categorized photo fetch failed; continuing without photos", error)
          }
        }
      }
    }

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
        estimated_duration: row.estimated_duration ?? null,
        actual_duration: row.actual_duration ?? null,
        categorized_photos: categorizedPhotosMap?.get(row.id) ?? null,
        worker_remarks: row.worker_remarks ?? null,
        supervisor_remarks: row.supervisor_remarks ?? null,
        quality_rating: null,
        requires_verification: row.requires_verification ?? false,
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
        custom_task_recurring_days: row.custom_task_recurring_days ?? null,
        department: row.department ?? null,
      } as DatabaseTask),
    )
    setCachedValue("tasks", mapped)

    return mapped
  } catch (error) {
    logSupabaseFailure("tasks", error)
    const cached = cacheStore.tasks as CacheEntry<Task[]> | undefined
    if (cached) {
      return cached.data as Task[]
    }

    throw error instanceof Error ? error : new Error(String(error))
  }
}

export interface TaskHistoryQueryOptions extends LoadOptions {
  status: Task["status"]
  limit?: number
  before?: string | null
  pendingVerificationOnly?: boolean
}

export async function loadTaskHistoryChunk(
  options: TaskHistoryQueryOptions,
  supabaseOverride?: SupabaseClient,
): Promise<Task[]> {
  const supabase = supabaseOverride ?? createClient()
  const limitCandidate = typeof options.limit === "number" ? options.limit : DEFAULT_HISTORY_LIMIT
  const limit = Math.min(Math.max(limitCandidate, 1), TASK_FETCH_LIMIT)
  const status = STATUS_APP_TO_DB_MAP[options.status]

  let query = supabase
    .from("tasks")
    .select(TASK_SUMMARY_COLUMNS.join(","))
    .eq("status", status)
    .order("updated_at", { ascending: false })
    .limit(limit)

  if (options.before) {
    query = query.lt("updated_at", options.before)
  }

  const { data, error } = await query

  if (error) {
    console.error("[v0] Error loading historical tasks from Supabase:", error)
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
      estimated_duration: row.estimated_duration ?? null,
      actual_duration: row.actual_duration ?? null,
      categorized_photos: null,
      worker_remarks: row.worker_remarks ?? null,
      supervisor_remarks: row.supervisor_remarks ?? null,
      quality_rating: null,
      requires_verification: row.requires_verification ?? false,
      audit_log: [],
      pause_history: [],
      photo_requirements: row.photo_requirements ?? null,
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
      custom_task_recurring_days: row.custom_task_recurring_days ?? null,
      department: row.department ?? null,
    } as DatabaseTask),
  )

  if (options.status === "COMPLETED" && options.pendingVerificationOnly) {
    return mapped.filter((task) => !task.supervisor_remark || !task.supervisor_remark.trim())
  }

  return mapped
}

export async function loadTaskCategorizedPhotos(
  taskId: string,
  supabaseOverride?: SupabaseClient,
): Promise<{ photos: CategorizedPhotos | null; serverUpdatedAt: string | null } | null> {
  if (!isValidUuid(taskId)) {
    return null
  }

  const supabase = supabaseOverride ?? createClient()

  try {
    const { data, error } = await supabase
      .from("tasks")
      .select("id,categorized_photos,updated_at")
      .eq("id", taskId)
      .single()

    if (error) {
      console.warn("[supabase] Failed to load categorized photos", error)
      return null
    }

    if (!data) {
      return null
    }

    const row = data as DatabaseTaskPhotosRow
    const photos = parseCategorizedPhotosJson(row.categorized_photos ?? null)
    const updatedAt = typeof row.updated_at === "string" ? row.updated_at : null

    return {
      photos,
      serverUpdatedAt: updatedAt,
    }
  } catch (error) {
    console.warn("[supabase] Unexpected error loading categorized photos", error)
    return null
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

    const { error } = await supabase.from("tasks").upsert(dbTask)

    if (error) {
      console.error("[v0] Error saving task to Supabase:", error)
      throw new Error(`Failed to save task: ${error.message}`)
    }

    invalidateCache("tasks")
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

      // If dual shift columns are missing but a long break exists, infer settings.
      if (
        !enriched.is_dual_shift &&
        !enriched.has_shift_2 &&
        enriched.shift_start &&
        enriched.shift_end &&
        enriched.break_start &&
        enriched.break_end
      ) {
        enriched.shift_1_start = enriched.shift_start
        enriched.shift_1_end = enriched.break_start
        enriched.shift_2_start = enriched.break_end
        enriched.shift_2_end = enriched.shift_end
        enriched.has_shift_2 = true
        enriched.is_dual_shift = true
      }

      return databaseShiftScheduleToApp(enriched)
    })

    setCachedValue("shift_schedules", mapped)
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
    }

    if (error) {
      console.error("[v0] Error saving shift schedule to Supabase:", error)
      throw new Error(`Failed to save shift schedule: ${error.message}`)
    }

    invalidateCache("shift_schedules")
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
    return true
  } catch (error) {
    console.error("[v0] Exception deleting maintenance schedule:", error)
    return false
  }
}

export async function regenerateMaintenanceSchedules(options: {
  minCompletionRatio?: number
} = {}): Promise<MaintenanceScheduleRegenerationResult[]> {
  try {
    const supabase = createClient()
    const rpcArgs =
      typeof options.minCompletionRatio === "number"
        ? { min_completion_ratio: options.minCompletionRatio }
        : undefined

    const { data, error } = rpcArgs
      ? await supabase.rpc("regenerate_maintenance_schedules", rpcArgs)
      : await supabase.rpc("regenerate_maintenance_schedules")

    if (error) {
      console.error("[v0] Error triggering maintenance regeneration via Supabase:", error)
      throw new Error(`Failed to regenerate maintenance schedules: ${error.message}`)
    }

    invalidateCache("maintenance_tasks", "maintenance_schedules")

    const results = Array.isArray(data) ? (data as MaintenanceScheduleRegenerationResult[]) : []
    return results
  } catch (error) {
    console.error("[v0] Exception regenerating maintenance schedules:", error)
    return []
  }
}

/**
 * Fetch recurring task instances linked to a parent recurring task
 * Shows the chain of auto-generated recurring tasks
 */
export async function getRecurringTaskInstances(
  taskId: string,
  options: LoadOptions = {}
): Promise<RecurringTaskInstance[]> {
  try {
    const supabase = createClient()

    // Get the task and all related instances via audit_log lineage
    const { data: instances, error } = await supabase
      .from("tasks")
      .select(
        `
        id,
        custom_task_name,
        custom_task_recurring_frequency,
        status,
        created_at,
        audit_log
      `
      )
      .or(`id.eq.${taskId},audit_log->>generated_from_task_id.eq.${taskId}`)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[v0] Error fetching recurring task instances:", error)
      return []
    }

    if (!Array.isArray(instances)) {
      return []
    }

    // Map to RecurringTaskInstance format
    return instances.map((row: any) => ({
      id: row.id,
      parent_id: row.audit_log?.generated_from_task_id || null,
      custom_task_name: row.custom_task_name,
      custom_task_recurring_frequency: row.custom_task_recurring_frequency,
      status: row.status,
      created_at: row.created_at,
    }))
  } catch (error) {
    console.error("[v0] Exception fetching recurring task instances:", error)
    return []
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

    const rows = Array.isArray(data) ? (data as MaintenanceTaskRow[]) : []
    console.log(`[v0] Loaded ${rows.length} maintenance tasks from Supabase`)
    const mapped = rows.map(databaseToMaintenanceTask)
    setCachedValue("maintenance_tasks", mapped)

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
    return true
  } catch (error) {
    console.error("[v0] Exception saving maintenance task:", error)
    return false
  }
}

export async function deleteMaintenanceTasksByScheduleId(scheduleId: string): Promise<boolean> {
  try {
    const supabase = createClient()
    const { error } = await supabase
      .from("maintenance_tasks")
      .delete()
      .eq("schedule_id", scheduleId)

    if (error) {
      console.warn("[v0] Error deleting maintenance tasks by schedule_id from Supabase:", error.message)
      return false
    }

    invalidateCache("maintenance_tasks")
    console.log(`[v0] Deleted maintenance tasks for schedule: ${scheduleId}`)
    return true
  } catch (error) {
    console.warn("[v0] Exception deleting maintenance tasks by schedule_id:", error)
    return false
  }
}

export async function deleteOrphanedMaintenanceTasks(): Promise<number> {
  try {
    const supabase = createClient()
    
    // Get all valid schedule IDs
    const { data: schedules, error: scheduleError } = await supabase
      .from("maintenance_schedules")
      .select("id")
    
    if (scheduleError) {
      console.warn("[v0] Error fetching schedules for orphan cleanup:", scheduleError.message)
      return 0
    }
    
    const validScheduleIds = new Set((schedules || []).map(s => s.id))
    
    // Get all maintenance tasks
    const { data: tasks, error: taskError } = await supabase
      .from("maintenance_tasks")
      .select("id, schedule_id")
    
    if (taskError) {
      console.warn("[v0] Error fetching tasks for orphan cleanup:", taskError.message)
      return 0
    }
    
    // Find orphaned tasks (tasks whose schedule_id doesn't exist or is null)
    const orphanedTaskIds = (tasks || [])
      .filter(t => !t.schedule_id || !validScheduleIds.has(t.schedule_id))
      .map(t => t.id)
    
    if (orphanedTaskIds.length === 0) {
      console.log("[v0] No orphaned maintenance tasks found")
      return 0
    }
    
    // Delete orphaned tasks in batches to avoid query size limits
    const batchSize = 100
    let totalDeleted = 0
    
    for (let i = 0; i < orphanedTaskIds.length; i += batchSize) {
      const batch = orphanedTaskIds.slice(i, i + batchSize)
      const { error: deleteError } = await supabase
        .from("maintenance_tasks")
        .delete()
        .in("id", batch)
      
      if (deleteError) {
        console.warn("[v0] Error deleting orphaned tasks batch:", deleteError.message)
        continue
      }
      totalDeleted += batch.length
    }
    
    if (totalDeleted > 0) {
      invalidateCache("maintenance_tasks")
      console.log(`[v0] Deleted ${totalDeleted} orphaned maintenance tasks`)
    }
    return totalDeleted
  } catch (error) {
    console.warn("[v0] Exception cleaning up orphaned maintenance tasks:", error)
    return 0
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

export interface MaintenanceScheduleRegenerationResult {
  schedule_id: string
  generated_tasks: number
  period_year: number
  period_month: number
  next_due: string | null
}

export interface RecurringTaskInstance {
  id: string
  parent_id: string | null
  custom_task_name: string
  custom_task_recurring_frequency: "daily" | "weekly" | "biweekly" | "monthly" | null
  status: "pending" | "completed" | "verified"
  created_at: string
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
    assigned_to: schedule.assigned_to,
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
    assigned_to: dbSchedule.assigned_to,
  }
}

function maintenanceTaskToDatabase(task: MaintenanceTask): DatabaseMaintenanceTask {
  if (!isValidUuid(task.id)) {
    throw new Error(`Maintenance task id must be a UUID. Received: ${task.id}`)
  }

  const scheduleId = isValidUuid(task.schedule_id) ? task.schedule_id : null
  const assignedTo = isValidUuid(task.assigned_to) ? task.assigned_to : null
  const startedAt = task.started_at ? new Date(task.started_at).toISOString() : null
  const completedAt = task.completed_at ? new Date(task.completed_at).toISOString() : null
  const timerDuration =
    typeof task.timer_duration === "number" ? Math.max(Math.round(task.timer_duration), 0) : null
  const photosPayload: Json =
    task.categorized_photos && Object.keys(task.categorized_photos).length > 0
      ? (task.categorized_photos as Json)
      : (task.photos as Json)
  const sanitizedNotes =
    typeof task.notes === "string" && task.notes.trim().length > 0 ? task.notes.trim() : null
  const createdAt = task.created_at ? new Date(task.created_at).toISOString() : new Date().toISOString()

  // For lift tasks, store lift_id in room_number field since there's no lift_id column
  const roomNumberValue = task.task_type === "lift" && task.lift_id 
    ? task.lift_id 
    : (task.room_number || null)

  return {
    id: task.id,
    schedule_id: scheduleId,
    task_type: task.task_type,
    room_number: roomNumberValue,
    status: normalizeMaintenanceStatus(task.status),
    assigned_to: assignedTo,
    ac_location: task.location,
    started_at: startedAt,
    completed_at: completedAt,
    timer_duration: timerDuration,
    photos: photosPayload,
    notes: sanitizedNotes,
    period_month: task.period_month ?? null,
    period_year: task.period_year ?? null,
    created_at: createdAt,
  }
}

function databaseToMaintenanceTask(dbTask: MaintenanceTaskRow): MaintenanceTask {
  const startedAt = extractTimestamp(dbTask.started_at)
  const completedAt = extractTimestamp(dbTask.completed_at)
  const rawTimerDuration = extractTimerDuration(dbTask.timer_duration)
  const timerDuration = typeof rawTimerDuration === "number" ? Math.max(rawTimerDuration, 0) : undefined

  const photosValue = dbTask.photos
  const photos = extractStringArray(photosValue) ?? []

  const categorizedPhotos =
    !Array.isArray(photosValue) && isRecord(photosValue)
      ? buildCategorizedPhotos(photosValue)
      : undefined

  const notes = typeof dbTask.notes === "string" && dbTask.notes.length > 0 ? dbTask.notes : undefined
  const assignedTo = typeof dbTask.assigned_to === "string" && dbTask.assigned_to.length > 0 ? dbTask.assigned_to : undefined
  const rawRoomNumber = typeof dbTask.room_number === "string" && dbTask.room_number.length > 0 ? dbTask.room_number : undefined
  const location = typeof dbTask.ac_location === "string" && dbTask.ac_location.length > 0 ? dbTask.ac_location : ""
  const status: MaintenanceTask["status"] = dbTask.status === "verified" ? "completed" : dbTask.status
  const scheduleId = typeof dbTask.schedule_id === "string" ? dbTask.schedule_id : ""
  const taskType = toMaintenanceTaskType(dbTask.task_type)
  
  // For lift tasks, the room_number field stores the lift_id
  const isLiftTask = taskType === "lift"
  const liftId = isLiftTask ? rawRoomNumber : undefined
  const roomNumber = isLiftTask ? undefined : rawRoomNumber
  
  // Get period from database or derive from created_at
  const createdDate = dbTask.created_at ? new Date(dbTask.created_at) : new Date()
  const periodMonth = typeof dbTask.period_month === "number" && dbTask.period_month > 0 
    ? dbTask.period_month 
    : (createdDate.getMonth() + 1)
  const periodYear = typeof dbTask.period_year === "number" && dbTask.period_year > 0 
    ? dbTask.period_year 
    : createdDate.getFullYear()

  return {
    id: dbTask.id,
    schedule_id: scheduleId,
    task_type: taskType,
    room_number: roomNumber,
    lift_id: liftId,
    location,
    description: isLiftTask ? `Lift Maintenance - ${liftId}` : `${taskType} - ${roomNumber ?? "N/A"}`,
    status,
    assigned_to: assignedTo,
    started_at: startedAt,
    completed_at: completedAt,
    timer_duration: timerDuration,
    photos,
    categorized_photos: categorizedPhotos,
    period_month: periodMonth,
    period_year: periodYear,
    created_at: dbTask.created_at,
    notes,
  }
}
