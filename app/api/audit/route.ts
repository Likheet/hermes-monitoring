import { createClient } from "@/lib/supabase/server"
import type { AuditLogEntry } from "@/lib/types"
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

    if (!taskId) {
      return NextResponse.json({ error: "task_id query parameter is required" }, { status: 400 })
    }

    const { data: task, error } = await supabase
      .from("tasks")
      .select("audit_log")
      .eq("id", taskId)
      .single()

    if (error) {
      console.error("Audit log fetch error:", error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const logs: AuditLogEntry[] = Array.isArray(task?.audit_log) ? [...task.audit_log] : []

    logs.sort((a, b) => {
      const getComparable = (entry: AuditLogEntry) => entry.timestamp.server ?? entry.timestamp.client ?? ""
      return getComparable(b).localeCompare(getComparable(a))
    })

    return NextResponse.json({ logs }, { status: 200 })
  } catch (error) {
    console.error("Audit GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
