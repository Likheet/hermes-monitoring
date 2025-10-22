// Shift management utilities

import type { User } from "./types"

export interface Shift {
  id: string
  worker_id: string
  shift_start: string // HH:MM format
  shift_end: string // HH:MM format
  days_of_week: number[] // 0=Sunday, 1=Monday, etc.
  effective_from: string // Date string
}

export interface WorkerAvailability {
  workerId: string
  status: "ON_SHIFT" | "OFF_DUTY" | "ENDING_SOON" | "ON_BREAK"
  minutesUntilEnd?: number
  shiftStart?: string
  shiftEnd?: string
  breakStart?: string
  breakEnd?: string
}

export type ShiftTimeOptions = {
  /**
   * Offset from UTC in minutes, matching the value returned by Date#getTimezoneOffset().
   * Negative values indicate locations ahead of UTC, positive values indicate locations behind.
   */
  timezoneOffsetMinutes?: number
}

function getDatePartsForTimezone(date: Date, timezoneOffsetMinutes?: number) {
  if (typeof timezoneOffsetMinutes === "number" && Number.isFinite(timezoneOffsetMinutes)) {
    const adjusted = new Date(date.getTime() - timezoneOffsetMinutes * 60_000)
    return {
      year: adjusted.getUTCFullYear(),
      month: adjusted.getUTCMonth() + 1,
      day: adjusted.getUTCDate(),
      hours: adjusted.getUTCHours(),
      minutes: adjusted.getUTCMinutes(),
    }
  }

  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hours: date.getHours(),
    minutes: date.getMinutes(),
  }
}

function getCurrentMinutesForTimezone(date: Date, timezoneOffsetMinutes?: number) {
  const { hours, minutes } = getDatePartsForTimezone(date, timezoneOffsetMinutes)
  return hours * 60 + minutes
}

export function formatDateKeyForTimezone(date: Date, timezoneOffsetMinutes?: number) {
  const { year, month, day } = getDatePartsForTimezone(date, timezoneOffsetMinutes)
  const monthStr = month.toString().padStart(2, "0")
  const dayStr = day.toString().padStart(2, "0")
  return `${year}-${monthStr}-${dayStr}`
}

function formatTimeForLog(hours: number, minutes: number) {
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`
}

export function isWorkerOnShiftFromUser(user: User, options?: ShiftTimeOptions): WorkerAvailability {
  if (!user.shift_start || !user.shift_end) {
    console.warn(
      "[ShiftUtils] Missing default shift times for worker, assuming on-duty:",
      user.name,
      { shift_start: user.shift_start, shift_end: user.shift_end },
    )
    return {
      workerId: user.id,
      status: "ON_SHIFT",
      shiftStart: user.shift_start,
      shiftEnd: user.shift_end,
    }
  }

  const now = new Date()
  const { hours: currentHours, minutes: currentMinutesPart } = getDatePartsForTimezone(
    now,
    options?.timezoneOffsetMinutes,
  )
  let currentMinutes = currentHours * 60 + currentMinutesPart

  if (currentMinutes < 0) {
    currentMinutes += 24 * 60
  }

  const [startHour, startMinute] = user.shift_start.split(":").map(Number)
  const [endHour, endMinute] = user.shift_end.split(":").map(Number)

  const shiftStartMinutes = startHour * 60 + startMinute
  const shiftEndMinutes = endHour * 60 + endMinute

  console.log("[v0] Checking shift for", user.name, {
    currentTime: formatTimeForLog(currentHours, currentMinutesPart),
    currentMinutes,
    shiftStart: user.shift_start,
    shiftStartMinutes,
    shiftEnd: user.shift_end,
    shiftEndMinutes,
    timezoneOffset: options?.timezoneOffsetMinutes ?? null,
  })

  let isWithinShift = false

  if (shiftEndMinutes < shiftStartMinutes) {
    // Shift crosses midnight
    isWithinShift = currentMinutes >= shiftStartMinutes || currentMinutes <= shiftEndMinutes
    console.log("[v0] Shift crosses midnight, isWithinShift:", isWithinShift)
  } else {
    // Normal shift within same day
    isWithinShift = currentMinutes >= shiftStartMinutes && currentMinutes <= shiftEndMinutes
    console.log("[v0] Normal shift, isWithinShift:", isWithinShift)
  }

  if (!isWithinShift) {
    return {
      workerId: user.id,
      status: "OFF_DUTY",
      shiftStart: user.shift_start,
      shiftEnd: user.shift_end,
    }
  }

  if (user.has_break && user.break_start && user.break_end) {
    const [breakStartHour, breakStartMin] = user.break_start.split(":").map(Number)
    const [breakEndHour, breakEndMin] = user.break_end.split(":").map(Number)

    const breakStartMinutes = breakStartHour * 60 + breakStartMin
    const breakEndMinutes = breakEndHour * 60 + breakEndMin

    const isOnBreak = currentMinutes >= breakStartMinutes && currentMinutes < breakEndMinutes

    if (isOnBreak) {
      console.log("[v0] Worker is currently on break")
      return {
        workerId: user.id,
        status: "ON_BREAK",
        shiftStart: user.shift_start,
        shiftEnd: user.shift_end,
        breakStart: user.break_start,
        breakEnd: user.break_end,
      }
    }
  }

  let minutesUntilEnd: number
  if (shiftEndMinutes < shiftStartMinutes && currentMinutes < shiftStartMinutes) {
    // We're in the "after midnight" portion of the shift
    minutesUntilEnd = shiftEndMinutes - currentMinutes
  } else if (shiftEndMinutes < shiftStartMinutes && currentMinutes >= shiftStartMinutes) {
    // We're in the "before midnight" portion of the shift
    minutesUntilEnd = 24 * 60 - currentMinutes + shiftEndMinutes
  } else {
    // Normal shift calculation
    minutesUntilEnd = shiftEndMinutes - currentMinutes
  }

  console.log("[v0] Minutes until shift end:", minutesUntilEnd)

  // Check if shift is ending soon (within 30 minutes)
  if (minutesUntilEnd <= 30 && minutesUntilEnd > 0) {
    return {
      workerId: user.id,
      status: "ENDING_SOON",
      minutesUntilEnd,
      shiftStart: user.shift_start,
      shiftEnd: user.shift_end,
    }
  }

  return {
    workerId: user.id,
    status: "ON_SHIFT",
    minutesUntilEnd,
    shiftStart: user.shift_start,
    shiftEnd: user.shift_end,
  }
}

// Check if worker is currently on shift (legacy function for backward compatibility)
export function isWorkerOnShift(shifts: Shift[], workerId: string): WorkerAvailability {
  const now = new Date()
  const currentDay = now.getDay() // 0=Sunday, 1=Monday, etc.
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  // Find active shift for this worker
  const activeShift = shifts.find((shift) => {
    if (shift.worker_id !== workerId) return false
    if (!shift.days_of_week.includes(currentDay)) return false

    const effectiveDate = new Date(shift.effective_from)
    if (effectiveDate > now) return false

    const shiftStartMinutes = timeToMinutes(shift.shift_start)
    const shiftEndMinutes = timeToMinutes(shift.shift_end)

    if (shiftEndMinutes < shiftStartMinutes) {
      // Shift crosses midnight
      return currentMinutes >= shiftStartMinutes || currentMinutes <= shiftEndMinutes
    } else {
      // Normal shift within same day
      return currentMinutes >= shiftStartMinutes && currentMinutes <= shiftEndMinutes
    }
  })

  if (!activeShift) {
    return {
      workerId,
      status: "OFF_DUTY",
    }
  }

  const shiftEndMinutes = timeToMinutes(activeShift.shift_end)
  const minutesUntilEnd =
    shiftEndMinutes < currentMinutes ? 24 * 60 - currentMinutes + shiftEndMinutes : shiftEndMinutes - currentMinutes

  // Check if shift is ending soon (within 30 minutes)
  if (minutesUntilEnd <= 30 && minutesUntilEnd > 0) {
    return {
      workerId,
      status: "ENDING_SOON",
      minutesUntilEnd,
    }
  }

  return {
    workerId,
    status: "ON_SHIFT",
    minutesUntilEnd,
  }
}

export function canAssignTaskToUser(user: User, expectedDuration: number): { canAssign: boolean; reason?: string } {
  const availability = isWorkerOnShiftFromUser(user)

  if (availability.status === "OFF_DUTY") {
    return {
      canAssign: false,
      reason: "Worker is currently off duty",
    }
  }

  if (availability.status === "ENDING_SOON" && availability.minutesUntilEnd) {
    if (expectedDuration > availability.minutesUntilEnd) {
      return {
        canAssign: false,
        reason: `Task duration (${expectedDuration}min) exceeds remaining shift time (${availability.minutesUntilEnd}min)`,
      }
    }
  }

  return { canAssign: true }
}

// Validate if task can be assigned to worker based on shift (legacy function)
export function canAssignTask(
  shifts: Shift[],
  workerId: string,
  expectedDuration: number,
): { canAssign: boolean; reason?: string } {
  const availability = isWorkerOnShift(shifts, workerId)

  if (availability.status === "OFF_DUTY") {
    return {
      canAssign: false,
      reason: "Worker is currently off duty",
    }
  }

  if (availability.status === "ENDING_SOON" && availability.minutesUntilEnd) {
    if (expectedDuration > availability.minutesUntilEnd) {
      return {
        canAssign: false,
        reason: `Task duration (${expectedDuration}min) exceeds remaining shift time (${availability.minutesUntilEnd}min)`,
      }
    }
  }

  return { canAssign: true }
}

export function getWorkersWithShiftStatusFromUsers(
  workers: User[],
  options?: ShiftTimeOptions,
): Array<User & { availability: WorkerAvailability }> {
  return workers.map((worker) => ({
    ...worker,
    availability: isWorkerOnShiftFromUser(worker, options),
  }))
}

// Get all workers with their shift status (legacy function)
export function getWorkersWithShiftStatus(
  workers: Array<{ id: string; name: string }>,
  shifts: Shift[],
): Array<{ id: string; name: string; availability: WorkerAvailability }> {
  return workers.map((worker) => ({
    ...worker,
    availability: isWorkerOnShift(shifts, worker.id),
  }))
}

export function needsHandoverFromUser(user: User): boolean {
  const availability = isWorkerOnShiftFromUser(user)
  return availability.status === "ENDING_SOON"
}

// Check if worker needs to handover tasks (30min before shift end) (legacy function)
export function needsHandover(shifts: Shift[], workerId: string): boolean {
  const availability = isWorkerOnShift(shifts, workerId)
  return availability.status === "ENDING_SOON"
}

// Parse time string to minutes since midnight
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number)
  return hours * 60 + minutes
}

// Format minutes to HH:MM
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`
}

// Check for overlapping shifts
export function hasOverlappingShifts(existingShifts: Shift[], newShift: Omit<Shift, "id">): boolean {
  return existingShifts.some((shift) => {
    if (shift.worker_id !== newShift.worker_id) return false

    // Check if any days overlap
    const daysOverlap = shift.days_of_week.some((day) => newShift.days_of_week.includes(day))
    if (!daysOverlap) return false

    // Check if times overlap
    const existingStart = timeToMinutes(shift.shift_start)
    const existingEnd = timeToMinutes(shift.shift_end)
    const newStart = timeToMinutes(newShift.shift_start)
    const newEnd = timeToMinutes(newShift.shift_end)

    return (
      (newStart >= existingStart && newStart < existingEnd) ||
      (newEnd > existingStart && newEnd <= existingEnd) ||
      (newStart <= existingStart && newEnd >= existingEnd)
    )
  })
}

// Validate break times
export function validateBreakTimes(
  shiftStart: string,
  shiftEnd: string,
  breakStart: string,
  breakEnd: string,
): { valid: boolean; error?: string } {
  const shiftStartMinutes = timeToMinutes(shiftStart)
  const shiftEndMinutes = timeToMinutes(shiftEnd)
  const breakStartMinutes = timeToMinutes(breakStart)
  const breakEndMinutes = timeToMinutes(breakEnd)

  // Check if break end is after break start
  if (breakEndMinutes <= breakStartMinutes) {
    return {
      valid: false,
      error: "Break end time must be after break start time",
    }
  }

  // Check if break is within shift hours (handle overnight shifts)
  if (shiftEndMinutes < shiftStartMinutes) {
    // Overnight shift
    const breakInFirstPart = breakStartMinutes >= shiftStartMinutes && breakEndMinutes <= 24 * 60
    const breakInSecondPart = breakStartMinutes >= 0 && breakEndMinutes <= shiftEndMinutes

    if (!breakInFirstPart && !breakInSecondPart) {
      return {
        valid: false,
        error: "Break must be scheduled within shift hours",
      }
    }
  } else {
    // Normal shift
    if (breakStartMinutes < shiftStartMinutes || breakEndMinutes > shiftEndMinutes) {
      return {
        valid: false,
        error: "Break must be scheduled within shift hours",
      }
    }
  }

  // Check if break duration is reasonable (not more than 2 hours)
  const breakDuration = breakEndMinutes - breakStartMinutes
  if (breakDuration > 120) {
    return {
      valid: false,
      error: "Break duration cannot exceed 2 hours",
    }
  }

  return { valid: true }
}

// Get worker's shift for a specific date, checking schedules first
export function getWorkerShiftForDate(
  worker: User,
  date: Date,
  shiftSchedules: Array<{
    worker_id: string
    schedule_date: string
    shift_start: string
    shift_end: string
    has_break: boolean
    break_start?: string
    break_end?: string
    is_override: boolean
    override_reason?: string
  }>,
  options?: ShiftTimeOptions,
): {
  shift_start: string
  shift_end: string
  has_break: boolean
  break_start?: string
  break_end?: string
  is_override: boolean
  override_reason?: string
} {
  // Format date as YYYY-MM-DD
  const dateStr = formatDateKeyForTimezone(date, options?.timezoneOffsetMinutes)

  console.log("[v0] Getting shift for", worker.name, "on", dateStr, {
    totalSchedules: shiftSchedules.length,
    workerSchedules: shiftSchedules.filter(s => s.worker_id === worker.id).length,
    defaultShift: `${worker.shift_start} - ${worker.shift_end}`,
  })

  // Check if there's a schedule for this specific date
  const schedule = shiftSchedules.find((s) => s.worker_id === worker.id && s.schedule_date === dateStr)
  if (schedule) {
    const shiftStart = schedule.shift_start ?? worker.shift_start ?? "00:00"
    const shiftEnd = schedule.shift_end ?? worker.shift_end ?? "23:59"
    if (!schedule.shift_start || !schedule.shift_end) {
      console.warn(
        "[ShiftUtils] Schedule missing shift times, using fallback defaults:",
        worker.name,
        { date: dateStr, shiftStart, shiftEnd },
      )
    }

    const hasBreak = Boolean(schedule.has_break && schedule.break_start && schedule.break_end)
    return {
      shift_start: shiftStart,
      shift_end: shiftEnd,
      has_break: hasBreak,
      break_start: hasBreak ? schedule.break_start : undefined,
      break_end: hasBreak ? schedule.break_end : undefined,
      is_override: schedule.is_override,
      override_reason: schedule.override_reason,
    }
  }

  const defaultShiftStart = worker.shift_start ?? "00:00"
  const defaultShiftEnd = worker.shift_end ?? "23:59"
  if (!worker.shift_start || !worker.shift_end) {
    console.warn(
      "[ShiftUtils] Worker missing default shift times, assuming full-day availability:",
      worker.name,
      { shift_start: worker.shift_start, shift_end: worker.shift_end },
    )
  }

  console.log(
    "[v0] ? No schedule found for",
    worker.name,
    "- using default shift:",
    `${defaultShiftStart} - ${defaultShiftEnd}`,
  )
  const hasBreak = Boolean(worker.has_break && worker.break_start && worker.break_end)
  return {
    shift_start: defaultShiftStart,
    shift_end: defaultShiftEnd,
    has_break: hasBreak,
    break_start: hasBreak ? worker.break_start : undefined,
    break_end: hasBreak ? worker.break_end : undefined,
    is_override: false,
  }
}
export function isWorkerOnShiftWithSchedule(
  user: User,
  shiftSchedules: Array<{
    worker_id: string
    schedule_date: string
    shift_start: string
    shift_end: string
    has_break: boolean
    break_start?: string
    break_end?: string
    is_override: boolean
    override_reason?: string
  }>,
  options?: ShiftTimeOptions,
): WorkerAvailability {
  const now = new Date()
  const timezoneOffset = options?.timezoneOffsetMinutes
  const todayShift = getWorkerShiftForDate(user, now, shiftSchedules, options)
  const { hours: currentHours, minutes: currentMinutesPart } = getDatePartsForTimezone(now, timezoneOffset)
  let currentMinutes = currentHours * 60 + currentMinutesPart

  if (currentMinutes < 0) {
    currentMinutes += 24 * 60
  }

  console.log(`[ShiftUtils] ANALYZING ${user.name.toUpperCase()}:`)
  console.log("  shift:", todayShift)
  console.log("  currentTime:", formatTimeForLog(currentHours, currentMinutesPart))
  console.log("  timezoneOffset:", timezoneOffset ?? null)
  console.log("  scheduleCount:", shiftSchedules.filter((s) => s.worker_id === user.id).length)
  console.log("  isOverride:", todayShift.is_override)

  if (todayShift.is_override && todayShift.override_reason && (!todayShift.shift_start || !todayShift.shift_end)) {
    console.log("  result: OFF_DUTY (override removed shift times)", todayShift.override_reason)
    return {
      workerId: user.id,
      status: "OFF_DUTY",
    }
  }

  if (!todayShift.shift_start || !todayShift.shift_end) {
    console.warn(
      "[ShiftUtils] Missing shift times after normalization, assuming on-duty:",
      user.name,
      { shift_start: todayShift.shift_start, shift_end: todayShift.shift_end },
    )
    return {
      workerId: user.id,
      status: "ON_SHIFT",
      shiftStart: todayShift.shift_start,
      shiftEnd: todayShift.shift_end,
    }
  }

  const [startHour, startMinute] = todayShift.shift_start.split(":").map(Number)
  const [endHour, endMinute] = todayShift.shift_end.split(":").map(Number)

  const shiftStartMinutes = startHour * 60 + startMinute
  const shiftEndMinutes = endHour * 60 + endMinute

  console.log("  timeCalc.currentMinutes:", currentMinutes)
  console.log("  timeCalc.shiftStartMinutes:", shiftStartMinutes)
  console.log("  timeCalc.shiftEndMinutes:", shiftEndMinutes)

  let isWithinShift = false

  if (shiftEndMinutes < shiftStartMinutes) {
    isWithinShift = currentMinutes >= shiftStartMinutes || currentMinutes <= shiftEndMinutes
    console.log("  shiftType: crosses-midnight", { "isWithinShift": isWithinShift })
  } else {
    isWithinShift = currentMinutes >= shiftStartMinutes && currentMinutes <= shiftEndMinutes
    console.log("  shiftType: same-day", { "isWithinShift": isWithinShift })
  }

  if (!isWithinShift) {
    console.log("  result: OFF_DUTY (outside shift hours)")
    return {
      workerId: user.id,
      status: "OFF_DUTY",
      shiftStart: todayShift.shift_start,
      shiftEnd: todayShift.shift_end,
    }
  }

  if (todayShift.has_break && todayShift.break_start && todayShift.break_end) {
    const [breakStartHour, breakStartMin] = todayShift.break_start.split(":").map(Number)
    const [breakEndHour, breakEndMin] = todayShift.break_end.split(":").map(Number)

    const breakStartMinutes = breakStartHour * 60 + breakStartMin
    const breakEndMinutes = breakEndHour * 60 + breakEndMin

    const isOnBreak = currentMinutes >= breakStartMinutes && currentMinutes < breakEndMinutes

    if (isOnBreak) {
      console.log("  result: ON_BREAK")
      return {
        workerId: user.id,
        status: "ON_BREAK",
        shiftStart: todayShift.shift_start,
        shiftEnd: todayShift.shift_end,
        breakStart: todayShift.break_start,
        breakEnd: todayShift.break_end,
      }
    }
  }

  let minutesUntilEnd: number
  if (shiftEndMinutes < shiftStartMinutes && currentMinutes < shiftStartMinutes) {
    minutesUntilEnd = shiftEndMinutes - currentMinutes
  } else if (shiftEndMinutes < shiftStartMinutes && currentMinutes >= shiftStartMinutes) {
    minutesUntilEnd = 24 * 60 - currentMinutes + shiftEndMinutes
  } else {
    minutesUntilEnd = shiftEndMinutes - currentMinutes
  }

  console.log("  minutesUntilEnd:", minutesUntilEnd)

  if (minutesUntilEnd <= 30 && minutesUntilEnd > 0) {
    return {
      workerId: user.id,
      status: "ENDING_SOON",
      minutesUntilEnd,
      shiftStart: todayShift.shift_start,
      shiftEnd: todayShift.shift_end,
    }
  }

  return {
    workerId: user.id,
    status: "ON_SHIFT",
    minutesUntilEnd,
    shiftStart: todayShift.shift_start,
    shiftEnd: todayShift.shift_end,
  }
}
// Attendance tracking utilities
export interface AttendanceRecord {
  date: string // YYYY-MM-DD
  status: "present" | "holiday" | "leave" | "sick" | "absent"
  shift_start?: string
  shift_end?: string
  hours_worked?: number
}

export interface MonthlyAttendance {
  month: string // YYYY-MM
  total_days: number
  days_worked: number
  days_off: number
  holidays: number
  leaves: number
  sick_days: number
  attendance_percentage: number
  records: AttendanceRecord[]
}

// Calculate attendance for a worker for a specific month
export function calculateMonthlyAttendance(
  workerId: string,
  month: Date,
  shiftSchedules: Array<{
    worker_id: string
    schedule_date: string
    shift_start: string
    shift_end: string
    is_override: boolean
    override_reason?: string
  }>,
): MonthlyAttendance {
  const year = month.getFullYear()
  const monthNum = month.getMonth()
  const monthStr = `${year}-${(monthNum + 1).toString().padStart(2, "0")}`

  // Get first and last day of month
  const firstDay = new Date(year, monthNum, 1)
  const lastDay = new Date(year, monthNum + 1, 0)
  const totalDays = lastDay.getDate()

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const records: AttendanceRecord[] = []
  let daysWorked = 0
  let daysOff = 0
  let holidays = 0
  let leaves = 0
  let sickDays = 0

  // Iterate through each day of the month
  for (let day = 1; day <= totalDays; day++) {
    const date = new Date(year, monthNum, day)
    date.setHours(0, 0, 0, 0)
    const dateStr = date.toISOString().split("T")[0]

    if (date > today) {
      break
    }

    // Check if there's a schedule for this date
    const schedule = shiftSchedules.find((s) => s.worker_id === workerId && s.schedule_date === dateStr)

    if (schedule && schedule.is_override && schedule.override_reason) {
      // Worker was off duty
      const reason = schedule.override_reason.toLowerCase()
      let status: AttendanceRecord["status"] = "absent"

      if (reason.includes("holiday")) {
        status = "holiday"
        holidays++
      } else if (reason.includes("leave")) {
        status = "leave"
        leaves++
      } else if (reason.includes("sick")) {
        status = "sick"
        sickDays++
      }

      daysOff++
      records.push({
        date: dateStr,
        status,
      })
    } else {
      daysWorked++
      records.push({
        date: dateStr,
        status: "present",
        shift_start: schedule?.shift_start,
        shift_end: schedule?.shift_end,
      })
    }
  }

  const daysElapsed = daysWorked + daysOff
  const attendancePercentage = daysElapsed > 0 ? Math.round((daysWorked / daysElapsed) * 100) : 0

  return {
    month: monthStr,
    total_days: totalDays,
    days_worked: daysWorked,
    days_off: daysOff,
    holidays,
    leaves,
    sick_days: sickDays,
    attendance_percentage: attendancePercentage,
    records,
  }
}

// Get attendance summary for current month
export function getCurrentMonthAttendance(
  workerId: string,
  shiftSchedules: Array<{
    worker_id: string
    schedule_date: string
    shift_start: string
    shift_end: string
    is_override: boolean
    override_reason?: string
  }>,
): MonthlyAttendance {
  return calculateMonthlyAttendance(workerId, new Date(), shiftSchedules)
}

// Get workers with shift status, checking today's shift schedule
export function getWorkersWithShiftStatusFromUsersAndSchedules(
  workers: User[],
  shiftSchedules: Array<{
    worker_id: string
    schedule_date: string
    shift_start: string
    shift_end: string
    has_break: boolean
    break_start?: string
    break_end?: string
    is_override: boolean
    override_reason?: string
  }>,
  options?: ShiftTimeOptions,
): Array<User & { availability: WorkerAvailability }> {
  return workers.map((worker) => ({
    ...worker,
    availability: isWorkerOnShiftWithSchedule(worker, shiftSchedules, options),
  }))
}



