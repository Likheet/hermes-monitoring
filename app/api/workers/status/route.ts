import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { databaseUserToApp } from "@/lib/database-types"

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

      return {
        ...appWorker,
        is_available: activeTasks.length === 0,
        current_task: activeTasks.length > 0 ? activeTasks[0] : null,
      }
    })

    return NextResponse.json({ workers: workersWithStatus }, { status: 200 })
  } catch (error) {
    console.error("Workers status GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
