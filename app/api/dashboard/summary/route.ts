import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import {
  loadTasksFromSupabase,
  loadUsersFromSupabase,
  loadShiftSchedulesFromSupabase,
} from "@/lib/supabase-task-operations"

export async function GET() {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get("session")

    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = await createClient()
    const [tasks, users, shiftSchedules] = await Promise.all([
      loadTasksFromSupabase({ forceRefresh: true, includePhotos: true }, supabase),
      loadUsersFromSupabase({ forceRefresh: true }, supabase),
      loadShiftSchedulesFromSupabase({ forceRefresh: true }, supabase),
    ])

    return NextResponse.json(
      {
        tasks,
        users,
        shiftSchedules,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "s-maxage=30, stale-while-revalidate=60",
        },
      },
    )
  } catch (error) {
    console.error("Dashboard summary GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
