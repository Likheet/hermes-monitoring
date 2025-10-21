import { createClient } from "@/lib/supabase/server"
import {
  loadShiftSchedulesFromSupabase,
  loadTasksFromSupabase,
  loadUsersFromSupabase,
} from "@/lib/supabase-task-operations"
import type { ShiftSchedule, Task, User } from "@/lib/types"

export interface DashboardBootstrapData {
  tasks: Task[]
  users: User[]
  shiftSchedules: ShiftSchedule[]
  meta: {
    tasksFetchedAt: number
    usersFetchedAt: number
    shiftSchedulesFetchedAt: number
  }
}

export async function getDashboardBootstrapData(): Promise<DashboardBootstrapData> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn("[bootstrap] Supabase environment variables missing; returning empty preload payload.")
      const timestamp = Date.now()
      return {
        tasks: [],
        users: [],
        shiftSchedules: [],
        meta: {
          tasksFetchedAt: timestamp,
          usersFetchedAt: timestamp,
          shiftSchedulesFetchedAt: timestamp,
        },
      }
    }

    const supabase = await createClient()
    const [tasks, users, shiftSchedules] = await Promise.all([
      loadTasksFromSupabase({}, supabase),
      loadUsersFromSupabase({}, supabase),
      loadShiftSchedulesFromSupabase({}, supabase),
    ])

    const timestamp = Date.now()

    return {
      tasks,
      users,
      shiftSchedules,
      meta: {
        tasksFetchedAt: timestamp,
        usersFetchedAt: timestamp,
        shiftSchedulesFetchedAt: timestamp,
      },
    }
  } catch (error) {
    console.error("[bootstrap] Failed to preload dashboard data", error)
    const timestamp = Date.now()
    return {
      tasks: [],
      users: [],
      shiftSchedules: [],
      meta: {
        tasksFetchedAt: timestamp,
        usersFetchedAt: timestamp,
        shiftSchedulesFetchedAt: timestamp,
      },
    }
  }
}
