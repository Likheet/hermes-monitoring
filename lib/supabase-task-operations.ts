import { createClient } from "@/lib/supabase/client"
import type { Task, User, ShiftSchedule } from "./types"
import type { MaintenanceSchedule, MaintenanceTask } from "./maintenance-types"

// Helper functions to convert between app format and database format
function taskToDatabase(task: Task): any {
  return {
    id: task.id,
    task_type: task.task_type,
    priority_level: task.priority_level,
    status: task.status,
    assigned_to_user_id: task.assigned_to_user_id,
    assigned_by_user_id: task.assigned_by_user_id,
    assigned_at_client: task.assigned_at.client,
    assigned_at_server: task.assigned_at.server,
    started_at_client: task.started_at?.client || null,
    started_at_server: task.started_at?.server || null,
    completed_at_client: task.completed_at?.client || null,
    completed_at_server: task.completed_at?.server || null,
    expected_duration_minutes: task.expected_duration_minutes,
    actual_duration_minutes: task.actual_duration_minutes,
    photo_url: task.photo_urls?.[0] || null, // Store first photo URL for backward compatibility
    photo_required: task.photo_required,
    worker_remark: task.worker_remark,
    supervisor_remark: task.supervisor_remark,
    room_number: task.room_number,
    delay_reason: task.pause_history?.length > 0 ? task.pause_history[task.pause_history.length - 1].reason : null,
    timer_validation_flags: {
      pause_history: task.pause_history,
      audit_log: task.audit_log,
      categorized_photos: task.categorized_photos,
      photo_categories: task.photo_categories,
      is_custom_task: task.is_custom_task,
      custom_task_name: task.custom_task_name,
      rejection_acknowledged: task.rejection_acknowledged,
    },
    created_at: task.assigned_at.server,
  }
}

function databaseToTask(dbTask: any): Task {
  const timerFlags = dbTask.timer_validation_flags || {}

  return {
    id: dbTask.id,
    task_type: dbTask.task_type,
    priority_level: dbTask.priority_level,
    status: dbTask.status,
    department: dbTask.department || "housekeeping",
    assigned_to_user_id: dbTask.assigned_to_user_id,
    assigned_by_user_id: dbTask.assigned_by_user_id,
    assigned_at: {
      client: dbTask.assigned_at_client,
      server: dbTask.assigned_at_server,
    },
    started_at: dbTask.started_at_client
      ? { client: dbTask.started_at_client, server: dbTask.started_at_server }
      : null,
    completed_at: dbTask.completed_at_client
      ? { client: dbTask.completed_at_client, server: dbTask.completed_at_server }
      : null,
    expected_duration_minutes: dbTask.expected_duration_minutes,
    actual_duration_minutes: dbTask.actual_duration_minutes,
    photo_urls: dbTask.photo_url ? [dbTask.photo_url] : [],
    categorized_photos: timerFlags.categorized_photos || null,
    photo_required: dbTask.photo_required || false,
    photo_count: timerFlags.photo_count || null,
    photo_documentation_required: timerFlags.photo_documentation_required || false,
    photo_categories: timerFlags.photo_categories || null,
    worker_remark: dbTask.worker_remark || "",
    supervisor_remark: dbTask.supervisor_remark || "",
    rating: null,
    quality_comment: null,
    rating_proof_photo_url: null,
    rejection_proof_photo_url: null,
    room_number: dbTask.room_number,
    pause_history: timerFlags.pause_history || [],
    audit_log: timerFlags.audit_log || [],
    is_custom_task: timerFlags.is_custom_task || false,
    custom_task_name: timerFlags.custom_task_name || null,
    custom_task_category: timerFlags.custom_task_category || null,
    custom_task_priority: timerFlags.custom_task_priority || null,
    custom_task_photo_required: timerFlags.custom_task_photo_required || null,
    custom_task_photo_count: timerFlags.custom_task_photo_count || null,
    custom_task_processed: timerFlags.custom_task_processed || false,
    rejection_acknowledged: timerFlags.rejection_acknowledged || false,
    rejection_acknowledged_at: timerFlags.rejection_acknowledged_at || null,
  }
}

function maintenanceTaskToDatabase(task: MaintenanceTask): any {
  return {
    id: task.id,
    schedule_id: task.schedule_id,
    task_type: task.task_type,
    room_number: task.room_number || null,
    ac_location: task.location, // Map 'location' to 'ac_location' column
    status: task.status,
    assigned_to: task.assigned_to || null,
    started_at: task.started_at || null,
    completed_at: task.completed_at || null,
    timer_duration: task.timer_duration || null,
    photos: task.categorized_photos || task.photos || [], // Store photos as JSONB
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
    description: `${dbTask.task_type} - ${dbTask.room_number || "N/A"}`, // Generate description from available data
    status: dbTask.status,
    assigned_to: dbTask.assigned_to || undefined,
    started_at: dbTask.started_at || undefined,
    completed_at: dbTask.completed_at || undefined,
    timer_duration: dbTask.timer_duration || undefined,
    photos: Array.isArray(dbTask.photos) ? dbTask.photos : [],
    categorized_photos: typeof dbTask.photos === "object" && !Array.isArray(dbTask.photos) ? dbTask.photos : undefined,
    period_month: dbTask.period_month,
    period_year: dbTask.period_year,
    created_at: dbTask.created_at,
  }
}

export async function loadTasksFromSupabase(): Promise<Task[]> {
  const supabase = createClient()
  const { data, error } = await supabase.from("tasks").select("*").order("created_at", { ascending: false })

  if (error) {
    console.error("[v0] Error loading tasks from Supabase:", error)
    return []
  }

  return (data || []).map(databaseToTask)
}

export async function loadUsersFromSupabase(): Promise<User[]> {
  const supabase = createClient()
  const { data, error } = await supabase.from("users").select("*").order("name", { ascending: true })

  if (error) {
    console.error("[v0] Error loading users from Supabase:", error)
    return []
  }

  return (data || []).map((dbUser: any) => ({
    id: dbUser.id,
    name: dbUser.name,
    role: dbUser.role,
    phone: dbUser.phone || "",
    department: dbUser.department,
    shift_start: "08:00", // Default values - these should come from shift_schedules
    shift_end: "16:00",
    has_break: false,
    is_available: true,
  }))
}

export async function saveTaskToSupabase(task: Task): Promise<boolean> {
  const supabase = createClient()
  const dbTask = taskToDatabase(task)
  const { error } = await supabase.from("tasks").upsert(dbTask)

  if (error) {
    console.error("[v0] Error saving task to Supabase:", error)
    return false
  }

  console.log("[v0] ✅ Task saved to Supabase:", task.id)
  return true
}

export async function saveUserToSupabase(user: User): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from("users").upsert(user)

  if (error) {
    console.error("[v0] Error saving user to Supabase:", error)
    return false
  }

  return true
}

export async function loadShiftSchedulesFromSupabase(): Promise<ShiftSchedule[]> {
  const supabase = createClient()
  const { data, error } = await supabase.from("shift_schedules").select("*").order("schedule_date", { ascending: true })

  if (error) {
    console.error("[v0] Error loading shift schedules from Supabase:", error)
    return []
  }

  return data || []
}

export async function saveShiftScheduleToSupabase(schedule: ShiftSchedule): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from("shift_schedules").upsert(schedule)

  if (error) {
    console.error("[v0] Error saving shift schedule to Supabase:", error)
    return false
  }

  return true
}

export async function deleteShiftScheduleFromSupabase(scheduleId: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from("shift_schedules").delete().eq("id", scheduleId)

  if (error) {
    console.error("[v0] Error deleting shift schedule from Supabase:", error)
    return false
  }

  return true
}

export async function loadMaintenanceSchedulesFromSupabase(): Promise<MaintenanceSchedule[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("maintenance_schedules")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[v0] Error loading maintenance schedules from Supabase:", error)
    return []
  }

  return data || []
}

export async function saveMaintenanceScheduleToSupabase(schedule: MaintenanceSchedule): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from("maintenance_schedules").upsert(schedule)

  if (error) {
    console.error("[v0] Error saving maintenance schedule to Supabase:", error)
    return false
  }

  return true
}

export async function deleteMaintenanceScheduleFromSupabase(scheduleId: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from("maintenance_schedules").delete().eq("id", scheduleId)

  if (error) {
    console.error("[v0] Error deleting maintenance schedule from Supabase:", error)
    return false
  }

  return true
}

export async function loadMaintenanceTasksFromSupabase(): Promise<MaintenanceTask[]> {
  const supabase = createClient()
  const { data, error } = await supabase.from("maintenance_tasks").select("*").order("created_at", { ascending: false })

  if (error) {
    console.error("[v0] Error loading maintenance tasks from Supabase:", error)
    return []
  }

  return (data || []).map(databaseToMaintenanceTask)
}

export async function saveMaintenanceTaskToSupabase(task: MaintenanceTask): Promise<boolean> {
  const supabase = createClient()
  const dbTask = maintenanceTaskToDatabase(task)
  const { error } = await supabase.from("maintenance_tasks").upsert(dbTask)

  if (error) {
    console.error("[v0] Error saving maintenance task to Supabase:", error)
    return false
  }

  return true
}
