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
    const { reason } = await request.json()

    const pauseTimestamp = toDualTimestamp()

    const { data: currentTask, error: fetchError } = await supabase
      .from("tasks")
      .select("status, pause_history, audit_log")
      .eq("id", id)
      .single()

    if (fetchError || !currentTask) {
      console.error("Task pause fetch error:", fetchError)
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    const pauseHistory = Array.isArray(currentTask.pause_history) ? currentTask.pause_history : []
    pauseHistory.push({
      paused_at: pauseTimestamp,
      resumed_at: null,
      reason: reason || "Worker paused task",
    })

    const auditLog = Array.isArray(currentTask.audit_log) ? currentTask.audit_log : []
    auditLog.push({
      timestamp: toDualTimestamp(),
      user_id: sessionUserId,
      action: "TASK_PAUSED",
      old_status: currentTask.status ?? "IN_PROGRESS",
      new_status: "PAUSED",
      details: reason || "Task paused by worker",
    })

    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .update({
        status: normalizeStatus("paused"),
        pause_history: pauseHistory,
        audit_log: auditLog,
      })
      .eq("id", id)
      .select()
      .single()

    if (taskError) {
      console.error("Task pause error:", taskError)
      return NextResponse.json({ error: taskError.message }, { status: 400 })
    }

    const appTask = databaseTaskToApp(task)

    return NextResponse.json({ task: appTask }, { status: 200 })
  } catch (error) {
    console.error("Task pause POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
