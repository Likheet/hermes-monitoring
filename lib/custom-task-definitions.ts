import type {
  TaskCategory,
  Priority,
  TaskDefinition,
  RecurringFrequency,
  Department,
} from "./task-definitions"
import { TASK_DEFINITIONS } from "./task-definitions"
import { createClient } from "./supabase/client"

export interface CustomTaskDefinition extends TaskDefinition {
  isCustom: true
  createdBy: string
  createdAt: string
}

type CustomTaskRow = {
  id: string
  task_type: string
  custom_task_name: string | null
  custom_task_category: TaskCategory | null
  custom_task_priority: Priority | null
  custom_task_photo_required: boolean | null
  custom_task_photo_count: number | null
  created_at: string
  assigned_by_user_id: string | null
  department: string | null
  custom_task_is_recurring: boolean | null
  custom_task_recurring_frequency: string | null
  custom_task_requires_specific_time: boolean | null
  custom_task_recurring_time: string | null
  custom_task_recurring_days: string[] | null
}

const VALID_DEPARTMENTS: Department[] = [
  "housekeeping",
  "maintenance",
  "housekeeping-dept",
  "maintenance-dept",
  "admin",
]

const VALID_RECURRING_FREQUENCIES: RecurringFrequency[] = [
  "daily",
  "weekly",
  "biweekly",
  "monthly",
  "custom",
]

const isDepartment = (value: string | null): value is Department =>
  Boolean(value && VALID_DEPARTMENTS.includes(value as Department))

const normalizeDepartment = (value: string | null): Department =>
  isDepartment(value) ? value : "housekeeping"

const toRecurringFrequency = (value: string | null): RecurringFrequency | undefined => {
  if (!value) return undefined
  const normalized = value.toLowerCase() as RecurringFrequency
  return VALID_RECURRING_FREQUENCIES.includes(normalized) ? normalized : undefined
}

const toRecurringDays = (value: string[] | null): string[] | undefined => {
  if (!value) return undefined
  const filtered = value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
  return filtered.length > 0 ? filtered : undefined
}

const buildRecurringDatabaseFields = (input: {
  isRecurring?: boolean
  recurringFrequency?: RecurringFrequency | null
  requiresSpecificTime?: boolean | null
  recurringTime?: string | null
  recurringDays?: string[] | null
}): {
  custom_task_is_recurring: boolean
  custom_task_recurring_frequency: string | null
  custom_task_requires_specific_time: boolean
  custom_task_recurring_time: string | null
  custom_task_recurring_days: string[] | null
} => {
  const isRecurring = Boolean(input.isRecurring)
  const frequency = isRecurring ? input.recurringFrequency ?? null : null
  const requiresSpecificTime = isRecurring ? Boolean(input.requiresSpecificTime) : false
  const recurringTime = isRecurring && requiresSpecificTime ? input.recurringTime ?? null : null
  const recurringDays =
    isRecurring && Array.isArray(input.recurringDays) && input.recurringDays.length > 0
      ? input.recurringDays
      : null

  return {
    custom_task_is_recurring: isRecurring,
    custom_task_recurring_frequency: frequency,
    custom_task_requires_specific_time: requiresSpecificTime,
    custom_task_recurring_time: recurringTime,
    custom_task_recurring_days: recurringDays,
  }
}

export async function getCustomTaskDefinitions(): Promise<CustomTaskDefinition[]> {
  if (typeof window === "undefined") return []

  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("tasks")
      .select(
        "id, task_type, custom_task_name, custom_task_category, custom_task_priority, custom_task_photo_required, custom_task_photo_count, created_at, assigned_by_user_id, department, custom_task_is_recurring, custom_task_recurring_frequency, custom_task_requires_specific_time, custom_task_recurring_time, custom_task_recurring_days",
      )
      .eq("is_custom_task", true)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error loading custom task definitions from database:", error)
      // Fallback to localStorage for backward compatibility
      return getCustomTaskDefinitionsFromLocalStorage()
    }

    if (!data || data.length === 0) {
      // Fallback to localStorage for backward compatibility
      return getCustomTaskDefinitionsFromLocalStorage()
    }

    // Convert database records to CustomTaskDefinition format
  const rows = (data ?? []) as CustomTaskRow[]

  const customTasks: CustomTaskDefinition[] = rows.map((task) => ({
      id: `custom-db-${task.id}`,
      name: task.custom_task_name || task.task_type,
      category: task.custom_task_category ?? "GUEST_REQUEST",
      priority: task.custom_task_priority ?? "medium",
      department: normalizeDepartment(task.department),
      duration: 30, // Default duration
      photoRequired: task.custom_task_photo_required || false,
      photoCount: task.custom_task_photo_count || 1,
      photoDocumentationRequired: false,
      photoCategories: undefined,
      keywords: [],
      requiresRoom: true,
      requiresACLocation: false,
      isRecurring: Boolean(task.custom_task_is_recurring),
      recurringFrequency: toRecurringFrequency(task.custom_task_recurring_frequency),
      requiresSpecificTime: Boolean(task.custom_task_requires_specific_time),
      recurringTime:
        task.custom_task_is_recurring && task.custom_task_requires_specific_time
          ? task.custom_task_recurring_time ?? undefined
          : undefined,
      recurringDays: toRecurringDays(task.custom_task_recurring_days),
      isCustom: true,
      createdBy: task.assigned_by_user_id ?? "unknown",
      createdAt: task.created_at,
    }))

    // Also check localStorage for any locally saved custom tasks that haven't been migrated yet
    const localTasks = getCustomTaskDefinitionsFromLocalStorage()
    if (localTasks.length > 0) {
      // Merge local and database tasks, prioritizing database tasks
      const mergedTasks = [...customTasks]
      for (const localTask of localTasks) {
        if (!mergedTasks.some(task => task.name === localTask.name)) {
          mergedTasks.push(localTask)
          // Migrate this local task to the database
          await migrateLocalTaskToDatabase(localTask)
        }
      }
      return mergedTasks
    }

    return customTasks
  } catch (error) {
    console.error("Error loading custom task definitions:", error)
    // Fallback to localStorage for backward compatibility
    return getCustomTaskDefinitionsFromLocalStorage()
  }
}

// Helper function for backward compatibility
function getCustomTaskDefinitionsFromLocalStorage(): CustomTaskDefinition[] {
  if (typeof window === "undefined") return []

  const stored = localStorage.getItem("custom_task_definitions")
  if (!stored) return []

  try {
    return JSON.parse(stored)
  } catch (error) {
    console.error("Error loading custom task definitions from localStorage:", error)
    return []
  }
}

// Helper function to migrate local tasks to database
async function migrateLocalTaskToDatabase(task: CustomTaskDefinition): Promise<void> {
  try {
    const supabase = createClient()
    
    // Create a sample task in the database to represent this custom task type
    const { error } = await supabase.from("tasks").insert({
      task_type: task.name,
      status: "pending",
      is_custom_task: true,
      custom_task_name: task.name,
      custom_task_category: task.category,
      custom_task_priority: task.priority,
      custom_task_photo_required: task.photoRequired,
      custom_task_photo_count: task.photoCount,
      assigned_by_user_id: task.createdBy,
      assigned_to_user_id: null, // Unassigned
      priority_level: task.priority,
      department: task.department,
      ...buildRecurringDatabaseFields({
        isRecurring: task.isRecurring,
        recurringFrequency: task.recurringFrequency ?? null,
        requiresSpecificTime: task.requiresSpecificTime ?? null,
        recurringTime: task.recurringTime ?? null,
        recurringDays: task.recurringDays ?? null,
      }),
      created_at: task.createdAt,
      updated_at: task.createdAt,
    })

    if (error) {
      console.error("Error migrating local task to database:", error)
    }
  } catch (error) {
    console.error("Exception migrating local task to database:", error)
  }
}

export async function saveCustomTaskDefinition(
  taskDef: Omit<CustomTaskDefinition, "id" | "isCustom" | "createdAt"> & { id?: string },
): Promise<CustomTaskDefinition> {
  // If an ID is provided and it's a built-in task, use that ID (override)
  // Otherwise, generate a new ID
  const taskId =
    taskDef.id && isBuiltInTaskId(taskDef.id)
      ? taskDef.id
      : `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

  const newTask: CustomTaskDefinition = {
    ...taskDef,
    id: taskId,
    isCustom: true,
    createdAt: new Date().toISOString(),
  }

  try {
    const supabase = createClient()
    
    // Save to database as a template task
    const { error } = await supabase.from("tasks").insert({
      task_type: newTask.name,
      status: "pending",
      is_custom_task: true,
      custom_task_name: newTask.name,
      custom_task_category: newTask.category,
      custom_task_priority: newTask.priority,
      custom_task_photo_required: newTask.photoRequired,
      custom_task_photo_count: newTask.photoCount,
      assigned_by_user_id: newTask.createdBy,
      assigned_to_user_id: null, // Unassigned template
      priority_level: newTask.priority,
      department: newTask.department,
      ...buildRecurringDatabaseFields({
        isRecurring: newTask.isRecurring,
        recurringFrequency: newTask.recurringFrequency ?? null,
        requiresSpecificTime: newTask.requiresSpecificTime ?? null,
        recurringTime: newTask.recurringTime ?? null,
        recurringDays: newTask.recurringDays ?? null,
      }),
      created_at: newTask.createdAt,
      updated_at: newTask.createdAt,
    })

    if (error) {
      console.error("Error saving custom task definition to database:", error)
      throw error
    }

    // Also save to localStorage for backward compatibility
    saveCustomTaskDefinitionToLocalStorage(newTask)
    
    window.dispatchEvent(new Event("customTasksUpdated"))
    
    return newTask
  } catch (error) {
    console.error("Error saving custom task definition:", error)
    // Fallback to localStorage
    const localTask = saveCustomTaskDefinitionToLocalStorage(newTask)
    window.dispatchEvent(new Event("customTasksUpdated"))
    return localTask
  }
}

// Helper function for backward compatibility
function saveCustomTaskDefinitionToLocalStorage(
  taskDef: CustomTaskDefinition,
): CustomTaskDefinition {
  const existing = getCustomTaskDefinitionsFromLocalStorage()

  // Check if we're overriding an existing custom task
  const existingIndex = existing.findIndex((task) => task.id === taskDef.id)

  let updated: CustomTaskDefinition[]
  if (existingIndex !== -1) {
    // Update existing custom task
    updated = [...existing.slice(0, existingIndex), taskDef, ...existing.slice(existingIndex + 1)]
  } else {
    // Add new custom task
    updated = [...existing, taskDef]
  }

  localStorage.setItem("custom_task_definitions", JSON.stringify(updated))
  return taskDef
}

export async function updateCustomTaskDefinition(
  id: string,
  updates: Partial<CustomTaskDefinition>,
): Promise<CustomTaskDefinition | null> {
  try {
    const supabase = createClient()

    // Extract database UUID from custom-db-{uuid} format
    const dbId = id.startsWith('custom-db-') ? id.replace('custom-db-', '') : id

    const recurringPayloadProvided =
      updates.isRecurring !== undefined ||
      updates.recurringFrequency !== undefined ||
      updates.requiresSpecificTime !== undefined ||
      updates.recurringTime !== undefined ||
      updates.recurringDays !== undefined

    const updatePayload: Record<string, unknown> = {
      custom_task_name: updates.name,
      custom_task_category: updates.category,
      custom_task_priority: updates.priority,
      custom_task_photo_required: updates.photoRequired,
      custom_task_photo_count: updates.photoCount,
      updated_at: new Date().toISOString(),
    }

    if (updates.department !== undefined) {
      updatePayload.department = updates.department
    }

    if (recurringPayloadProvided) {
      Object.assign(
        updatePayload,
        buildRecurringDatabaseFields({
          isRecurring: updates.isRecurring,
          recurringFrequency: updates.recurringFrequency ?? null,
          requiresSpecificTime: updates.requiresSpecificTime ?? null,
          recurringTime: updates.recurringTime ?? null,
          recurringDays: updates.recurringDays ?? null,
        }),
      )
    }

    // Update in database
    const { error } = await supabase
      .from("tasks")
      .update(updatePayload)
      .eq("id", dbId)
      .eq("is_custom_task", true)

    if (error) {
      console.error("Error updating custom task definition in database:", error)
      throw error
    }

    // Also update in localStorage for backward compatibility
    const updatedTask = updateCustomTaskDefinitionInLocalStorage(id, updates)

    window.dispatchEvent(new Event("customTasksUpdated"))

    return updatedTask
  } catch (error) {
    console.error("Error updating custom task definition:", error)
    // Fallback to localStorage
    const updatedTask = updateCustomTaskDefinitionInLocalStorage(id, updates)
    window.dispatchEvent(new Event("customTasksUpdated"))
    return updatedTask
  }
}

// Helper function for backward compatibility
function updateCustomTaskDefinitionInLocalStorage(
  id: string,
  updates: Partial<CustomTaskDefinition>,
): CustomTaskDefinition | null {
  const existing = getCustomTaskDefinitionsFromLocalStorage()
  const taskIndex = existing.findIndex((task) => task.id === id)

  if (taskIndex === -1) {
    console.error("Task not found:", id)
    return null
  }

  const updatedTask = { ...existing[taskIndex], ...updates }
  const updated = [...existing.slice(0, taskIndex), updatedTask, ...existing.slice(taskIndex + 1)]

  localStorage.setItem("custom_task_definitions", JSON.stringify(updated))
  return updatedTask
}

export async function deleteCustomTaskDefinition(id: string): Promise<void> {
  try {
    const supabase = createClient()

    // Extract database UUID from custom-db-{uuid} format
    const dbId = id.startsWith('custom-db-') ? id.replace('custom-db-', '') : id

    // Delete from database
    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", dbId)
      .eq("is_custom_task", true)

    if (error) {
      console.error("Error deleting custom task definition from database:", error)
      throw error
    }

    // Also delete from localStorage for backward compatibility
    deleteCustomTaskDefinitionFromLocalStorage(id)

    window.dispatchEvent(new Event("customTasksUpdated"))
  } catch (error) {
    console.error("Error deleting custom task definition:", error)
    // Fallback to localStorage
    deleteCustomTaskDefinitionFromLocalStorage(id)
    window.dispatchEvent(new Event("customTasksUpdated"))
  }
}

// Helper function for backward compatibility
function deleteCustomTaskDefinitionFromLocalStorage(id: string): void {
  const existing = getCustomTaskDefinitionsFromLocalStorage()
  const updated = existing.filter((task) => task.id !== id)

  localStorage.setItem("custom_task_definitions", JSON.stringify(updated))
}

export async function getAllTaskDefinitions(): Promise<(TaskDefinition | CustomTaskDefinition)[]> {
  const customTasks = await getCustomTaskDefinitions()

  // Create a map of custom tasks by ID for quick lookup
  const customTaskMap = new Map(customTasks.map((task) => [task.id, task]))

  // Filter out built-in tasks that have been overridden by custom tasks
  const nonOverriddenBuiltInTasks = TASK_DEFINITIONS.filter((task) => !customTaskMap.has(task.id))

  // Return non-overridden built-in tasks + all custom tasks
  return [...nonOverriddenBuiltInTasks, ...customTasks]
}

export function isBuiltInTaskId(id: string): boolean {
  return TASK_DEFINITIONS.some((task) => task.id === id)
}
