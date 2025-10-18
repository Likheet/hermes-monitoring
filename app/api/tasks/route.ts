import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// GET all tasks (filtered by user role)
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const assignedTo = searchParams.get("assigned_to")

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let query = supabase.from("tasks").select(`
      *,
      assigned_to:users!tasks_assigned_to_user_id_fkey(id, name, role, department),
      assigned_by:users!tasks_assigned_by_user_id_fkey(id, name, role)
    `)

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

    // Fetch pause records for each task
    const tasksWithPauses = await Promise.all(
      tasks.map(async (task) => {
        const { data: pauses } = await supabase
          .from("pause_records")
          .select("*")
          .eq("task_id", task.id)
          .order("paused_at_server", { ascending: true })

        return {
          ...task,
          pause_history: pauses || [],
        }
      }),
    )

    return NextResponse.json({ tasks: tasksWithPauses }, { status: 200 })
  } catch (error) {
    console.error("[v0] Tasks GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST create new task
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    const {
      task_type,
      priority_level,
      assigned_to_user_id,
      expected_duration_minutes,
      photo_required,
      room_number,
      assigned_at_client,
    } = body

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Validate timestamp (within 5 minutes tolerance)
    const clientTime = new Date(assigned_at_client).getTime()
    const serverTime = Date.now()
    const timeDiff = Math.abs(serverTime - clientTime)
    const TOLERANCE_MS = 5 * 60 * 1000 // 5 minutes

    if (timeDiff > TOLERANCE_MS) {
      return NextResponse.json({ error: "Clock skew detected. Please check your device time." }, { status: 400 })
    }

    if (priority_level === "GUEST_REQUEST") {
      // Get the assigned worker's department
      const { data: assignedWorker } = await supabase
        .from("users")
        .select("department")
        .eq("id", assigned_to_user_id)
        .single()

      // Only auto-pause if the worker is NOT from housekeeping department
      if (assignedWorker && assignedWorker.department !== "housekeeping") {
        const { data: activeTasks } = await supabase
          .from("tasks")
          .select("*")
          .eq("assigned_to_user_id", assigned_to_user_id)
          .eq("status", "IN_PROGRESS")

        if (activeTasks && activeTasks.length > 0) {
          // Auto-pause the current task
          const activeTask = activeTasks[0]
          await supabase.from("tasks").update({ status: "PAUSED" }).eq("id", activeTask.id)

          // Create pause record
          await supabase.from("pause_records").insert({
            task_id: activeTask.id,
            paused_at_client: new Date().toISOString(),
            reason: "Auto-paused for urgent guest request",
          })

          // Create audit log
          await supabase.from("audit_logs").insert({
            task_id: activeTask.id,
            user_id: user.id,
            action: "AUTO_PAUSED",
            old_status: "IN_PROGRESS",
            new_status: "PAUSED",
            timestamp_client: new Date().toISOString(),
            metadata: { reason: "Urgent guest request assigned" },
          })
        }
      } else {
        console.log("[v0] Skipping auto-pause for housekeeping staff")
      }
    }

    // Create task
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .insert({
        task_type,
        priority_level,
        status: "PENDING",
        assigned_to_user_id,
        assigned_by_user_id: user.id,
        assigned_at_client,
        expected_duration_minutes,
        photo_required: photo_required || false,
        room_number,
        worker_remark: "",
        supervisor_remark: "",
      })
      .select()
      .single()

    if (taskError) {
      console.error("[v0] Task creation error:", taskError)
      return NextResponse.json({ error: taskError.message }, { status: 400 })
    }

    // Create audit log
    await supabase.from("audit_logs").insert({
      task_id: task.id,
      user_id: user.id,
      action: "CREATED",
      old_status: null,
      new_status: "PENDING",
      timestamp_client: assigned_at_client,
      metadata: { task_type, priority_level },
    })

    return NextResponse.json({ task }, { status: 201 })
  } catch (error) {
    console.error("[v0] Task POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
