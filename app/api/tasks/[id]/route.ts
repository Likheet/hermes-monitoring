import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// GET single task
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: task, error } = await supabase
      .from("tasks")
      .select(`
        *,
        assigned_to:users!tasks_assigned_to_user_id_fkey(id, name, role, department),
        assigned_by:users!tasks_assigned_by_user_id_fkey(id, name, role)
      `)
      .eq("id", id)
      .single()

    if (error) {
      console.error("[v0] Task fetch error:", error)
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    // Fetch pause records
    const { data: pauses } = await supabase
      .from("pause_records")
      .select("*")
      .eq("task_id", id)
      .order("paused_at_server", { ascending: true })

    // Fetch audit logs
    const { data: auditLogs } = await supabase
      .from("audit_logs")
      .select("*, user:users(name, role)")
      .eq("task_id", id)
      .order("timestamp_server", { ascending: true })

    return NextResponse.json(
      {
        task: {
          ...task,
          pause_history: pauses || [],
          audit_log: auditLogs || [],
        },
      },
      { status: 200 },
    )
  } catch (error) {
    console.error("[v0] Task GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PATCH update task
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const body = await request.json()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get current task
    const { data: currentTask } = await supabase.from("tasks").select("*").eq("id", id).single()

    if (!currentTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    // Update task
    const { data: task, error } = await supabase.from("tasks").update(body).eq("id", id).select().single()

    if (error) {
      console.error("[v0] Task update error:", error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Create audit log if status changed
    if (body.status && body.status !== currentTask.status) {
      await supabase.from("audit_logs").insert({
        task_id: id,
        user_id: user.id,
        action: "STATUS_CHANGED",
        old_status: currentTask.status,
        new_status: body.status,
        timestamp_client: body.timestamp_client || new Date().toISOString(),
        metadata: body,
      })
    }

    return NextResponse.json({ task }, { status: 200 })
  } catch (error) {
    console.error("[v0] Task PATCH error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
