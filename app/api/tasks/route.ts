import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { databaseTaskToApp } from "@/lib/database-types"
import { formatDateKeyForTimezone, getWorkerShiftForDate, isWorkerOnShiftWithSchedule } from "@/lib/shift-utils"

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
    } = body

    const timezoneOffset =
      typeof client_timezone_offset === "number" && Number.isFinite(client_timezone_offset)
        ? client_timezone_offset
        : undefined

    // Validate assigned user availability (prevent assigning tasks to off-duty users)
    if (assigned_to_user_id) {
      // Load the user and today's shift schedules
      const { data: usersResult, error: usersError } = await supabase.from("users").select("*").eq("id", assigned_to_user_id).limit(1)
      if (usersError) {
        console.error("Failed to load assigned user:", usersError)
        return NextResponse.json({ error: "Failed to validate assignee" }, { status: 400 })
      }

      const user = (usersResult && usersResult[0]) ?? null
      if (!user) {
        return NextResponse.json({ error: "Assigned user not found" }, { status: 400 })
      }

      // Load shift schedules for today for that worker
      const todayStr = formatDateKeyForTimezone(new Date(), timezoneOffset)
      const { data: schedulesResult, error: schedulesError } = await supabase
        .from("shift_schedules")
        .select("*")
        .eq("worker_id", assigned_to_user_id)
        .eq("schedule_date", todayStr)

      if (schedulesError) {
        console.error("Failed to load shift schedules:", schedulesError)
        return NextResponse.json({ error: "Failed to validate assignee" }, { status: 400 })
      }

      const shiftSchedules = (schedulesResult ?? []) as any[]

      const availability = isWorkerOnShiftWithSchedule(
        {
          id: user.id,
          name: user.name,
          shift_start: user.shift_start,
          shift_end: user.shift_end,
          has_break: user.has_break,
          break_start: user.break_start,
          break_end: user.break_end,
        } as any,
        shiftSchedules,
        { timezoneOffsetMinutes: timezoneOffset },
      )

      if (availability.status === "OFF_DUTY") {
        return NextResponse.json({ error: "Cannot assign task to an off-duty staff member" }, { status: 400 })
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
    const { data: task, error: taskError } = await supabase.rpc("create_task_with_autopause", {
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
      worker_remarks: "",
      supervisor_remarks: "",
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
    })

    if (taskError) {
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
