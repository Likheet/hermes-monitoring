import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { databaseTaskToApp } from "@/lib/database-types"

// GET single task
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get("session")

    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const supabase = await createClient()

    const { data: task, error } = await supabase.from("tasks").select("*").eq("id", id).single()

    if (error) {
      console.error("[v0] Task fetch error:", error)
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    const appTask = databaseTaskToApp(task)

    return NextResponse.json({ task: appTask }, { status: 200 })
  } catch (error) {
    console.error("[v0] Task GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PATCH update task
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get("session")

    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = sessionCookie.value
    const { id } = await params
    const supabase = await createClient()
    const body = await request.json()

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

    if (body.status && body.status !== currentTask.status) {
      const auditLog = currentTask.audit_log || []
      auditLog.push({
        user_id: userId,
        action: "STATUS_CHANGED",
        old_status: currentTask.status,
        new_status: body.status,
        timestamp: { client: new Date().toISOString(), server: new Date().toISOString() },
        details: `Status changed from ${currentTask.status} to ${body.status}`,
      })

      await supabase.from("tasks").update({ audit_log: auditLog }).eq("id", id)
    }

    const appTask = databaseTaskToApp(task)
    return NextResponse.json({ task: appTask }, { status: 200 })
  } catch (error) {
    console.error("[v0] Task PATCH error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
