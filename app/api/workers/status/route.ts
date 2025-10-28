import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { databaseUserToApp } from "@/lib/database-types"
import type { DatabaseUser, DatabaseShiftSchedule } from "@/lib/database-types"
import { isWorkerOnShiftWithSchedule, formatDateKeyForTimezone } from "@/lib/shift-utils"

type ActiveTaskSummary = {
  id: string
  task_type: string
  status: string
  room_number: string | null
  assigned_to_user_id: string | null
  created_at: string
  updated_at: string
  expected_duration: number | null
}

export async function GET() {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get("session")

    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = await createClient()

    // Get all workers
  const { data: workers, error: workersError } = await supabase.from("users").select("*").eq("role", "worker")

    if (workersError) {
      console.error("Workers fetch error:", workersError)
      return NextResponse.json({ error: workersError.message }, { status: 400 })
    }

  const workerRows = (workers ?? []) as DatabaseUser[]
  const workerIds = workerRows.map((worker) => worker.id)

    // Get today's date in YYYY-MM-DD format
    const today = formatDateKeyForTimezone(new Date())
    console.log("[WorkersStatus] Fetching shift schedules for today:", today)

    // Fetch shift schedules for all workers for today
    const { data: shiftScheduleRows, error: schedulesError } = await supabase
      .from("shift_schedules")
      .select("*")
      .eq("schedule_date", today)
      .in("worker_id", workerIds)

    if (schedulesError) {
      console.error("Shift schedules fetch error:", schedulesError)
      return NextResponse.json({ error: schedulesError.message }, { status: 400 })
    }

    const shiftSchedules = (shiftScheduleRows ?? []) as DatabaseShiftSchedule[]
    const shiftSchedulesForAvailability = shiftSchedules.map((schedule) => ({
      worker_id: schedule.worker_id,
      schedule_date: schedule.schedule_date,
      shift_start: schedule.shift_start ?? "",
      shift_end: schedule.shift_end ?? "",
      has_break:
        "has_break" in schedule
          ? Boolean((schedule as DatabaseShiftSchedule & { has_break?: boolean }).has_break)
          : Boolean(schedule.break_start && schedule.break_end),
      break_start: schedule.break_start ?? undefined,
      break_end: schedule.break_end ?? undefined,
      is_override: schedule.is_override,
      override_reason: schedule.override_reason ?? undefined,
      has_shift_2: schedule.has_shift_2,
      is_dual_shift: schedule.is_dual_shift,
      shift_1_start: schedule.shift_1_start ?? undefined,
      shift_1_end: schedule.shift_1_end ?? undefined,
      shift_1_break_start: schedule.shift_1_break_start ?? undefined,
      shift_1_break_end: schedule.shift_1_break_end ?? undefined,
      shift_2_start: schedule.shift_2_start ?? undefined,
      shift_2_end: schedule.shift_2_end ?? undefined,
      shift_2_break_start: schedule.shift_2_break_start ?? undefined,
      shift_2_break_end: schedule.shift_2_break_end ?? undefined,
    }))

    console.log("[WorkersStatus] Fetched shift schedules:", {
      total: shiftSchedules.length,
      workers: workerIds.length,
      schedules: shiftSchedules.map((schedule) => ({
        worker: schedule.worker_id,
        start: schedule.shift_start,
        end: schedule.shift_end,
        override: schedule.is_override,
      })),
    })

    let activeTasksByWorker: Record<string, ActiveTaskSummary[]> = {}

    if (workerIds.length > 0) {
      const { data: activeTasks, error: tasksError } = await supabase
        .from("tasks")
        .select(
          [
            "id",
            "task_type",
            "status",
            "room_number",
            "assigned_to_user_id",
            "created_at",
            "updated_at",
            "expected_duration",
          ].join(","),
        )
        .in("assigned_to_user_id", workerIds)
        .in("status", ["in_progress", "paused"])
        .order("updated_at", { ascending: false })

      if (tasksError) {
        console.error("Active tasks fetch error:", tasksError)
        return NextResponse.json({ error: tasksError.message }, { status: 400 })
      }

      const activeTaskRows = Array.isArray(activeTasks)
        ? ((activeTasks as unknown) as ActiveTaskSummary[])
        : []
      activeTasksByWorker = activeTaskRows.reduce<Record<string, ActiveTaskSummary[]>>((acc, task) => {
        const assignedId = task.assigned_to_user_id
        if (!assignedId) {
          return acc
        }
        if (!acc[assignedId]) {
          acc[assignedId] = []
        }
        acc[assignedId].push(task)
        return acc
      }, {})
    }

    const workersWithStatus = workerRows.map((worker) => {
      const appWorker = databaseUserToApp(worker)
      const activeTasks = activeTasksByWorker[worker.id] ?? []
      
      // Check if worker is on shift using shift schedules
  const availability = isWorkerOnShiftWithSchedule(appWorker, shiftSchedulesForAvailability)
      
      console.log(`[WorkersStatus] Worker ${worker.name}:`, {
        workerId: worker.id,
        availability: availability.status,
        activeTasksCount: activeTasks.length,
        shiftStart: availability.shiftStart,
        shiftEnd: availability.shiftEnd,
        isOverride: shiftSchedules.find((schedule) => schedule.worker_id === worker.id)?.is_override,
      })

      // Determine availability based on shift schedule and active tasks
      let isAvailable = false
      let status: string

      switch (availability.status) {
        case "AVAILABLE": {
          const isIdle = activeTasks.length === 0
          isAvailable = isIdle
          status = isIdle ? "available" : "busy"
          break
        }
        case "SHIFT_BREAK":
          isAvailable = false
          status = "shift_break"
          break
        default:
          isAvailable = false
          status = activeTasks.length > 0 ? "overtime" : "off_duty"
          break
      }

      return {
        ...appWorker,
        is_available: isAvailable,
        status,
        availability,
        current_task: activeTasks.length > 0 ? activeTasks[0] : null,
      }
    })

    return NextResponse.json({ workers: workersWithStatus }, { status: 200 })
  } catch (error) {
    console.error("Workers status GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
