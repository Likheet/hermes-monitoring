import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { databaseTaskToApp } from "@/lib/database-types"
import type { PauseRecord } from "@/lib/types"

const PRIORITY_APP_TO_DB: Record<string, "low" | "medium" | "high" | "urgent"> = {
  GUEST_REQUEST: "medium",
  TIME_SENSITIVE: "urgent",
  DAILY_TASK: "low",
  PREVENTIVE_MAINTENANCE: "high",
}

function toDualTimestamp() {
  const iso = new Date().toISOString()
  return { client: iso, server: iso }
}

function normalizeStatus(status: unknown) {
  if (typeof status !== "string") return null

  const lower = status.toLowerCase()
  switch (lower) {
    case "pending":
    case "assigned":
    case "in_progress":
    case "paused":
    case "completed":
    case "verified":
    case "rejected":
      return lower
    default:
      return null
  }
}

function normalizePriority(priority: unknown) {
  if (priority === null) return null
  if (typeof priority !== "string") return null

  const upper = priority.toUpperCase()
  if (upper in PRIORITY_APP_TO_DB) {
    return PRIORITY_APP_TO_DB[upper]
  }

  const lower = priority.toLowerCase()
  if (lower === "low" || lower === "medium" || lower === "high" || lower === "urgent") {
    return lower as "low" | "medium" | "high" | "urgent"
  }

  return null
}

function toAppStatus(status: string | null | undefined) {
  if (!status) return null
  switch (status.toLowerCase()) {
    case "pending":
    case "assigned":
      return "PENDING"
    case "in_progress":
      return "IN_PROGRESS"
    case "paused":
      return "PAUSED"
    case "completed":
    case "verified":
      return "COMPLETED"
    case "rejected":
      return "REJECTED"
    default:
      return status.toUpperCase()
  }
}

interface TaskUpdatePayload {
  task_type?: string
  room_number?: string | null
  status?: string | null
  priority_level?: string | null
  assigned_to_user_id?: string | null
  assigned_by_user_id?: string | null
  assigned_at?: unknown
  started_at?: unknown
  completed_at?: unknown
  verified_at?: unknown
  verified_by_user_id?: string | null
  expected_duration_minutes?: number | null
  actual_duration_minutes?: number | null
  worker_remark?: string | null
  supervisor_remark?: string | null
  rating?: number | null
  requires_verification?: boolean
  timer_validation_flag?: boolean
  description?: string | null
  special_instructions?: string | null
  photo_documentation_required?: boolean
  photo_required?: boolean
  photo_categories?: unknown
  photo_count?: number | null
  photo_requirements?: unknown
  pause_history?: PauseRecord[] | null
  audit_log?: unknown
  categorized_photos?: unknown
  rejection_proof_photo_url?: string | null
  rating_proof_photo_url?: string | null
  custom_task_name?: string | null
  custom_task_category?: string | null
  custom_task_priority?: string | null
  custom_task_photo_required?: boolean | null
  custom_task_photo_count?: number | null
  custom_task_is_recurring?: boolean | null
  custom_task_recurring_frequency?: string | null
  custom_task_requires_specific_time?: boolean | null
  custom_task_recurring_time?: string | null
  [key: string]: unknown
}

interface TaskUpdatePatch {
  task_type?: string
  room_number?: string | null
  status?: string
  priority_level?: "low" | "medium" | "high" | "urgent" | null
  assigned_to_user_id?: string | null
  assigned_by_user_id?: string | null
  assigned_at?: unknown
  started_at?: unknown
  completed_at?: unknown
  verified_at?: unknown
  verified_by_user_id?: string | null
  estimated_duration?: number | null
  actual_duration?: number | null
  worker_remarks?: string | null
  supervisor_remarks?: string | null
  quality_rating?: number | null
  requires_verification?: boolean
  timer_validation_flag?: boolean
  description?: string | null
  special_instructions?: string | null
  categorized_photos?: unknown
  pause_history?: PauseRecord[] | []
  audit_log?: unknown
  photo_requirements?: unknown
  rejection_proof_photo_url?: string | null
  rating_proof_photo_url?: string | null
  custom_task_name?: string | null
  custom_task_category?: string | null
  custom_task_priority?: string | null
  custom_task_photo_required?: boolean | null
  custom_task_photo_count?: number | null
  custom_task_is_recurring?: boolean | null
  custom_task_recurring_frequency?: string | null
  custom_task_requires_specific_time?: boolean | null
  custom_task_recurring_time?: string | null
}

function buildPhotoRequirementsUpdate(body: TaskUpdatePayload) {
  const hasDocFlag = Object.prototype.hasOwnProperty.call(body, "photo_documentation_required")
  const hasSimpleFlag = Object.prototype.hasOwnProperty.call(body, "photo_required")
  const hasCategories = Object.prototype.hasOwnProperty.call(body, "photo_categories")
  const hasCount = Object.prototype.hasOwnProperty.call(body, "photo_count")

  if (!hasDocFlag && !hasSimpleFlag && !hasCategories && !hasCount) {
    return null
  }

  if (body.photo_documentation_required) {
    const categories = Array.isArray(body.photo_categories) ? body.photo_categories : []
    return {
      photoRequirements: categories,
      requiresVerification: true,
    }
  }

  if (body.photo_required) {
    const count = typeof body.photo_count === "number" ? body.photo_count : null
    return {
      photoRequirements: {
        simple: {
          required: true,
          count,
        },
      },
      requiresVerification: true,
    }
  }

  return {
    photoRequirements: [],
    requiresVerification: false,
  }
}

function normalizePhotoRequirementsInput(value: unknown) {
  if (Array.isArray(value)) {
    return value
  }

  if (value && typeof value === "object") {
    return value
  }

  return []
}

function mapTaskUpdates(body: TaskUpdatePayload): TaskUpdatePatch {
  const updates: TaskUpdatePatch = {}

  if (typeof body.task_type === "string") {
    updates.task_type = body.task_type
  }

  if (Object.prototype.hasOwnProperty.call(body, "room_number")) {
    updates.room_number = body.room_number ?? null
  }

  if (Object.prototype.hasOwnProperty.call(body, "status")) {
    const normalized = normalizeStatus(body.status)
    if (normalized) {
      updates.status = normalized
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, "priority_level")) {
    if (body.priority_level === null) {
      updates.priority_level = null
    } else {
      const normalized = normalizePriority(body.priority_level)
      if (normalized) {
        updates.priority_level = normalized
      }
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, "assigned_to_user_id")) {
    updates.assigned_to_user_id = body.assigned_to_user_id || null
  }

  if (Object.prototype.hasOwnProperty.call(body, "assigned_by_user_id")) {
    updates.assigned_by_user_id = body.assigned_by_user_id || null
  }

  if (Object.prototype.hasOwnProperty.call(body, "assigned_at")) {
    updates.assigned_at = body.assigned_at ?? null
  }

  if (Object.prototype.hasOwnProperty.call(body, "started_at")) {
    updates.started_at = body.started_at ?? null
  }

  if (Object.prototype.hasOwnProperty.call(body, "completed_at")) {
    updates.completed_at = body.completed_at ?? null
  }

  if (Object.prototype.hasOwnProperty.call(body, "verified_at")) {
    updates.verified_at = body.verified_at ?? null
  }

  if (Object.prototype.hasOwnProperty.call(body, "verified_by_user_id")) {
    updates.verified_by_user_id = body.verified_by_user_id || null
  }

  if (Object.prototype.hasOwnProperty.call(body, "expected_duration_minutes")) {
    if (typeof body.expected_duration_minutes === "number") {
  updates.estimated_duration = body.expected_duration_minutes
    } else if (body.expected_duration_minutes === null) {
      updates.estimated_duration = null
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, "actual_duration_minutes")) {
    if (typeof body.actual_duration_minutes === "number") {
  updates.actual_duration = body.actual_duration_minutes
    } else if (body.actual_duration_minutes === null) {
      updates.actual_duration = null
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, "worker_remark")) {
  updates.worker_remarks = body.worker_remark ?? null
  }

  if (Object.prototype.hasOwnProperty.call(body, "supervisor_remark")) {
  updates.supervisor_remarks = body.supervisor_remark ?? null
  }

  if (Object.prototype.hasOwnProperty.call(body, "rating")) {
  updates.quality_rating = typeof body.rating === "number" ? body.rating : null
  }

  if (Object.prototype.hasOwnProperty.call(body, "requires_verification")) {
    updates.requires_verification = Boolean(body.requires_verification)
  }

  if (Object.prototype.hasOwnProperty.call(body, "timer_validation_flag")) {
    updates.timer_validation_flag = Boolean(body.timer_validation_flag)
  }

  if (Object.prototype.hasOwnProperty.call(body, "description")) {
    updates.description = body.description ?? null
  }

  if (Object.prototype.hasOwnProperty.call(body, "special_instructions")) {
    updates.special_instructions = body.special_instructions ?? null
  }

  if (Object.prototype.hasOwnProperty.call(body, "categorized_photos")) {
    updates.categorized_photos = body.categorized_photos ?? { room_photos: [], proof_photos: [] }
  }

  if (Object.prototype.hasOwnProperty.call(body, "pause_history")) {
    updates.pause_history = body.pause_history ?? []
  }

  if (Object.prototype.hasOwnProperty.call(body, "audit_log")) {
    updates.audit_log = Array.isArray(body.audit_log) ? body.audit_log : []
  }

  if (Object.prototype.hasOwnProperty.call(body, "photo_requirements")) {
    const normalizedPhotoRequirements = normalizePhotoRequirementsInput(body.photo_requirements)
    updates.photo_requirements = normalizedPhotoRequirements

    const shouldClearRequirements =
      body.photo_requirements === null || (Array.isArray(normalizedPhotoRequirements) && normalizedPhotoRequirements.length === 0)

    if (shouldClearRequirements && !Object.prototype.hasOwnProperty.call(body, "requires_verification")) {
      updates.requires_verification = false
    }
  } else {
  const photoUpdate = buildPhotoRequirementsUpdate(body)
    if (photoUpdate) {
      updates.photo_requirements = photoUpdate.photoRequirements
      if (typeof photoUpdate.requiresVerification === "boolean") {
        updates.requires_verification = photoUpdate.requiresVerification
      }
    }
  }

  return updates
}

// GET single task
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get("session")

    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const supabase = await createClient()

    const { data: task, error } = await supabase.from("tasks").select("*").eq("id", id).single()

    if (error) {
      console.error("Task fetch error:", error)
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    const appTask = databaseTaskToApp(task)

    return NextResponse.json({ task: appTask }, { status: 200 })
  } catch (error) {
    console.error("Task GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PATCH update task
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get("session")

    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = sessionCookie.value
    const { id } = await params
    const supabase = await createClient()
  const body = (await request.json()) as TaskUpdatePayload

    // Get current task
    const { data: currentTask } = await supabase.from("tasks").select("*").eq("id", id).single()

    if (!currentTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

  const updates = mapTaskUpdates(body)

    if (Object.prototype.hasOwnProperty.call(body, "status") && !Object.prototype.hasOwnProperty.call(updates, "status")) {
      return NextResponse.json({ error: "Invalid status value" }, { status: 400 })
    }

    const statusChanged =
      Object.prototype.hasOwnProperty.call(updates, "status") && updates.status && updates.status !== currentTask.status

    if (statusChanged) {
      const baseAuditLog = Array.isArray(updates.audit_log)
        ? [...updates.audit_log]
        : Array.isArray(currentTask.audit_log)
          ? [...currentTask.audit_log]
          : []

      const oldStatus = toAppStatus(currentTask.status)
      const newStatus = toAppStatus(updates.status)

      baseAuditLog.push({
        user_id: userId,
        action: "STATUS_CHANGED",
        old_status: oldStatus,
        new_status: newStatus,
        timestamp: toDualTimestamp(),
        details: `Status changed from ${oldStatus ?? "UNKNOWN"} to ${newStatus ?? "UNKNOWN"}`,
      })

      updates.audit_log = baseAuditLog
    }

    if (Object.keys(updates).length === 0) {
      const appTask = databaseTaskToApp(currentTask)
      return NextResponse.json({ task: appTask }, { status: 200 })
    }

    const { data: task, error } = await supabase.from("tasks").update(updates).eq("id", id).select().single()

    if (error) {
      console.error("Task update error:", error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const appTask = databaseTaskToApp(task)
    return NextResponse.json({ task: appTask }, { status: 200 })
  } catch (error) {
    console.error("Task PATCH error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
