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
  console.log("[v0] Started pause monitoring for task:", taskId)
}

export function stopPauseMonitoring() {
  localStorage.removeItem(PAUSE_MONITOR_KEY)
  console.log("[v0] Stopped pause monitoring")
}

export function checkPausedTaskStatus(tasks: Task[], maintenanceTasks: MaintenanceTask[], users: User[]) {
  const stateStr = localStorage.getItem(PAUSE_MONITOR_KEY)
  if (!stateStr) return

  const state: PauseMonitorState = JSON.parse(stateStr)

  const pausedTask = tasks.find((t) => t.id === state.taskId)
  if (pausedTask && pausedTask.priority_level === "GUEST_REQUEST") {
    console.log("[v0] Paused task is a guest request, skipping monitoring")
    return
  }

  const pausedAt = new Date(state.pausedAt).getTime()
  const now = Date.now()
  const minutesElapsed = Math.floor((now - pausedAt) / 60000)

  console.log("[v0] Checking paused task status:", {
    taskId: state.taskId,
    minutesElapsed,
    fiveMinuteNotified: state.fiveMinuteNotified,
    fifteenMinuteNotified: state.fifteenMinuteNotified,
  })

  // Check if there's any active task for this user
  const hasActiveTask =
    tasks.some((t) => t.assigned_to_user_id === state.userId && t.status === "IN_PROGRESS") ||
    maintenanceTasks.some((t) => t.assigned_to === state.userId && t.status === "in_progress")

  if (hasActiveTask) {
    console.log("[v0] User has active task, stopping pause monitoring")
    stopPauseMonitoring()
    return
  }

  // 5 minute notification to worker
  if (minutesElapsed >= 5 && !state.fiveMinuteNotified) {
    console.log("[v0] Sending 5-minute pause notification to worker")
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
    console.log("[v0] Sending 15-minute pause notification to front-office and supervisors")

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
