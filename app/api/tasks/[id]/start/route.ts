import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { databaseTaskToApp } from "@/lib/database-types"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const cookieStore = await cookies()
    const sessionUserId = cookieStore.get("session")?.value

    if (!sessionUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = await createClient()

    const started_at = {
      client: new Date().toISOString(),
      server: new Date().toISOString(),
      validated: true,
    }

    // Get current task to append to audit log
    const { data: currentTask } = await supabase.from("tasks").select("audit_log").eq("id", id).single()

    const auditLog = currentTask?.audit_log || []
    auditLog.push({
      timestamp: new Date().toISOString(),
      user_id: sessionUserId,
      action: "STARTED",
      old_status: "PENDING",
      new_status: "IN_PROGRESS",
      metadata: {},
    })

    const { data: task, error } = await supabase
      .from("tasks")
      .update({
        status: "IN_PROGRESS",
        started_at,
        audit_log: auditLog,
      })
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("[v0] Task start error:", error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const appTask = databaseTaskToApp(task)

    return NextResponse.json({ task: appTask }, { status: 200 })
  } catch (error) {
    console.error("[v0] Task start POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
