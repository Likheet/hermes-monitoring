// Analytics and reporting utilities

import type { Task } from "./types"

export interface WorkerPerformance {
  workerId: string
  workerName: string
  totalTasks: number
  completedTasks: number
  avgCompletionTime: number
  onTimeRate: number
  escalationCount: number
  rejectionCount: number
}

export interface DepartmentStats {
  totalTasks: number
  completedTasks: number
  pendingTasks: number
  inProgressTasks: number
  avgCompletionTime: number
  onTimeRate: number
  escalationRate: number
}

export function calculateWorkerPerformance(tasks: Task[], workerId: string, workerName: string): WorkerPerformance {
  const workerTasks = tasks.filter((t) => t.assigned_to_user_id === workerId)
  const completedTasks = workerTasks.filter((t) => t.status === "COMPLETED")
  const rejectedTasks = workerTasks.filter((t) => t.status === "REJECTED")

  const totalCompletionTime = completedTasks.reduce((sum, task) => sum + (task.actual_duration_minutes || 0), 0)
  const avgCompletionTime = completedTasks.length > 0 ? totalCompletionTime / completedTasks.length : 0

  const onTimeTasks = completedTasks.filter(
    (task) => (task.actual_duration_minutes || 0) <= task.expected_duration_minutes,
  )
  const onTimeRate = completedTasks.length > 0 ? (onTimeTasks.length / completedTasks.length) * 100 : 0

  // Count escalations (tasks that took > 50% overtime)
  const escalatedTasks = completedTasks.filter(
    (task) => (task.actual_duration_minutes || 0) > task.expected_duration_minutes * 1.5,
  )

  return {
    workerId,
    workerName,
    totalTasks: workerTasks.length,
    completedTasks: completedTasks.length,
    avgCompletionTime: Math.round(avgCompletionTime),
    onTimeRate: Math.round(onTimeRate),
    escalationCount: escalatedTasks.length,
    rejectionCount: rejectedTasks.length,
  }
}

export function calculateDepartmentStats(tasks: Task[]): DepartmentStats {
  const completedTasks = tasks.filter((t) => t.status === "COMPLETED")
  const pendingTasks = tasks.filter((t) => t.status === "PENDING")
  const inProgressTasks = tasks.filter((t) => t.status === "IN_PROGRESS" || t.status === "PAUSED")

  const totalCompletionTime = completedTasks.reduce((sum, task) => sum + (task.actual_duration_minutes || 0), 0)
  const avgCompletionTime = completedTasks.length > 0 ? totalCompletionTime / completedTasks.length : 0

  const onTimeTasks = completedTasks.filter(
    (task) => (task.actual_duration_minutes || 0) <= task.expected_duration_minutes,
  )
  const onTimeRate = completedTasks.length > 0 ? (onTimeTasks.length / completedTasks.length) * 100 : 0

  const escalatedTasks = completedTasks.filter(
    (task) => (task.actual_duration_minutes || 0) > task.expected_duration_minutes * 1.5,
  )
  const escalationRate = completedTasks.length > 0 ? (escalatedTasks.length / completedTasks.length) * 100 : 0

  return {
    totalTasks: tasks.length,
    completedTasks: completedTasks.length,
    pendingTasks: pendingTasks.length,
    inProgressTasks: inProgressTasks.length,
    avgCompletionTime: Math.round(avgCompletionTime),
    onTimeRate: Math.round(onTimeRate),
    escalationRate: Math.round(escalationRate),
  }
}

export function getTasksByPriority(tasks: Task[]) {
  return {
    guestRequest: tasks.filter((t) => t.priority_level === "GUEST_REQUEST").length,
    timeSensitive: tasks.filter((t) => t.priority_level === "TIME_SENSITIVE").length,
    dailyTask: tasks.filter((t) => t.priority_level === "DAILY_TASK").length,
    preventiveMaintenance: tasks.filter((t) => t.priority_level === "PREVENTIVE_MAINTENANCE").length,
  }
}

export function getTaskCompletionTrend(tasks: Task[], days = 7) {
  const now = new Date()
  const trend: Array<{ date: string; completed: number; total: number }> = []

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    date.setHours(0, 0, 0, 0)

    const nextDate = new Date(date)
    nextDate.setDate(nextDate.getDate() + 1)

    const dayTasks = tasks.filter((task) => {
      const assignedDate = new Date(task.assigned_at.client)
      return assignedDate >= date && assignedDate < nextDate
    })

    const completedTasks = dayTasks.filter((t) => t.status === "COMPLETED")

    trend.push({
      date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      completed: completedTasks.length,
      total: dayTasks.length,
    })
  }

  return trend
}
