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

function extractTimestamp(value: any) {
  if (!value) return null
  if (typeof value === "string") return value
  if (typeof value === "object") {
    return value.server ?? value.client ?? null
  }
  return null
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
    const { userId, categorizedPhotos, remark } = await request.json()

    const completionTimestamp = new Date().toISOString()

    const { data: currentTask, error: fetchError } = await supabase
      .from("tasks")
      .select("status, started_at, pause_history, audit_log, categorized_photos, worker_remarks")
      .eq("id", id)
      .single()

    if (fetchError || !currentTask) {
      console.error("[v0] Task complete fetch error:", fetchError)
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    // Calculate actual duration (excluding pause time)
    const pauseHistory = Array.isArray(currentTask.pause_history) ? currentTask.pause_history : []
    const updatedPauseHistory = pauseHistory.map((entry: any) => ({ ...entry }))

    let totalPauseTime = 0
    for (const pause of updatedPauseHistory) {
      const pausedAt = extractTimestamp(pause?.paused_at)
      let resumedAt = extractTimestamp(pause?.resumed_at)

      if (!resumedAt) {
        const resumeTimestamp = toDualTimestamp()
        pause.resumed_at = resumeTimestamp
        resumedAt = resumeTimestamp.server
      }

      if (pausedAt && resumedAt) {
        const pausedTime = new Date(pausedAt).getTime()
        const resumedTime = new Date(resumedAt).getTime()
        totalPauseTime += Math.max(resumedTime - pausedTime, 0)
      }
    }

    const startedAtSource = extractTimestamp(currentTask.started_at)
    let actualDuration: number | null = null
    if (startedAtSource) {
      const startedTime = new Date(startedAtSource).getTime()
      const completedTime = new Date(completionTimestamp).getTime()
      const totalTime = Math.max(completedTime - startedTime, 0)
      actualDuration = Math.round((totalTime - totalPauseTime) / 60000)
    }

    const auditLog = Array.isArray(currentTask.audit_log) ? currentTask.audit_log : []
    auditLog.push({
      timestamp: toDualTimestamp(),
      user_id: userId ?? sessionUserId,
      action: "TASK_COMPLETED",
      old_status: currentTask.status ?? "IN_PROGRESS",
      new_status: "COMPLETED",
      details: remark || "Task completed",
    })

    const updatedPhotos = categorizedPhotos ?? currentTask.categorized_photos ?? {
      room_photos: [],
      proof_photos: [],
    }

    const { data: task, error } = await supabase
      .from("tasks")
      .update({
        status: normalizeStatus("completed"),
        completed_at: completionTimestamp,
        actual_duration: actualDuration,
        categorized_photos: updatedPhotos,
        worker_remarks: remark ?? currentTask.worker_remarks ?? "",
        audit_log: auditLog,
        pause_history: updatedPauseHistory,
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
