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
    const { photo_url, worker_remark, categorized_photos } = await request.json()

    const completed_at = {
      client: new Date().toISOString(),
      server: new Date().toISOString(),
      validated: true,
    }

    const { data: currentTask } = await supabase.from("tasks").select("*").eq("id", id).single()

    if (!currentTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    // Calculate actual duration (excluding pause time)
    let totalPauseTime = 0
    if (currentTask.pause_history) {
      for (const pause of currentTask.pause_history) {
        if (pause.resumed_at) {
          const pausedAt = new Date(pause.paused_at.server).getTime()
          const resumedAt = new Date(pause.resumed_at.server).getTime()
          totalPauseTime += resumedAt - pausedAt
        }
      }
    }

    const startedAt = new Date(currentTask.started_at.server).getTime()
    const completedAtTime = new Date().getTime()
    const totalTime = completedAtTime - startedAt
    const actualDuration = Math.round((totalTime - totalPauseTime) / 60000) // Convert to minutes

    const auditLog = currentTask.audit_log || []
    auditLog.push({
      timestamp: new Date().toISOString(),
      user_id: sessionUserId,
      action: "COMPLETED",
      old_status: "IN_PROGRESS",
      new_status: "COMPLETED",
      metadata: { actual_duration_minutes: actualDuration },
    })

    const { data: task, error } = await supabase
      .from("tasks")
      .update({
        status: "COMPLETED",
        completed_at,
        actual_duration_minutes: actualDuration,
        categorized_photos: categorized_photos || currentTask.categorized_photos,
        worker_remark: worker_remark || "",
        audit_log: auditLog,
      })
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("[v0] Task complete error:", error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const appTask = databaseTaskToApp(task)

    return NextResponse.json({ task: appTask }, { status: 200 })
  } catch (error) {
    console.error("[v0] Task complete POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
