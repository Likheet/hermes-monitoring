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

    // Get active tasks for each worker
    const workersWithStatus = await Promise.all(
      workers.map(async (worker) => {
        const { data: activeTasks } = await supabase
          .from("tasks")
          .select("*")
          .eq("assigned_to_user_id", worker.id)
          .in("status", ["IN_PROGRESS", "PAUSED"])

        const appWorker = databaseUserToApp(worker)

        return {
          ...appWorker,
          is_available: !activeTasks || activeTasks.length === 0,
          current_task: activeTasks && activeTasks.length > 0 ? activeTasks[0] : null,
        }
      }),
    )

    return NextResponse.json({ workers: workersWithStatus }, { status: 200 })
  } catch (error) {
    console.error("Workers status GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
