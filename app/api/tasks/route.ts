import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { databaseTaskToApp } from "@/lib/database-types"

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

    const { task_type, priority_level, assigned_to_user_id, expected_duration_minutes, photo_required, room_number } =
      body

    const clientTime = new Date()
    const serverTime = new Date()

    const assigned_at = {
      client: clientTime.toISOString(),
      server: serverTime.toISOString(),
      validated: true,
    }

    // Handle auto-pause for urgent guest requests
    if (priority_level === "GUEST_REQUEST") {
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
          .eq("status", "IN_PROGRESS")

        if (activeTasks && activeTasks.length > 0) {
          const activeTask = activeTasks[0]
          await supabase.from("tasks").update({ status: "PAUSED" }).eq("id", activeTask.id)

          await supabase.from("pause_records").insert({
            task_id: activeTask.id,
            paused_at: { client: new Date().toISOString(), server: new Date().toISOString(), validated: true },
            reason: "Auto-paused for urgent guest request",
          })

          const auditLog = [
            {
              timestamp: new Date().toISOString(),
              user_id: sessionUserId,
              action: "AUTO_PAUSED",
              old_status: "IN_PROGRESS",
              new_status: "PAUSED",
              metadata: { reason: "Urgent guest request assigned" },
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
        priority_level,
        status: "PENDING",
        assigned_to_user_id,
        assigned_by_user_id: sessionUserId,
        assigned_at,
        expected_duration_minutes,
        photo_required: photo_required || false,
        room_number,
        worker_remark: "",
        supervisor_remark: "",
        audit_log: [
          {
            timestamp: new Date().toISOString(),
            user_id: sessionUserId,
            action: "CREATED",
            old_status: null,
            new_status: "PENDING",
            metadata: { task_type, priority_level },
          },
        ],
        categorized_photos: { before: [], during: [], after: [] },
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
