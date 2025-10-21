import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { cookies } from "next/headers"

// GET audit logs
export async function GET(request: Request) {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get("session")

    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const taskId = searchParams.get("task_id")

    let query = supabase
      .from("audit_logs")
      .select("*, user:users(name, role), task:tasks(task_type, room_number)")
      .order("created_at", { ascending: false })

    if (taskId) {
      query = query.eq("task_id", taskId)
    }

    const { data: logs, error } = await query

    if (error) {
      console.error("Audit logs fetch error:", error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ logs }, { status: 200 })
  } catch (error) {
    console.error("Audit GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
