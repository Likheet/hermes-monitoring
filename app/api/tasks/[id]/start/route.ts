import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { started_at_client } = await request.json()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Validate timestamp
    const clientTime = new Date(started_at_client).getTime()
    const serverTime = Date.now()
    const timeDiff = Math.abs(serverTime - clientTime)
    const TOLERANCE_MS = 5 * 60 * 1000

    if (timeDiff > TOLERANCE_MS) {
      return NextResponse.json({ error: "Clock skew detected" }, { status: 400 })
    }

    // Update task
    const { data: task, error } = await supabase
      .from("tasks")
      .update({
        status: "IN_PROGRESS",
        started_at_client,
        started_at_server: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("[v0] Task start error:", error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Create audit log
    await supabase.from("audit_logs").insert({
      task_id: id,
      user_id: user.id,
      action: "STARTED",
      old_status: "PENDING",
      new_status: "IN_PROGRESS",
      timestamp_client: started_at_client,
    })

    return NextResponse.json({ task }, { status: 200 })
  } catch (error) {
    console.error("[v0] Task start POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
