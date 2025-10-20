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

    const resumed_at = {
      client: new Date().toISOString(),
      server: new Date().toISOString(),
      validated: true,
    }

    const { data: currentTask } = await supabase.from("tasks").select("pause_history, audit_log").eq("id", id).single()

    const pauseHistory = currentTask?.pause_history || []
    // Find the most recent pause without a resumed_at
    const lastPauseIndex = pauseHistory.findIndex((p: any) => !p.resumed_at)
    if (lastPauseIndex !== -1) {
      pauseHistory[lastPauseIndex].resumed_at = resumed_at
    }

    const auditLog = currentTask?.audit_log || []
    auditLog.push({
      timestamp: new Date().toISOString(),
      user_id: sessionUserId,
      action: "RESUMED",
      old_status: "PAUSED",
      new_status: "IN_PROGRESS",
      metadata: {},
    })

    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .update({
        status: "IN_PROGRESS",
        pause_history: pauseHistory,
        audit_log: auditLog,
      })
      .eq("id", id)
      .select()
      .single()

    if (taskError) {
      console.error("[v0] Task resume error:", taskError)
      return NextResponse.json({ error: taskError.message }, { status: 400 })
    }

    const appTask = databaseTaskToApp(task)

    return NextResponse.json({ task: appTask }, { status: 200 })
  } catch (error) {
    console.error("[v0] Task resume POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
