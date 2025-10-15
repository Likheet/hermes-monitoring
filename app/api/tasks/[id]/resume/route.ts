import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { resumed_at_client } = await request.json()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Validate timestamp
    const clientTime = new Date(resumed_at_client).getTime()
    const serverTime = Date.now()
    const timeDiff = Math.abs(serverTime - clientTime)
    const TOLERANCE_MS = 5 * 60 * 1000

    if (timeDiff > TOLERANCE_MS) {
      return NextResponse.json({ error: "Clock skew detected" }, { status: 400 })
    }

    // Update task status
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .update({ status: "IN_PROGRESS" })
      .eq("id", id)
      .select()
      .single()

    if (taskError) {
      console.error("[v0] Task resume error:", taskError)
      return NextResponse.json({ error: taskError.message }, { status: 400 })
    }

    // Update the most recent pause record
    const { data: pauseRecords } = await supabase
      .from("pause_records")
      .select("*")
      .eq("task_id", id)
      .is("resumed_at_client", null)
      .order("paused_at_server", { ascending: false })
      .limit(1)

    if (pauseRecords && pauseRecords.length > 0) {
      await supabase
        .from("pause_records")
        .update({
          resumed_at_client,
          resumed_at_server: new Date().toISOString(),
        })
        .eq("id", pauseRecords[0].id)
    }

    // Create audit log
    await supabase.from("audit_logs").insert({
      task_id: id,
      user_id: user.id,
      action: "RESUMED",
      old_status: "PAUSED",
      new_status: "IN_PROGRESS",
      timestamp_client: resumed_at_client,
    })

    return NextResponse.json({ task }, { status: 200 })
  } catch (error) {
    console.error("[v0] Task resume POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
