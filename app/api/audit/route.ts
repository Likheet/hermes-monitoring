import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// GET audit logs
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const taskId = searchParams.get("task_id")

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let query = supabase
      .from("audit_logs")
      .select("*, user:users(name, role), task:tasks(task_type, room_number)")
      .order("timestamp_server", { ascending: false })

    if (taskId) {
      query = query.eq("task_id", taskId)
    }

    const { data: logs, error } = await query

    if (error) {
      console.error("[v0] Audit logs fetch error:", error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ logs }, { status: 200 })
  } catch (error) {
    console.error("[v0] Audit GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
