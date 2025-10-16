export interface CustomTaskReadStatus {
  taskId: string
  readAt: string
}

const STORAGE_KEY = "custom_tasks_read_status"

export function getReadCustomTasks(): CustomTaskReadStatus[] {
  if (typeof window === "undefined") return []
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored ? JSON.parse(stored) : []
}

export function markCustomTaskAsRead(taskId: string): void {
  const readTasks = getReadCustomTasks()
  const existing = readTasks.find((t) => t.taskId === taskId)

  if (!existing) {
    readTasks.push({
      taskId,
      readAt: new Date().toISOString(),
    })
    localStorage.setItem(STORAGE_KEY, JSON.stringify(readTasks))
  }
}

export function markAllCustomTasksAsRead(taskIds: string[]): void {
  const readTasks = getReadCustomTasks()
  const now = new Date().toISOString()

  taskIds.forEach((taskId) => {
    const existing = readTasks.find((t) => t.taskId === taskId)
    if (!existing) {
      readTasks.push({ taskId, readAt: now })
    }
  })

  localStorage.setItem(STORAGE_KEY, JSON.stringify(readTasks))
}

export function isCustomTaskRead(taskId: string): boolean {
  const readTasks = getReadCustomTasks()
  return readTasks.some((t) => t.taskId === taskId)
}

export function getUnreadCustomTaskCount(allTaskIds: string[]): number {
  const readTasks = getReadCustomTasks()
  const readTaskIds = new Set(readTasks.map((t) => t.taskId))
  return allTaskIds.filter((id) => !readTaskIds.has(id)).length
}
