import { createNotification } from "@/lib/notification-utils"
import type { MaintenanceTask } from "@/lib/maintenance-types"
import type { Task, User } from "@/lib/types"

interface PauseMonitorState {
  taskId: string
  userId: string
  pausedAt: string
  fiveMinuteNotified: boolean
  fifteenMinuteNotified: boolean
}

const PAUSE_MONITOR_KEY = "pause_monitor_state"
const CHECK_INTERVAL = 60000 // Check every minute

export function startPauseMonitoring(taskId: string, userId: string) {
  const state: PauseMonitorState = {
    taskId,
    userId,
    pausedAt: new Date().toISOString(),
    fiveMinuteNotified: false,
    fifteenMinuteNotified: false,
  }

  localStorage.setItem(PAUSE_MONITOR_KEY, JSON.stringify(state))
}

export function stopPauseMonitoring() {
  localStorage.removeItem(PAUSE_MONITOR_KEY)
}

export function checkPausedTaskStatus(tasks: Task[], maintenanceTasks: MaintenanceTask[], users: User[]) {
  const stateStr = localStorage.getItem(PAUSE_MONITOR_KEY)
  if (!stateStr) return

  const state: PauseMonitorState = JSON.parse(stateStr)

  const pausedTask = tasks.find((t) => t.id === state.taskId)
  if (pausedTask && pausedTask.priority_level === "GUEST_REQUEST") {
    return
  }

  const pausedAt = new Date(state.pausedAt).getTime()
  const now = Date.now()
  const minutesElapsed = Math.floor((now - pausedAt) / 60000)

  
  // Check if there's any active task for this user
  const hasActiveTask =
    tasks.some((t) => t.assigned_to_user_id === state.userId && t.status === "IN_PROGRESS") ||
    maintenanceTasks.some((t) => t.assigned_to === state.userId && t.status === "in_progress")

  if (hasActiveTask) {
    stopPauseMonitoring()
    return
  }

  // 5 minute notification to worker
  if (minutesElapsed >= 5 && !state.fiveMinuteNotified) {
    createNotification(
      state.userId,
      "system",
      "Paused Task Reminder",
      "You have a paused task with no active work for 5 minutes. Please resume or complete it.",
      state.taskId,
    )

    state.fiveMinuteNotified = true
    localStorage.setItem(PAUSE_MONITOR_KEY, JSON.stringify(state))
  }

  // 15 minute notification to front-office and supervisors
  if (minutesElapsed >= 15 && !state.fifteenMinuteNotified) {

    // Find the worker's department
    const worker = users.find((u) => u.id === state.userId)
    if (!worker) return

    // Notify front-office users
    const frontOfficeUsers = users.filter((u) => u.role === "front_office")
    frontOfficeUsers.forEach((user) => {
      createNotification(
        user.id,
        "escalation",
        "Worker Idle Alert",
        `${worker.name} has a paused task with no active work for 15 minutes.`,
        state.taskId,
      )
    })

    // Notify supervisors of the same department
    const supervisors = users.filter((u) => u.role === "supervisor" && u.department === worker.department)
    supervisors.forEach((user) => {
      createNotification(
        user.id,
        "escalation",
        "Worker Idle Alert",
        `${worker.name} has a paused task with no active work for 15 minutes.`,
        state.taskId,
      )
    })

    state.fifteenMinuteNotified = true
    localStorage.setItem(PAUSE_MONITOR_KEY, JSON.stringify(state))
  }
}

// Initialize monitoring interval
export function initializePauseMonitoring(tasks: Task[], maintenanceTasks: MaintenanceTask[], users: User[]) {
  // Check immediately
  checkPausedTaskStatus(tasks, maintenanceTasks, users)

  // Set up interval
  const interval = setInterval(() => {
    checkPausedTaskStatus(tasks, maintenanceTasks, users)
  }, CHECK_INTERVAL)

  return () => clearInterval(interval)
}
