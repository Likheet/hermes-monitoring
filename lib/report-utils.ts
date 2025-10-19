import type { Task, User } from "./types"

export type DateRange = "weekly" | "monthly" | "all-time"

export interface WorkerPerformanceReport {
  workerId: string
  workerName: string
  department: string
  shiftHours: number // Total scheduled shift hours in the period
  actualWorkedHours: number // Actual time spent on tasks
  idleHours: number // Shift hours - actual worked hours
  discrepancyPercentage: number // (idle / shift) * 100
  averageRating: number
  totalRatings: number
  tasksCompleted: number
  tasksRejected: number
}

export interface DiscrepancyJob {
  taskId: string
  taskType: string
  roomNumber: string
  workerId: string
  workerName: string
  expectedDuration: number
  actualDuration: number
  overtimePercentage: number
  rating: number | null
  status: string
  isRework: boolean
}

function getDateRangeFilter(range: DateRange): (date: Date) => boolean {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  switch (range) {
    case "weekly":
      const weekAgo = new Date(today)
      weekAgo.setDate(weekAgo.getDate() - 7)
      return (date) => date >= weekAgo

    case "monthly":
      const monthAgo = new Date(today)
      monthAgo.setMonth(monthAgo.getMonth() - 1)
      return (date) => date >= monthAgo

    case "all-time":
      return () => true
  }
}

function calculateShiftHoursInPeriod(user: User, dateRange: DateRange): number {
  // Parse shift times
  const [startHour, startMin] = user.shift_start.split(":").map(Number)
  const [endHour, endMin] = user.shift_end.split(":").map(Number)

  let dailyShiftMinutes = endHour * 60 + endMin - (startHour * 60 + startMin)
  if (dailyShiftMinutes < 0) {
    dailyShiftMinutes += 24 * 60
  }

  const dailyShiftHours = dailyShiftMinutes / 60

  // Calculate number of days in the period
  let days = 0
  switch (dateRange) {
    case "weekly":
      days = 7
      break
    case "monthly":
      days = 30
      break
    case "all-time":
      days = 365 // Assume 1 year for all-time
      break
  }

  return dailyShiftHours * days
}

export function generateWorkerPerformanceReport(
  tasks: Task[],
  users: User[],
  dateRange: DateRange,
): WorkerPerformanceReport[] {
  const workers = users.filter((u) => u.role === "worker")
  const dateFilter = getDateRangeFilter(dateRange)

  return workers.map((worker) => {
    // Filter tasks for this worker in the date range
    const workerTasks = tasks.filter((task) => {
      if (task.assigned_to_user_id !== worker.id) return false
      if (!task.assigned_at) return false

      const assignedDate = new Date(task.assigned_at.client)
      return dateFilter(assignedDate)
    })

    // Calculate actual worked hours
    const actualWorkedMinutes = workerTasks.reduce((sum, task) => {
      return sum + (task.actual_duration_minutes || 0)
    }, 0)
    const actualWorkedHours = actualWorkedMinutes / 60

    // Calculate shift hours for the period
    const shiftHours = calculateShiftHoursInPeriod(worker, dateRange)

    // Calculate idle hours
    const idleHours = Math.max(0, shiftHours - actualWorkedHours)

    // Calculate discrepancy percentage
    const discrepancyPercentage = shiftHours > 0 ? (idleHours / shiftHours) * 100 : 0

    // Calculate ratings
    const ratedTasks = workerTasks.filter((t) => t.rating !== null)
    const averageRating =
      ratedTasks.length > 0 ? ratedTasks.reduce((sum, t) => sum + (t.rating || 0), 0) / ratedTasks.length : 0

    // Count completed and rejected tasks
    const tasksCompleted = workerTasks.filter((t) => t.status === "COMPLETED").length
    const tasksRejected = workerTasks.filter((t) => t.status === "REJECTED").length

    return {
      workerId: worker.id,
      workerName: worker.name,
      department: worker.department,
      shiftHours: Math.round(shiftHours * 10) / 10,
      actualWorkedHours: Math.round(actualWorkedHours * 10) / 10,
      idleHours: Math.round(idleHours * 10) / 10,
      discrepancyPercentage: Math.round(discrepancyPercentage * 10) / 10,
      averageRating: Math.round(averageRating * 10) / 10,
      totalRatings: ratedTasks.length,
      tasksCompleted,
      tasksRejected,
    }
  })
}

export function generateDiscrepancyReport(tasks: Task[], users: User[], dateRange: DateRange): DiscrepancyJob[] {
  const dateFilter = getDateRangeFilter(dateRange)

  const discrepancyJobs: DiscrepancyJob[] = []

  tasks.forEach((task) => {
    if (!task.completed_at || !task.actual_duration_minutes) return

    const completedDate = new Date(task.completed_at.client)
    if (!dateFilter(completedDate)) return

    const overtimePercentage =
      ((task.actual_duration_minutes - task.expected_duration_minutes) / task.expected_duration_minutes) * 100

    const isRework = task.status === "REJECTED" || task.audit_log.some((log) => log.action === "TASK_REJECTED")

    if (overtimePercentage > 20 || (task.rating !== null && task.rating < 3) || isRework) {
      const worker = users.find((u) => u.id === task.assigned_to_user_id)

      discrepancyJobs.push({
        taskId: task.id,
        taskType: task.task_type,
        roomNumber: task.room_number,
        workerId: task.assigned_to_user_id,
        workerName: worker?.name || "Unknown",
        expectedDuration: task.expected_duration_minutes,
        actualDuration: task.actual_duration_minutes,
        overtimePercentage: Math.round(overtimePercentage * 10) / 10,
        rating: task.rating,
        status: task.status,
        isRework,
      })
    }
  })

  return discrepancyJobs.sort((a, b) => b.overtimePercentage - a.overtimePercentage)
}
