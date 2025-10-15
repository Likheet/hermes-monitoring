import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { completed_at_client, photo_url, worker_remark } = await request.json()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Validate timestamp
    const clientTime = new Date(completed_at_client).getTime()
    const serverTime = Date.now()
    const timeDiff = Math.abs(serverTime - clientTime)
    const TOLERANCE_MS = 5 * 60 * 1000

    if (timeDiff > TOLERANCE_MS) {
      return NextResponse.json({ error: "Clock skew detected" }, { status: 400 })
    }

    // Get task to calculate duration
    const { data: currentTask } = await supabase
      .from("tasks")
      .select("*, pause_records:pause_records(*)")
      .eq("id", id)
      .single()

    if (!currentTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    // Calculate actual duration (excluding pause time)
    let totalPauseTime = 0
    if (currentTask.pause_records) {
      for (const pause of currentTask.pause_records) {
        if (pause.resumed_at_server) {
          const pausedAt = new Date(pause.paused_at_server).getTime()
          const resumedAt = new Date(pause.resumed_at_server).getTime()
          totalPauseTime += resumedAt - pausedAt
        }
      }
    }

    const startedAt = new Date(currentTask.started_at_server).getTime()
    const completedAt = new Date().getTime()
    const totalTime = completedAt - startedAt
    const actualDuration = Math.round((totalTime - totalPauseTime) / 60000) // Convert to minutes

    // Update task
    const { data: task, error } = await supabase
      .from("tasks")
      .update({
        status: "COMPLETED",
        completed_at_client,
        completed_at_server: new Date().toISOString(),
        actual_duration_minutes: actualDuration,
        photo_url: photo_url || null,
        worker_remark: worker_remark || "",
      })
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("[v0] Task complete error:", error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Create audit log
    await supabase.from("audit_logs").insert({
      task_id: id,
      user_id: user.id,
      action: "COMPLETED",
      old_status: "IN_PROGRESS",
      new_status: "COMPLETED",
      timestamp_client: completed_at_client,
      metadata: { actual_duration_minutes: actualDuration },
    })

    return NextResponse.json({ task }, { status: 200 })
  } catch (error) {
    console.error("[v0] Task complete POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
