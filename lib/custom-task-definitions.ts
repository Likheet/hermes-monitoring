import type { TaskDefinition } from "./task-definitions"
import { TASK_DEFINITIONS } from "./task-definitions"

export interface CustomTaskDefinition extends TaskDefinition {
  isCustom: true
  createdBy: string
  createdAt: string
}

export function getCustomTaskDefinitions(): CustomTaskDefinition[] {
  if (typeof window === "undefined") return []

  const stored = localStorage.getItem("custom_task_definitions")
  if (!stored) return []

  try {
    return JSON.parse(stored)
  } catch (error) {
    console.error("Error loading custom task definitions:", error)
    return []
  }
}

export function saveCustomTaskDefinition(
  taskDef: Omit<CustomTaskDefinition, "id" | "isCustom" | "createdAt"> & { id?: string },
): CustomTaskDefinition {
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

  const existing = getCustomTaskDefinitions()

  // Check if we're overriding an existing custom task
  const existingIndex = existing.findIndex((task) => task.id === taskId)

  let updated: CustomTaskDefinition[]
  if (existingIndex !== -1) {
    // Update existing custom task
    updated = [...existing.slice(0, existingIndex), newTask, ...existing.slice(existingIndex + 1)]
  } else {
    // Add new custom task
    updated = [...existing, newTask]
  }

  localStorage.setItem("custom_task_definitions", JSON.stringify(updated))

  window.dispatchEvent(new Event("customTasksUpdated"))

  return newTask
}

export function updateCustomTaskDefinition(
  id: string,
  updates: Partial<CustomTaskDefinition>,
): CustomTaskDefinition | null {
  const existing = getCustomTaskDefinitions()
  const taskIndex = existing.findIndex((task) => task.id === id)

  if (taskIndex === -1) {
    console.error("Task not found:", id)
    return null
  }

  const updatedTask = { ...existing[taskIndex], ...updates }
  const updated = [...existing.slice(0, taskIndex), updatedTask, ...existing.slice(taskIndex + 1)]

  localStorage.setItem("custom_task_definitions", JSON.stringify(updated))

  window.dispatchEvent(new Event("customTasksUpdated"))

  return updatedTask
}

export function deleteCustomTaskDefinition(id: string): void {
  const existing = getCustomTaskDefinitions()
  const updated = existing.filter((task) => task.id !== id)

  localStorage.setItem("custom_task_definitions", JSON.stringify(updated))

  window.dispatchEvent(new Event("customTasksUpdated"))
}

export function getAllTaskDefinitions(): (TaskDefinition | CustomTaskDefinition)[] {
  const customTasks = getCustomTaskDefinitions()

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
