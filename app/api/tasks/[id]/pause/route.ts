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
    const { reason } = await request.json()

    const paused_at = {
      client: new Date().toISOString(),
      server: new Date().toISOString(),
      validated: true,
    }

    // Get current task to append to pause history and audit log
    const { data: currentTask } = await supabase.from("tasks").select("pause_history, audit_log").eq("id", id).single()

    const pauseHistory = currentTask?.pause_history || []
    pauseHistory.push({
      paused_at,
      resumed_at: null,
      reason: reason || "Worker paused task",
    })

    const auditLog = currentTask?.audit_log || []
    auditLog.push({
      timestamp: new Date().toISOString(),
      user_id: sessionUserId,
      action: "PAUSED",
      old_status: "IN_PROGRESS",
      new_status: "PAUSED",
      metadata: { reason },
    })

    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .update({
        status: "PAUSED",
        pause_history: pauseHistory,
        audit_log: auditLog,
      })
      .eq("id", id)
      .select()
      .single()

    if (taskError) {
      console.error("[v0] Task pause error:", taskError)
      return NextResponse.json({ error: taskError.message }, { status: 400 })
    }

    const appTask = databaseTaskToApp(task)

    return NextResponse.json({ task: appTask }, { status: 200 })
  } catch (error) {
    console.error("[v0] Task pause POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
