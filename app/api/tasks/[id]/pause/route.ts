import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { paused_at_client, reason } = await request.json()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Validate timestamp
    const clientTime = new Date(paused_at_client).getTime()
    const serverTime = Date.now()
    const timeDiff = Math.abs(serverTime - clientTime)
    const TOLERANCE_MS = 5 * 60 * 1000

    if (timeDiff > TOLERANCE_MS) {
      return NextResponse.json({ error: "Clock skew detected" }, { status: 400 })
    }

    // Update task status
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .update({ status: "PAUSED" })
      .eq("id", id)
      .select()
      .single()

    if (taskError) {
      console.error("[v0] Task pause error:", taskError)
      return NextResponse.json({ error: taskError.message }, { status: 400 })
    }

    // Create pause record
    const { data: pauseRecord, error: pauseError } = await supabase
      .from("pause_records")
      .insert({
        task_id: id,
        paused_at_client,
        reason: reason || "Worker paused task",
      })
      .select()
      .single()

    if (pauseError) {
      console.error("[v0] Pause record error:", pauseError)
      return NextResponse.json({ error: pauseError.message }, { status: 400 })
    }

    // Create audit log
    await supabase.from("audit_logs").insert({
      task_id: id,
      user_id: user.id,
      action: "PAUSED",
      old_status: "IN_PROGRESS",
      new_status: "PAUSED",
      timestamp_client: paused_at_client,
      metadata: { reason },
    })

    return NextResponse.json({ task, pauseRecord }, { status: 200 })
  } catch (error) {
    console.error("[v0] Task pause POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
