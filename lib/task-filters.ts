import type { Task } from "./types"

const toMillis = (value: string | null | undefined): number | null => {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : parsed
}

export function getAssignedTimestamp(task: Task): number | null {
  return toMillis(task.assigned_at?.server ?? task.assigned_at?.client)
}

export function isFuturePendingTask(task: Task, referenceTime = Date.now()): boolean {
  if (task.status !== "PENDING") return false
  const assignedAt = getAssignedTimestamp(task)
  if (assignedAt === null) return false
  return assignedAt > referenceTime
}

export function filterReadyTasks<T extends Task>(tasks: T[], referenceTime = Date.now()): T[] {
  return tasks.filter((task) => !isFuturePendingTask(task, referenceTime))
}
