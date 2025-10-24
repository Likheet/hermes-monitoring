import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { databaseUserToApp } from "@/lib/database-types"
import { isWorkerOnShiftWithSchedule, formatDateKeyForTimezone } from "@/lib/shift-utils"

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

    const workerIds = workers.map((worker) => worker.id)

    // Get today's date in YYYY-MM-DD format
    const today = formatDateKeyForTimezone(new Date())
    console.log("[WorkersStatus] Fetching shift schedules for today:", today)

    // Fetch shift schedules for all workers for today
    const { data: shiftSchedules, error: schedulesError } = await supabase
      .from("shift_schedules")
      .select("*")
      .eq("schedule_date", today)
      .in("worker_id", workerIds)

    if (schedulesError) {
      console.error("Shift schedules fetch error:", schedulesError)
      return NextResponse.json({ error: schedulesError.message }, { status: 400 })
    }

    console.log("[WorkersStatus] Fetched shift schedules:", {
      total: shiftSchedules?.length || 0,
      workers: workerIds.length,
      schedules: shiftSchedules?.map(s => ({ worker: s.worker_id, start: s.shift_start, end: s.shift_end, override: s.is_override }))
    })

    let activeTasksByWorker: Record<string, any[]> = {}

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

      activeTasksByWorker = (activeTasks ?? []).reduce<Record<string, any[]>>((acc, task) => {
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

    const workersWithStatus = workers.map((worker) => {
      const appWorker = databaseUserToApp(worker)
      const activeTasks = activeTasksByWorker[worker.id] ?? []
      
      // Check if worker is on shift using shift schedules
      const availability = isWorkerOnShiftWithSchedule(worker, shiftSchedules || [])
      
      console.log(`[WorkersStatus] Worker ${worker.name}:`, {
        workerId: worker.id,
        availability: availability.status,
        activeTasksCount: activeTasks.length,
        shiftStart: availability.shiftStart,
        shiftEnd: availability.shiftEnd,
        isOverride: shiftSchedules?.find(s => s.worker_id === worker.id)?.is_override
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
        status: status,
        availability: availability,
        current_task: activeTasks.length > 0 ? activeTasks[0] : null,
      }
    })

    return NextResponse.json({ workers: workersWithStatus }, { status: 200 })
  } catch (error) {
    console.error("Workers status GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
