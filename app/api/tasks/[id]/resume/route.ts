import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { databaseTaskToApp } from "@/lib/database-types"
import type { PauseRecord } from "@/lib/types"

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

    const { data: currentTask, error: fetchError } = await supabase
      .from("tasks")
      .select("status, pause_history, audit_log")
      .eq("id", id)
      .single()

    if (fetchError || !currentTask) {
      console.error("Task resume fetch error:", fetchError)
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    const pauseHistory = Array.isArray(currentTask.pause_history)
      ? (currentTask.pause_history as PauseRecord[])
      : []
    const updatedPauseHistory = pauseHistory.map((entry) => ({ ...entry }))
    for (let index = updatedPauseHistory.length - 1; index >= 0; index--) {
      const entry = updatedPauseHistory[index]
      if (!entry?.resumed_at) {
        entry.resumed_at = toDualTimestamp()
        break
      }
    }

    const auditLog = Array.isArray(currentTask.audit_log) ? currentTask.audit_log : []
    auditLog.push({
      timestamp: toDualTimestamp(),
      user_id: sessionUserId,
      action: "TASK_RESUMED",
      old_status: currentTask.status ?? "PAUSED",
      new_status: "IN_PROGRESS",
      details: "Task resumed by worker",
    })

    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .update({
        status: normalizeStatus("in_progress"),
        pause_history: updatedPauseHistory,
        audit_log: auditLog,
      })
      .eq("id", id)
      .select()
      .single()

    if (taskError) {
      console.error("Task resume error:", taskError)
      return NextResponse.json({ error: taskError.message }, { status: 400 })
    }

    const appTask = databaseTaskToApp(task)

    return NextResponse.json({ task: appTask }, { status: 200 })
  } catch (error) {
    console.error("Task resume POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
