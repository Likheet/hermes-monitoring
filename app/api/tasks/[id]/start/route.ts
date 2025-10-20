import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { databaseTaskToApp } from "@/lib/database-types"

function toDualTimestamp() {
  const iso = new Date().toISOString()
  return { client: iso, server: iso }
}

function normalizeStatus(status: string) {
  const lower = status.toLowerCase()
  switch (lower) {
    case "pending":
    case "in_progress":
    case "paused":
    case "completed":
    case "verified":
    case "rejected":
      return lower
    default:
      return "pending"
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const cookieStore = await cookies()
    const sessionUserId = cookieStore.get("session")?.value

    if (!sessionUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = await createClient()
    const startTimestamp = new Date().toISOString()

    const { data: currentTask, error: fetchError } = await supabase
      .from("tasks")
      .select("status, audit_log")
      .eq("id", id)
      .single()

    if (fetchError || !currentTask) {
      console.error("[v0] Task start fetch error:", fetchError)
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    const auditLog = Array.isArray(currentTask.audit_log) ? currentTask.audit_log : []
    auditLog.push({
      timestamp: toDualTimestamp(),
      user_id: sessionUserId,
      action: "TASK_STARTED",
      old_status: currentTask.status ?? "PENDING",
      new_status: "IN_PROGRESS",
      details: "Worker started the task",
    })

    const { data: task, error } = await supabase
      .from("tasks")
      .update({
        status: normalizeStatus("in_progress"),
        started_at: startTimestamp,
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
