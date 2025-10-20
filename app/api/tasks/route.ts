import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { databaseTaskToApp } from "@/lib/database-types"

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

function normalizeStatus(status: string) {
  const lower = status.toLowerCase()
  switch (lower) {
    case "pending":
    case "in_progress":
    case "paused":
    case "completed":
    case "verified":
    case "rejected":
      return lower
    default:
      return "pending"
  }
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
    const status = searchParams.get("status")
    const assignedTo = searchParams.get("assigned_to")

    let query = supabase.from("tasks").select("*")

    // Apply filters
    if (status) {
      query = query.eq("status", status)
    }
    if (assignedTo) {
      query = query.eq("assigned_to_user_id", assignedTo)
    }

    // Order by priority and created date
    query = query.order("created_at", { ascending: false })

    const { data: tasks, error } = await query

    if (error) {
      console.error("[v0] Tasks fetch error:", error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const appTasks = tasks.map(databaseTaskToApp)

    return NextResponse.json({ tasks: appTasks }, { status: 200 })
  } catch (error) {
    console.error("[v0] Tasks GET error:", error)
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
    } = body

    const assigned_at = toDualTimestamp()
    const normalizedPriority = normalizePriority(priority_level)
    const baseStatus = normalizeStatus("pending")

    const categorizedPhotosPayload = {
      room_photos: [] as string[],
      proof_photos: [] as string[],
    }

    const photoRequirementsPayload = photo_documentation_required
      ? photo_categories ?? []
      : photo_required
        ? {
            simple: {
              required: true,
              count: typeof body.photo_count === "number" ? body.photo_count : null,
            },
          }
        : null

    // Handle auto-pause for urgent guest requests
    if (priority_level === "GUEST_REQUEST" || normalizedPriority === "medium") {
      const { data: assignedWorker } = await supabase
        .from("users")
        .select("department")
        .eq("id", assigned_to_user_id)
        .single()

      if (assignedWorker && assignedWorker.department !== "housekeeping") {
        const { data: activeTasks } = await supabase
          .from("tasks")
          .select("*")
          .eq("assigned_to_user_id", assigned_to_user_id)
          .eq("status", normalizeStatus("IN_PROGRESS"))

        if (activeTasks && activeTasks.length > 0) {
          const activeTask = activeTasks[0]
          await supabase.from("tasks").update({ status: normalizeStatus("PAUSED") }).eq("id", activeTask.id)

          await supabase.from("pause_records").insert({
            task_id: activeTask.id,
            paused_at: toDualTimestamp(),
            reason: "Auto-paused for urgent guest request",
          })

          const auditLog = [
            {
              timestamp: toDualTimestamp(),
              user_id: sessionUserId,
              action: "AUTO_PAUSED",
              old_status: "IN_PROGRESS",
              new_status: "PAUSED",
              details: "Urgent guest request assigned",
            },
          ]

          await supabase.from("tasks").update({ audit_log: auditLog }).eq("id", activeTask.id)
        }
      }
    }

    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .insert({
        task_type,
        priority_level: normalizedPriority,
        status: baseStatus,
        assigned_to_user_id,
        assigned_by_user_id: sessionUserId,
        assigned_at,
  estimated_duration: typeof expected_duration_minutes === "number" ? expected_duration_minutes : null,
  requires_verification: Boolean(photo_documentation_required || photo_required),
  photo_requirements: photoRequirementsPayload,
        room_number: room_number ?? null,
        worker_remarks: "",
        supervisor_remarks: "",
        audit_log: [
          {
            timestamp: assigned_at,
            user_id: sessionUserId,
            action: "CREATED",
            old_status: null,
            new_status: "PENDING",
            details: `Task created with type ${task_type}`,
          },
        ],
        categorized_photos: categorizedPhotosPayload,
        pause_history: [],
      })
      .select()
      .single()

    if (taskError) {
      console.error("[v0] Task creation error:", taskError)
      return NextResponse.json({ error: taskError.message }, { status: 400 })
    }

    const appTask = databaseTaskToApp(task)

    return NextResponse.json({ task: appTask }, { status: 201 })
  } catch (error) {
    console.error("[v0] Task POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
