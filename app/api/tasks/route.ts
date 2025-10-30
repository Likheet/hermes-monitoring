import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { databaseTaskToApp, databaseUserToApp } from "@/lib/database-types"
import type { DatabaseUser } from "@/lib/database-types"
import { formatDateKeyForTimezone, isWorkerOnShiftWithSchedule } from "@/lib/shift-utils"
import type { SupabaseClient } from "@supabase/supabase-js"

const PRIORITY_APP_TO_DB: Record<string, "low" | "medium" | "high" | "urgent"> = {
  GUEST_REQUEST: "medium",
  TIME_SENSITIVE: "urgent",
  DAILY_TASK: "low",
  PREVENTIVE_MAINTENANCE: "high",
}

function toDualTimestamp() {
  const iso = new Date().toISOString()
  return { client: iso, server: iso }
}

function normalizePriority(priority: string | null | undefined) {
  if (!priority) return null

  const upper = priority.toUpperCase()
  if (upper in PRIORITY_APP_TO_DB) {
    return PRIORITY_APP_TO_DB[upper]
  }

  const lower = priority.toLowerCase()
  if (lower === "low" || lower === "medium" || lower === "high" || lower === "urgent") {
    return lower as "low" | "medium" | "high" | "urgent"
  }

  return null
}

// GET all tasks (filtered by user role)
export async function GET(request: Request) {
  try {
    const cookieStore = await cookies()
    const sessionUserId = cookieStore.get("session")?.value

    if (!sessionUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const statusParam = searchParams.get("status")
    const assignedToParam = searchParams.get("assigned_to")
    const limitParam = searchParams.get("limit")
    const offsetParam = searchParams.get("offset")

    const allowedStatuses = new Set(["pending", "in_progress", "paused", "completed", "verified", "rejected"])
    const normalizedStatus = statusParam ? statusParam.toLowerCase() : null
    const statusFilter = normalizedStatus && allowedStatuses.has(normalizedStatus) ? normalizedStatus : null

    const limit = Number.isFinite(Number(limitParam)) ? Math.max(parseInt(String(limitParam), 10), 0) : 200
    const offset = Number.isFinite(Number(offsetParam)) ? Math.max(parseInt(String(offsetParam), 10), 0) : 0

    const { data: tasks, error } = await supabase.rpc("list_tasks_summary", {
      status_filter: statusFilter,
      assigned_to_filter: assignedToParam || null,
      limit_count: limit,
      offset_count: offset,
    })

    if (error) {
      console.error("Tasks fetch error:", error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const appTasks = tasks.map(databaseTaskToApp)

    return NextResponse.json({ tasks: appTasks }, { status: 200, headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=60" } })
  } catch (error) {
    console.error("Tasks GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

interface CreateTaskDirectParams {
  supabase: SupabaseClient
  sessionUserId: string
  task_type: string
  normalizedPriority: "low" | "medium" | "high" | "urgent"
  assigned_to_user_id: string | null | undefined
  assigned_at: { client: string; server: string }
  expected_duration_minutes: unknown
  photo_documentation_required: unknown
  photo_required: unknown
  photoRequirementsPayload: unknown
  room_number: string | null | undefined
  categorizedPhotosPayload: Record<string, unknown>
  is_custom_task: unknown
  custom_task_name: unknown
  custom_task_category: unknown
  custom_task_priority: unknown
  custom_task_photo_required: unknown
  custom_task_photo_count: unknown
  custom_task_is_recurring: unknown
  custom_task_recurring_frequency: unknown
  custom_task_requires_specific_time: unknown
  custom_task_recurring_time: unknown
  worker_remark: string | null
  supervisor_remark: string | null
}

async function createTaskDirectly({
  supabase,
  sessionUserId,
  task_type,
  normalizedPriority,
  assigned_to_user_id,
  assigned_at,
  expected_duration_minutes,
  photo_documentation_required,
  photo_required,
  photoRequirementsPayload,
  room_number,
  categorizedPhotosPayload,
  is_custom_task,
  custom_task_name,
  custom_task_category,
  custom_task_priority,
  custom_task_photo_required,
  custom_task_photo_count,
  custom_task_is_recurring,
  custom_task_recurring_frequency,
  custom_task_requires_specific_time,
  custom_task_recurring_time,
  worker_remark,
  supervisor_remark,
}: CreateTaskDirectParams) {
  const nowIso = new Date().toISOString()
  const statusValue = assigned_to_user_id ? "assigned" : "pending"

  const auditLogEntry = {
    timestamp: {
      client: nowIso,
      server: nowIso,
    },
    user_id: sessionUserId,
    action: "TASK_CREATED",
    old_status: null,
    new_status: statusValue.toUpperCase(),
    details: `Task created with type ${task_type}`,
  }

  const assignedTimestamp =
    assigned_at && typeof assigned_at === "object"
      ? assigned_at
      : { client: nowIso, server: nowIso }

  const parsedDuration =
    typeof expected_duration_minutes === "number"
      ? expected_duration_minutes
      : Number(expected_duration_minutes)
  const estimatedDuration =
    Number.isFinite(parsedDuration) && !Number.isNaN(parsedDuration) ? Math.max(Math.round(parsedDuration), 0) : null

  const categorizedPayload =
    categorizedPhotosPayload && typeof categorizedPhotosPayload === "object"
      ? categorizedPhotosPayload
      : { room_photos: [], proof_photos: [] }

  const photoRequirements =
    typeof photoRequirementsPayload === "object" && photoRequirementsPayload !== null
      ? photoRequirementsPayload
      : []

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      task_type,
      room_number: room_number ?? null,
      status: statusValue,
      priority_level: normalizedPriority,
      assigned_to_user_id: assigned_to_user_id ?? null,
      assigned_by_user_id: sessionUserId,
      assigned_at: assignedTimestamp,
      estimated_duration: estimatedDuration,
      requires_verification: Boolean(photo_documentation_required || photo_required),
      photo_requirements: photoRequirements,
      categorized_photos: categorizedPayload,
  worker_remarks: worker_remark ?? "",
  supervisor_remarks: supervisor_remark ?? "",
      audit_log: [auditLogEntry],
      is_custom_task: Boolean(is_custom_task),
      custom_task_name: custom_task_name ?? null,
      custom_task_category: custom_task_category ?? null,
      custom_task_priority: custom_task_priority ?? null,
      custom_task_photo_required:
        typeof custom_task_photo_required === "boolean" ? custom_task_photo_required : null,
      custom_task_photo_count:
        typeof custom_task_photo_count === "number" ? custom_task_photo_count : Number(custom_task_photo_count) || null,
      custom_task_is_recurring:
        typeof custom_task_is_recurring === "boolean" ? custom_task_is_recurring : null,
      custom_task_recurring_frequency: custom_task_recurring_frequency ?? null,
      custom_task_requires_specific_time:
        typeof custom_task_requires_specific_time === "boolean"
          ? custom_task_requires_specific_time
          : null,
      custom_task_recurring_time: custom_task_recurring_time ?? null,
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select()
    .single()

  if (error) {
    throw error
  }

  return data
}

// POST create new task
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    const sessionUserId = cookieStore.get("session")?.value

    if (!sessionUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = await createClient()
    const body = await request.json()

    const {
      task_type,
      priority_level,
      assigned_to_user_id,
      expected_duration_minutes,
      photo_required,
      room_number,
      photo_documentation_required,
      photo_categories,
      client_timezone_offset,
      // Custom task fields
      is_custom_task,
      custom_task_name,
      custom_task_category,
      custom_task_priority,
      custom_task_photo_required,
      custom_task_photo_count,
      custom_task_is_recurring,
      custom_task_recurring_frequency,
      custom_task_requires_specific_time,
      custom_task_recurring_time,
      worker_remark,
      supervisor_remark,
    } = body

    const workerRemark =
      typeof worker_remark === "string" && worker_remark.trim().length > 0
        ? worker_remark.trim()
        : null
    const supervisorRemark =
      typeof supervisor_remark === "string" && supervisor_remark.trim().length > 0
        ? supervisor_remark.trim()
        : null

    const timezoneOffset =
      typeof client_timezone_offset === "number" && Number.isFinite(client_timezone_offset)
        ? client_timezone_offset
        : undefined

    // Validate assigned user availability (prevent assigning tasks to off-duty users)
    if (assigned_to_user_id) {
      // Optimized: Single query to get user with their shift schedules
      const todayStr = formatDateKeyForTimezone(new Date(), timezoneOffset)
      
      // First get the user
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("*")
        .eq("id", assigned_to_user_id)
        .single()

      if (userError || !userData) {
        console.error("Failed to load assigned user:", userError)
        return NextResponse.json({ error: "Assigned user not found" }, { status: 400 })
      }

      // Then get today's shift schedules for this user
      const { data: schedules } = await supabase
        .from("shift_schedules")
        .select("*")
        .eq("worker_id", assigned_to_user_id)
        .eq("schedule_date", todayStr)

      const appUser = databaseUserToApp(userData as DatabaseUser)
      const availability = isWorkerOnShiftWithSchedule(appUser, schedules || [], {
        timezoneOffsetMinutes: timezoneOffset,
      })

      if (availability.status === "OFF_DUTY" || availability.status === "SHIFT_BREAK") {
        return NextResponse.json({ error: "Cannot assign task while the staff member is unavailable" }, { status: 400 })
      }
    }

    const assigned_at = toDualTimestamp()
    const normalizedPriority = normalizePriority(priority_level) ?? "low"

    const categorizedPhotosPayload = {
      room_photos: [] as string[],
      proof_photos: [] as string[],
    }

    const photoRequirementsPayload = photo_documentation_required
      ? Array.isArray(photo_categories)
        ? photo_categories
        : []
      : photo_required
        ? {
            simple: {
              required: true,
              count: typeof body.photo_count === "number" ? body.photo_count : null,
            },
          }
        : []
    const rpcPayload = {
      task_type,
      priority_level_db: normalizedPriority,
      priority_level_app: priority_level ?? null,
      assigned_to: assigned_to_user_id ?? null,
      assigned_by: sessionUserId,
      assigned_at,
      expected_duration: typeof expected_duration_minutes === "number" ? expected_duration_minutes : null,
      requires_verification: Boolean(photo_documentation_required || photo_required),
      photo_requirements: photoRequirementsPayload,
      room_number: room_number ?? null,
      categorized_photos: categorizedPhotosPayload,
  worker_remarks: workerRemark ?? "",
  supervisor_remarks: supervisorRemark ?? "",
      // Custom task fields
      is_custom_task: Boolean(is_custom_task),
      custom_task_name: custom_task_name ?? null,
      custom_task_category: custom_task_category ?? null,
      custom_task_priority: custom_task_priority ?? null,
      custom_task_photo_required: custom_task_photo_required ?? null,
      custom_task_photo_count: custom_task_photo_count ?? null,
      custom_task_is_recurring: custom_task_is_recurring ?? null,
      custom_task_recurring_frequency: custom_task_recurring_frequency ?? null,
      custom_task_requires_specific_time: custom_task_requires_specific_time ?? null,
      custom_task_recurring_time: custom_task_recurring_time ?? null,
  }

    const { data: task, error: taskError } = await supabase.rpc("create_task_with_autopause", rpcPayload)

    if (taskError) {
      const missingFunction =
        typeof taskError.message === "string" && taskError.message.includes("create_task_with_autopause")

      if (missingFunction) {
        try {
          const fallbackTask = await createTaskDirectly({
            supabase,
            sessionUserId,
            task_type,
            normalizedPriority,
            assigned_to_user_id,
            assigned_at,
            expected_duration_minutes,
            photo_documentation_required,
            photo_required,
            photoRequirementsPayload,
            room_number,
            categorizedPhotosPayload,
            is_custom_task,
            custom_task_name,
            custom_task_category,
            custom_task_priority,
            custom_task_photo_required,
            custom_task_photo_count,
            custom_task_is_recurring,
            custom_task_recurring_frequency,
            custom_task_requires_specific_time,
            custom_task_recurring_time,
            worker_remark: workerRemark,
            supervisor_remark: supervisorRemark,
          })

          const appTask = databaseTaskToApp(fallbackTask)
          return NextResponse.json({ task: appTask }, { status: 201 })
        } catch (fallbackError) {
          console.error("Task creation fallback error:", fallbackError)
          return NextResponse.json(
            { error: "Task RPC missing and direct insert failed. Please contact an administrator." },
            { status: 500 },
          )
        }
      }

      console.error("Task creation error:", taskError)
      return NextResponse.json({ error: taskError.message }, { status: 400 })
    }

    if (!task) {
      console.error("Task creation error: RPC returned no data")
      return NextResponse.json({ error: "Failed to create task" }, { status: 400 })
    }

    const appTask = databaseTaskToApp(task)

    return NextResponse.json({ task: appTask }, { status: 201 })
  } catch (error) {
    console.error("Task POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
