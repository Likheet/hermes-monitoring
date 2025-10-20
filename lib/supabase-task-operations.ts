import { createClient } from "@/lib/supabase/client"
import type { Task, User, ShiftSchedule } from "./types"
import type { MaintenanceSchedule, MaintenanceTask } from "./maintenance-types"
import {
  databaseTaskToApp,
  appTaskToDatabase,
  databaseUserToApp,
  appUserToDatabase,
  type DatabaseTask,
  type DatabaseUser,
} from "./database-types"

export async function loadTasksFromSupabase(): Promise<Task[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.from("tasks").select("*").order("created_at", { ascending: false })

    if (error) {
      console.error("[v0] Error loading tasks from Supabase:", error)
      throw new Error(`Failed to load tasks: ${error.message}`)
    }

    console.log(`[v0] Loaded ${data?.length || 0} tasks from Supabase`)
    return (data || []).map((dbTask: DatabaseTask) => databaseTaskToApp(dbTask))
  } catch (error) {
    console.error("[v0] Exception loading tasks:", error)
    return []
  }
}

export async function loadUsersFromSupabase(): Promise<User[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("users")
      .select("id, username, name, role, phone, department, shift_timing, created_at")
      .order("name", { ascending: true })

    if (error) {
      console.error("[v0] Error loading users from Supabase:", error)
      throw new Error(`Failed to load users: ${error.message}`)
    }

    console.log(`[v0] Loaded ${data?.length || 0} users from Supabase`)
    return (data || []).map((dbUser: DatabaseUser) => databaseUserToApp(dbUser))
  } catch (error) {
    console.error("[v0] Exception loading users:", error)
    return []
  }
}

export async function saveTaskToSupabase(task: Task): Promise<boolean> {
  try {
    const supabase = createClient()
    const dbTask = appTaskToDatabase(task)

    console.log("[v0] Saving task to Supabase:", {
      id: task.id,
      status: task.status,
      hasAuditLog: !!dbTask.audit_log,
      hasPauseHistory: !!dbTask.pause_history,
    })

    const { error } = await supabase.from("tasks").upsert(dbTask)

    if (error) {
      console.error("[v0] Error saving task to Supabase:", error)
      throw new Error(`Failed to save task: ${error.message}`)
    }

    console.log("[v0] ✅ Task saved to Supabase:", task.id)
    return true
  } catch (error) {
    console.error("[v0] Exception saving task:", error)
    return false
  }
}

export async function saveUserToSupabase(user: User): Promise<boolean> {
  try {
    const supabase = createClient()
    const dbUser = appUserToDatabase(user)

    const { password_hash, ...userWithoutPassword } = dbUser as any

    const { error } = await supabase.from("users").upsert(userWithoutPassword)

    if (error) {
      console.error("[v0] Error saving user to Supabase:", error)
      throw new Error(`Failed to save user: ${error.message}`)
    }

    console.log("[v0] ✅ User saved to Supabase:", user.id)
    return true
  } catch (error) {
    console.error("[v0] Exception saving user:", error)
    return false
  }
}

export async function loadShiftSchedulesFromSupabase(): Promise<ShiftSchedule[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("shift_schedules")
      .select("*")
      .order("schedule_date", { ascending: true })

    if (error) {
      console.error("[v0] Error loading shift schedules from Supabase:", error)
      throw new Error(`Failed to load shift schedules: ${error.message}`)
    }

    console.log(`[v0] Loaded ${data?.length || 0} shift schedules from Supabase`)

    return (data || []).map((dbSchedule: any) => ({
      id: dbSchedule.id,
      worker_id: dbSchedule.worker_id,
      date: dbSchedule.schedule_date,
      shift_start: dbSchedule.shift_start,
      shift_end: dbSchedule.shift_end,
      break_start: dbSchedule.break_start || undefined,
      break_end: dbSchedule.break_end || undefined,
      is_override: dbSchedule.is_override || false,
      override_reason: dbSchedule.override_reason || undefined,
      created_at: dbSchedule.created_at,
    }))
  } catch (error) {
    console.error("[v0] Exception loading shift schedules:", error)
    return []
  }
}

export async function saveShiftScheduleToSupabase(schedule: ShiftSchedule): Promise<boolean> {
  try {
    const supabase = createClient()

    const dbSchedule = {
      id: schedule.id,
      worker_id: schedule.worker_id,
      schedule_date: schedule.date,
      shift_start: schedule.shift_start,
      shift_end: schedule.shift_end,
      break_start: schedule.break_start || null,
      break_end: schedule.break_end || null,
      is_override: schedule.is_override || false,
      override_reason: schedule.override_reason || null,
    }

    const { error } = await supabase.from("shift_schedules").upsert(dbSchedule)

    if (error) {
      console.error("[v0] Error saving shift schedule to Supabase:", error)
      throw new Error(`Failed to save shift schedule: ${error.message}`)
    }

    console.log("[v0] ✅ Shift schedule saved to Supabase:", schedule.id)
    return true
  } catch (error) {
    console.error("[v0] Exception saving shift schedule:", error)
    return false
  }
}

export async function deleteShiftScheduleFromSupabase(scheduleId: string): Promise<boolean> {
  try {
    const supabase = createClient()
    const { error } = await supabase.from("shift_schedules").delete().eq("id", scheduleId)

    if (error) {
      console.error("[v0] Error deleting shift schedule from Supabase:", error)
      throw new Error(`Failed to delete shift schedule: ${error.message}`)
    }

    console.log("[v0] ✅ Shift schedule deleted from Supabase:", scheduleId)
    return true
  } catch (error) {
    console.error("[v0] Exception deleting shift schedule:", error)
    return false
  }
}

export async function loadMaintenanceSchedulesFromSupabase(): Promise<MaintenanceSchedule[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("maintenance_schedules")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[v0] Error loading maintenance schedules from Supabase:", error)
      throw new Error(`Failed to load maintenance schedules: ${error.message}`)
    }

    console.log(`[v0] Loaded ${data?.length || 0} maintenance schedules from Supabase`)
    return data || []
  } catch (error) {
    console.error("[v0] Exception loading maintenance schedules:", error)
    return []
  }
}

export async function saveMaintenanceScheduleToSupabase(schedule: MaintenanceSchedule): Promise<boolean> {
  try {
    const supabase = createClient()
    const { error } = await supabase.from("maintenance_schedules").upsert(schedule)

    if (error) {
      console.error("[v0] Error saving maintenance schedule to Supabase:", error)
      throw new Error(`Failed to save maintenance schedule: ${error.message}`)
    }

    console.log("[v0] ✅ Maintenance schedule saved to Supabase:", schedule.id)
    return true
  } catch (error) {
    console.error("[v0] Exception saving maintenance schedule:", error)
    return false
  }
}

export async function deleteMaintenanceScheduleFromSupabase(scheduleId: string): Promise<boolean> {
  try {
    const supabase = createClient()
    const { error } = await supabase.from("maintenance_schedules").delete().eq("id", scheduleId)

    if (error) {
      console.error("[v0] Error deleting maintenance schedule from Supabase:", error)
      throw new Error(`Failed to delete maintenance schedule: ${error.message}`)
    }

    console.log("[v0] ✅ Maintenance schedule deleted from Supabase:", scheduleId)
    return true
  } catch (error) {
    console.error("[v0] Exception deleting maintenance schedule:", error)
    return false
  }
}

export async function loadMaintenanceTasksFromSupabase(): Promise<MaintenanceTask[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("maintenance_tasks")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[v0] Error loading maintenance tasks from Supabase:", error)
      throw new Error(`Failed to load maintenance tasks: ${error.message}`)
    }

    console.log(`[v0] Loaded ${data?.length || 0} maintenance tasks from Supabase`)
    return (data || []).map(databaseToMaintenanceTask)
  } catch (error) {
    console.error("[v0] Exception loading maintenance tasks:", error)
    return []
  }
}

export async function saveMaintenanceTaskToSupabase(task: MaintenanceTask): Promise<boolean> {
  try {
    const supabase = createClient()
    const dbTask = maintenanceTaskToDatabase(task)
    const { error } = await supabase.from("maintenance_tasks").upsert(dbTask)

    if (error) {
      console.error("[v0] Error saving maintenance task to Supabase:", error)
      throw new Error(`Failed to save maintenance task: ${error.message}`)
    }

    console.log("[v0] ✅ Maintenance task saved to Supabase:", task.id)
    return true
  } catch (error) {
    console.error("[v0] Exception saving maintenance task:", error)
    return false
  }
}

function maintenanceTaskToDatabase(task: MaintenanceTask): any {
  return {
    id: task.id,
    schedule_id: task.schedule_id,
    task_type: task.task_type,
    room_number: task.room_number || null,
    ac_location: task.location,
    status: task.status,
    assigned_to: task.assigned_to || null,
    started_at: task.started_at ? { client: task.started_at, server: new Date().toISOString() } : null,
    completed_at: task.completed_at ? { client: task.completed_at, server: new Date().toISOString() } : null,
    timer_duration: task.timer_duration ? { client: task.timer_duration, server: task.timer_duration } : null,
    photos: task.categorized_photos || task.photos || [],
    period_month: task.period_month,
    period_year: task.period_year,
    created_at: task.created_at,
  }
}

function databaseToMaintenanceTask(dbTask: any): MaintenanceTask {
  return {
    id: dbTask.id,
    schedule_id: dbTask.schedule_id,
    task_type: dbTask.task_type,
    room_number: dbTask.room_number || undefined,
    location: dbTask.ac_location || "",
    description: `${dbTask.task_type} - ${dbTask.room_number || "N/A"}`,
    status: dbTask.status,
    assigned_to: dbTask.assigned_to || undefined,
    started_at: dbTask.started_at?.client || dbTask.started_at || undefined,
    completed_at: dbTask.completed_at?.client || dbTask.completed_at || undefined,
    timer_duration: dbTask.timer_duration?.client || dbTask.timer_duration || undefined,
    photos: Array.isArray(dbTask.photos) ? dbTask.photos : [],
    categorized_photos: typeof dbTask.photos === "object" && !Array.isArray(dbTask.photos) ? dbTask.photos : undefined,
    period_month: dbTask.period_month,
    period_year: dbTask.period_year,
    created_at: dbTask.created_at,
  }
}
