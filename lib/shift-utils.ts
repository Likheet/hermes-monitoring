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
  status: "ON_SHIFT" | "OFF_DUTY" | "ENDING_SOON"
  minutesUntilEnd?: number
  shiftStart?: string
  shiftEnd?: string
}

export function isWorkerOnShiftFromUser(user: User): WorkerAvailability {
  if (!user.shift_start || !user.shift_end) {
    return {
      workerId: user.id,
      status: "OFF_DUTY",
    }
  }

  const now = new Date()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  const [startHour, startMinute] = user.shift_start.split(":").map(Number)
  const [endHour, endMinute] = user.shift_end.split(":").map(Number)

  const shiftStartMinutes = startHour * 60 + startMinute
  const shiftEndMinutes = endHour * 60 + endMinute

  console.log("[v0] Checking shift for", user.name, {
    currentTime: `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`,
    currentMinutes,
    shiftStart: user.shift_start,
    shiftStartMinutes,
    shiftEnd: user.shift_end,
    shiftEndMinutes,
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
): Array<User & { availability: WorkerAvailability }> {
  return workers.map((worker) => ({
    ...worker,
    availability: isWorkerOnShiftFromUser(worker),
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
