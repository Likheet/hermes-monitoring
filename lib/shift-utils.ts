// Shift management utilities

import type { User } from "./types"
import { calculateWorkingHours } from "./date-utils"

export interface Shift {
  id: string
  worker_id: string
  shift_start: string // HH:MM format
  shift_end: string // HH:MM format
  days_of_week: number[] // 0=Sunday, 1=Monday, etc.
  effective_from: string // Date string
}

export type WorkerShiftStatus = "AVAILABLE" | "SHIFT_BREAK" | "OFF_DUTY"
export type WorkerBreakType = "INTRA_SHIFT" | "INTER_SHIFT"

export interface WorkerAvailability {
  workerId: string
  status: WorkerShiftStatus
  currentShift?: 1 | 2
  nextShiftNumber?: 1 | 2
  minutesUntilStateChange?: number
  minutesUntilNextShift?: number
  shiftStart?: string
  shiftEnd?: string
  breakStart?: string
  breakEnd?: string
  breakType?: WorkerBreakType
  nextShiftStart?: string
  isEndingSoon?: boolean
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

const MAX_SINGLE_SHIFT_BREAK_MINUTES = 120
const MAX_DUAL_SHIFT_BREAK_MINUTES = 240
const MIN_INTER_SHIFT_BREAK_MINUTES = 1
const MAX_INTER_SHIFT_BREAK_MINUTES = 1440

type ShiftSegmentType = "WORK" | "BREAK"

interface ShiftSegment {
  type: ShiftSegmentType
  shiftNumber?: 1 | 2
  breakType?: WorkerBreakType
  startMinutes: number
  endMinutes: number
  startTime: string
  endTime: string
  shiftStartTime?: string
  shiftEndTime?: string
}

interface ShiftEvaluationConfig {
  workerId: string
  shift1Start: string
  shift1End: string
  shift1BreakStart?: string
  shift1BreakEnd?: string
  shift2Start?: string
  shift2End?: string
  shift2BreakStart?: string
  shift2BreakEnd?: string
  timezoneOffsetMinutes?: number
}

function isMinuteInRange(minute: number, start: number, end: number) {
  if (start === end) return false
  if (end > start) {
    return minute >= start && minute < end
  }
  return minute >= start || minute < end
}

function minutesUntilRangeEnd(minute: number, start: number, end: number) {
  if (!isMinuteInRange(minute, start, end)) {
    return 0
  }

  if (end > start) {
    return end - minute
  }

  if (minute >= start) {
    return 24 * 60 - minute + end
  }

  return end - minute
}

function minutesUntilRangeStart(minute: number, start: number, end: number) {
  if (isMinuteInRange(minute, start, end)) {
    return 0
  }

  let diff = start - minute
  if (diff <= 0) {
    diff += 24 * 60
  }

  return diff
}

function segmentDuration(start: number, end: number) {
  if (start === end) {
    return 0
  }
  if (end > start) {
    return end - start
  }
  return 24 * 60 - start + end
}

function differenceInMinutes(startTime: string, endTime: string) {
  const start = timeToMinutes(startTime)
  const end = timeToMinutes(endTime)
  if (end >= start) {
    return end - start
  }
  return end + 24 * 60 - start
}

function expandMinutesRange(start: number, end: number): Array<{ start: number; end: number }> {
  if (start === end) {
    return []
  }

  if (end > start) {
    return [{ start, end }]
  }

  return [
    { start, end: 24 * 60 },
    { start: 0, end },
  ]
}

function segmentsOverlap(segA: { start: number; end: number }, segB: { start: number; end: number }) {
  return Math.max(segA.start, segB.start) < Math.min(segA.end, segB.end)
}

function buildShiftSegments(config: {
  shift1Start?: string
  shift1End?: string
  shift1BreakStart?: string
  shift1BreakEnd?: string
  shift2Start?: string
  shift2End?: string
  shift2BreakStart?: string
  shift2BreakEnd?: string
}): { work: ShiftSegment[]; breaks: ShiftSegment[] } {
  const work: ShiftSegment[] = []
  const breaks: ShiftSegment[] = []

  if (config.shift1Start && config.shift1End) {
    const shift1StartMinutes = timeToMinutes(config.shift1Start)
    const shift1EndMinutes = timeToMinutes(config.shift1End)

    if (config.shift1BreakStart && config.shift1BreakEnd) {
      const breakStartMinutes = timeToMinutes(config.shift1BreakStart)
      const breakEndMinutes = timeToMinutes(config.shift1BreakEnd)

      work.push({
        type: "WORK",
        shiftNumber: 1,
        startMinutes: shift1StartMinutes,
        endMinutes: breakStartMinutes,
        startTime: config.shift1Start,
        endTime: config.shift1BreakStart,
        shiftStartTime: config.shift1Start,
        shiftEndTime: config.shift1End,
      })

      breaks.push({
        type: "BREAK",
        shiftNumber: 1,
        breakType: "INTRA_SHIFT",
        startMinutes: breakStartMinutes,
        endMinutes: breakEndMinutes,
        startTime: config.shift1BreakStart,
        endTime: config.shift1BreakEnd,
        shiftStartTime: config.shift1Start,
        shiftEndTime: config.shift1End,
      })

      work.push({
        type: "WORK",
        shiftNumber: 1,
        startMinutes: breakEndMinutes,
        endMinutes: shift1EndMinutes,
        startTime: config.shift1BreakEnd,
        endTime: config.shift1End,
        shiftStartTime: config.shift1Start,
        shiftEndTime: config.shift1End,
      })
    } else {
      work.push({
        type: "WORK",
        shiftNumber: 1,
        startMinutes: shift1StartMinutes,
        endMinutes: shift1EndMinutes,
        startTime: config.shift1Start,
        endTime: config.shift1End,
        shiftStartTime: config.shift1Start,
        shiftEndTime: config.shift1End,
      })
    }
  }

  if (config.shift2Start && config.shift2End) {
    const shift2StartMinutes = timeToMinutes(config.shift2Start)
    const shift2EndMinutes = timeToMinutes(config.shift2End)

    if (config.shift1End) {
      const shift1EndMinutes = timeToMinutes(config.shift1End)
      if (shift1EndMinutes !== shift2StartMinutes) {
        breaks.push({
          type: "BREAK",
          shiftNumber: 2,
          breakType: "INTER_SHIFT",
          startMinutes: shift1EndMinutes,
          endMinutes: shift2StartMinutes,
          startTime: config.shift1End,
          endTime: config.shift2Start,
          shiftStartTime: config.shift2Start,
          shiftEndTime: config.shift2End,
        })
      }
    }

    if (config.shift2BreakStart && config.shift2BreakEnd) {
      const breakStartMinutes = timeToMinutes(config.shift2BreakStart)
      const breakEndMinutes = timeToMinutes(config.shift2BreakEnd)

      work.push({
        type: "WORK",
        shiftNumber: 2,
        startMinutes: shift2StartMinutes,
        endMinutes: breakStartMinutes,
        startTime: config.shift2Start,
        endTime: config.shift2BreakStart,
        shiftStartTime: config.shift2Start,
        shiftEndTime: config.shift2End,
      })

      breaks.push({
        type: "BREAK",
        shiftNumber: 2,
        breakType: "INTRA_SHIFT",
        startMinutes: breakStartMinutes,
        endMinutes: breakEndMinutes,
        startTime: config.shift2BreakStart,
        endTime: config.shift2BreakEnd,
        shiftStartTime: config.shift2Start,
        shiftEndTime: config.shift2End,
      })

      work.push({
        type: "WORK",
        shiftNumber: 2,
        startMinutes: breakEndMinutes,
        endMinutes: shift2EndMinutes,
        startTime: config.shift2BreakEnd,
        endTime: config.shift2End,
        shiftStartTime: config.shift2Start,
        shiftEndTime: config.shift2End,
      })
    } else {
      work.push({
        type: "WORK",
        shiftNumber: 2,
        startMinutes: shift2StartMinutes,
        endMinutes: shift2EndMinutes,
        startTime: config.shift2Start,
        endTime: config.shift2End,
        shiftStartTime: config.shift2Start,
        shiftEndTime: config.shift2End,
      })
    }
  }

  return { work, breaks }
}

function findNextSegment(
  segments: ShiftSegment[],
  currentMinutes: number,
  includeActive: boolean = false,
): { segment?: ShiftSegment; minutes?: number } {
  let bestSegment: ShiftSegment | undefined
  let bestMinutes = Number.POSITIVE_INFINITY

  for (const segment of segments) {
    const isActive = isMinuteInRange(currentMinutes, segment.startMinutes, segment.endMinutes)
    if (isActive) {
      if (includeActive) {
        return { segment, minutes: 0 }
      }
      continue
    }

    const minutesUntil = minutesUntilRangeStart(currentMinutes, segment.startMinutes, segment.endMinutes)
    if (minutesUntil > 0 && minutesUntil < bestMinutes) {
      bestMinutes = minutesUntil
      bestSegment = segment
    }
  }

  if (!bestSegment || !Number.isFinite(bestMinutes)) {
    return {}
  }

  return { segment: bestSegment, minutes: bestMinutes }
}

function evaluateWorkerAvailability(config: ShiftEvaluationConfig): WorkerAvailability {
  const now = new Date()
  const { hours, minutes } = getDatePartsForTimezone(now, config.timezoneOffsetMinutes)
  let currentMinutes = hours * 60 + minutes
  if (currentMinutes < 0) {
    currentMinutes += 24 * 60
  }

  const { work, breaks } = buildShiftSegments({
    shift1Start: config.shift1Start,
    shift1End: config.shift1End,
    shift1BreakStart: config.shift1BreakStart,
    shift1BreakEnd: config.shift1BreakEnd,
    shift2Start: config.shift2Start,
    shift2End: config.shift2End,
    shift2BreakStart: config.shift2BreakStart,
    shift2BreakEnd: config.shift2BreakEnd,
  })

  const availability: WorkerAvailability = {
    workerId: config.workerId,
    status: "OFF_DUTY",
  }

  if (!config.shift1Start || !config.shift1End) {
    console.warn(
      "[ShiftUtils] Missing primary shift times, assuming worker is available",
      config.workerId,
      { shift1Start: config.shift1Start, shift1End: config.shift1End },
    )
    availability.status = "AVAILABLE"
    availability.shiftStart = config.shift1Start
    availability.shiftEnd = config.shift1End
    return availability
  }

  const activeWork = work.find((segment) => isMinuteInRange(currentMinutes, segment.startMinutes, segment.endMinutes))
  const activeBreak = breaks.find((segment) =>
    isMinuteInRange(currentMinutes, segment.startMinutes, segment.endMinutes),
  )

  if (activeWork) {
    const minutesUntilChange = minutesUntilRangeEnd(
      currentMinutes,
      activeWork.startMinutes,
      activeWork.endMinutes,
    )
    const minutesUntilShiftEnds = minutesUntilRangeEnd(
      currentMinutes,
      activeWork.startMinutes,
      timeToMinutes(activeWork.shiftEndTime ?? activeWork.endTime),
    )
    const isEndingSoon = minutesUntilChange > 0 && minutesUntilChange <= 30

    availability.status = "AVAILABLE"
    availability.currentShift = activeWork.shiftNumber
    availability.shiftStart = activeWork.shiftStartTime ?? activeWork.startTime
    availability.shiftEnd = activeWork.shiftEndTime ?? activeWork.endTime
    availability.minutesUntilStateChange = minutesUntilChange
    availability.isEndingSoon = isEndingSoon

    // If there is another work segment later today, expose next shift info
    const nextSegment = findNextSegment(work, currentMinutes)
    if (nextSegment.segment && nextSegment.minutes !== undefined) {
      availability.nextShiftNumber = nextSegment.segment.shiftNumber
      availability.nextShiftStart = nextSegment.segment.startTime
      availability.minutesUntilNextShift = nextSegment.minutes
    }

    if (minutesUntilShiftEnds > minutesUntilChange) {
      availability.minutesUntilNextShift = availability.minutesUntilNextShift ?? minutesUntilShiftEnds
    }

    return availability
  }

  if (activeBreak) {
    const minutesUntilChange = minutesUntilRangeEnd(
      currentMinutes,
      activeBreak.startMinutes,
      activeBreak.endMinutes,
    )
    availability.status = "SHIFT_BREAK"
    availability.breakStart = activeBreak.startTime
    availability.breakEnd = activeBreak.endTime
    availability.breakType = activeBreak.breakType
    availability.currentShift = activeBreak.shiftNumber
    availability.minutesUntilStateChange = minutesUntilChange

    if (activeBreak.breakType === "INTER_SHIFT") {
      availability.nextShiftNumber =  activeBreak.shiftNumber
      availability.nextShiftStart = activeBreak.endTime
      availability.minutesUntilNextShift = minutesUntilChange
    } else {
      const nextWork = findNextSegment(work, currentMinutes)
      if (nextWork.segment && nextWork.minutes !== undefined) {
        availability.nextShiftNumber = nextWork.segment.shiftNumber
        availability.nextShiftStart = nextWork.segment.startTime
        availability.minutesUntilNextShift = nextWork.minutes
      }
    }

    return availability
  }

  const upcoming = findNextSegment(work, currentMinutes)
  if (upcoming.segment && upcoming.minutes !== undefined) {
    availability.nextShiftNumber = upcoming.segment.shiftNumber
    availability.nextShiftStart = upcoming.segment.startTime
    availability.minutesUntilNextShift = upcoming.minutes
  }

  return availability
}

export function isWorkerOnShiftFromUser(user: User, options?: ShiftTimeOptions): WorkerAvailability {
  return evaluateWorkerAvailability({
    workerId: user.id,
    shift1Start: user.shift_start,
    shift1End: user.shift_end,
    shift1BreakStart: user.has_break ? user.break_start : undefined,
    shift1BreakEnd: user.has_break ? user.break_end : undefined,
    shift2Start:
      user.is_dual_shift || user.has_shift_2 ? user.shift_2_start : undefined,
    shift2End:
      user.is_dual_shift || user.has_shift_2 ? user.shift_2_end : undefined,
    shift2BreakStart:
      user.shift_2_has_break ? user.shift_2_break_start : undefined,
    shift2BreakEnd:
      user.shift_2_has_break ? user.shift_2_break_end : undefined,
    timezoneOffsetMinutes: options?.timezoneOffsetMinutes,
  })
}

// Check if worker is currently on shift (legacy function for backward compatibility)
export function isWorkerOnShift(shifts: Shift[], workerId: string): WorkerAvailability {
  const now = new Date()
  const currentDay = now.getDay() // 0=Sunday, 1=Monday, etc.
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  // Identify today's shift entries for this worker
  const todaysShifts = shifts.filter((shift) => {
    if (shift.worker_id !== workerId) return false
    if (!shift.days_of_week.includes(currentDay)) return false

    const effectiveDate = new Date(shift.effective_from)
    return effectiveDate <= now
  })

  // Prefer the shift that is currently active
  const activeShift = todaysShifts.find((shift) => {
    const shiftStartMinutes = timeToMinutes(shift.shift_start)
    const shiftEndMinutes = timeToMinutes(shift.shift_end)
    return isMinuteInRange(currentMinutes, shiftStartMinutes, shiftEndMinutes)
  })

  if (activeShift) {
    return evaluateWorkerAvailability({
      workerId,
      shift1Start: activeShift.shift_start,
      shift1End: activeShift.shift_end,
    })
  }

  if (!activeShift) {
    // If there is an upcoming shift later today, surface the next start time
    const nextShift = todaysShifts
      .map((shift) => ({
        shift,
        minutesUntil: minutesUntilRangeStart(
          currentMinutes,
          timeToMinutes(shift.shift_start),
          timeToMinutes(shift.shift_end),
        ),
      }))
      .sort((a, b) => a.minutesUntil - b.minutesUntil)[0]

    if (nextShift && Number.isFinite(nextShift.minutesUntil)) {
      return {
        workerId,
        status: "OFF_DUTY",
        nextShiftNumber: 1,
        nextShiftStart: nextShift.shift.shift_start,
        minutesUntilNextShift: nextShift.minutesUntil,
      }
    }

    return { workerId, status: "OFF_DUTY" }
  }

  return { workerId, status: "OFF_DUTY" }
}

export function canAssignTaskToUser(user: User, expectedDuration: number): { canAssign: boolean; reason?: string } {
  const availability = isWorkerOnShiftFromUser(user)

  if (availability.status === "OFF_DUTY") {
    return {
      canAssign: false,
      reason: "Worker is currently off duty",
    }
  }

  if (availability.status === "SHIFT_BREAK") {
    return {
      canAssign: false,
      reason: "Worker is currently on a scheduled break",
    }
  }

  const minutesRemaining = availability.minutesUntilStateChange
  if (availability.status === "AVAILABLE" && typeof minutesRemaining === "number" && minutesRemaining > 0) {
    if (expectedDuration > minutesRemaining) {
      return {
        canAssign: false,
        reason: `Task duration (${expectedDuration}min) exceeds the remaining available time before status change (${minutesRemaining}min)`,
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

  if (availability.status === "SHIFT_BREAK") {
    return {
      canAssign: false,
      reason: "Worker is currently on a scheduled break",
    }
  }

  const minutesRemaining = availability.minutesUntilStateChange
  if (availability.status === "AVAILABLE" && typeof minutesRemaining === "number" && minutesRemaining > 0) {
    if (expectedDuration > minutesRemaining) {
      return {
        canAssign: false,
        reason: `Task duration (${expectedDuration}min) exceeds the remaining available time before status change (${minutesRemaining}min)`,
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
  return (
    availability.status === "AVAILABLE" &&
    typeof availability.minutesUntilStateChange === "number" &&
    availability.minutesUntilStateChange <= 30
  )
}

// Check if worker needs to handover tasks (30min before shift end) (legacy function)
export function needsHandover(shifts: Shift[], workerId: string): boolean {
  const availability = isWorkerOnShift(shifts, workerId)
  return (
    availability.status === "AVAILABLE" &&
    typeof availability.minutesUntilStateChange === "number" &&
    availability.minutesUntilStateChange <= 30
  )
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
  isDualShift: boolean = false,
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

  // Check if break duration is reasonable (more flexible for dual shifts)
  const breakDuration = segmentDuration(breakStartMinutes, breakEndMinutes)
  const maxBreakDuration = isDualShift ? MAX_DUAL_SHIFT_BREAK_MINUTES : MAX_SINGLE_SHIFT_BREAK_MINUTES
  if (breakDuration > maxBreakDuration) {
    return {
      valid: false,
      error: `Break duration cannot exceed ${maxBreakDuration / 60} hours`,
    }
  }

  return { valid: true }
}

// Validate dual shift times
export function validateDualShiftTimes(
  shift1Start: string,
  shift1End: string,
  shift1BreakStart?: string,
  shift1BreakEnd?: string,
  shift2Start?: string,
  shift2End?: string,
  shift2BreakStart?: string,
  shift2BreakEnd?: string,
): { valid: boolean; error?: string } {
  // Validate shift 1
  const shift1Validation = validateShiftTimes(shift1Start, shift1End)
  if (!shift1Validation.valid) {
    return shift1Validation
  }

  // Validate shift 1 break if present
  if (shift1BreakStart && shift1BreakEnd) {
    const break1Validation = validateBreakTimes(shift1Start, shift1End, shift1BreakStart, shift1BreakEnd, true)
    if (!break1Validation.valid) {
      return break1Validation
    }
  }

  // Validate shift 2 if present
  if (shift2Start && shift2End) {
    const shift2Validation = validateShiftTimes(shift2Start, shift2End)
    if (!shift2Validation.valid) {
      return shift2Validation
    }

    // Validate shift 2 break if present
    if (shift2BreakStart && shift2BreakEnd) {
      const break2Validation = validateBreakTimes(shift2Start, shift2End, shift2BreakStart, shift2BreakEnd, true)
      if (!break2Validation.valid) {
        return break2Validation
      }
    }

    // Check for overlap between shift 1 and shift 2
    const overlapValidation = validateShiftOverlap(shift1Start, shift1End, shift2Start, shift2End)
    if (!overlapValidation.valid) {
      return overlapValidation
    }

    const interShiftBreakMinutes = differenceInMinutes(shift1End, shift2Start)
    if (interShiftBreakMinutes < MIN_INTER_SHIFT_BREAK_MINUTES) {
      return {
        valid: false,
        error: "Second shift must start after the first shift ends",
      }
    }

    if (interShiftBreakMinutes > MAX_INTER_SHIFT_BREAK_MINUTES) {
      return {
        valid: false,
        error: `Break between shifts cannot exceed ${Math.floor(MAX_INTER_SHIFT_BREAK_MINUTES / 60)} hours`,
      }
    }
  }

  return { valid: true }
}

// Validate shift times (basic validation)
function validateShiftTimes(
  shiftStart: string,
  shiftEnd: string,
): { valid: boolean; error?: string } {
  const startMinutes = timeToMinutes(shiftStart)
  const endMinutes = timeToMinutes(shiftEnd)

  // Check if shift duration is reasonable (1-12 hours)
  let duration = endMinutes - startMinutes
  if (duration < 0) {
    duration += 24 * 60 // Handle overnight shifts
  }

  if (duration < 60 || duration > 720) {
    return {
      valid: false,
      error: "Shift duration must be between 1 and 12 hours",
    }
  }

  return { valid: true }
}

// Validate shift overlap
function validateShiftOverlap(
  shift1Start: string,
  shift1End: string,
  shift2Start: string,
  shift2End: string,
): { valid: boolean; error?: string } {
  const start1Minutes = timeToMinutes(shift1Start)
  const end1Minutes = timeToMinutes(shift1End)
  const start2Minutes = timeToMinutes(shift2Start)
  const end2Minutes = timeToMinutes(shift2End)

  const shift1Segments = expandMinutesRange(start1Minutes, end1Minutes)
  const shift2Segments = expandMinutesRange(start2Minutes, end2Minutes)

  const hasOverlap = shift1Segments.some((seg1) =>
    shift2Segments.some((seg2) => segmentsOverlap(seg1, seg2)),
  )

  if (hasOverlap) {
    return {
      valid: false,
      error: "Shift 1 and Shift 2 cannot overlap",
    }
  }

  return { valid: true }
}

// Calculate total working hours for dual shifts
export function calculateDualShiftWorkingHours(
  shift1Start: string,
  shift1End: string,
  shift1HasBreak: boolean,
  shift1BreakStart?: string,
  shift1BreakEnd?: string,
  shift2Start?: string,
  shift2End?: string,
  shift2HasBreak?: boolean,
  shift2BreakStart?: string,
  shift2BreakEnd?: string,
): {
  totalHours: number;
  breakHours: number;
  workingHours: number;
  formatted: string;
  shift1Hours?: number;
  shift2Hours?: number;
} {
  // Calculate shift 1 hours
  const shift1Result = calculateWorkingHours(shift1Start, shift1End, shift1HasBreak, shift1BreakStart, shift1BreakEnd)
  
  let totalHours = shift1Result.totalHours
  let breakHours = shift1Result.breakHours
  let workingHours = shift1Result.workingHours
  let shift2Hours: number | undefined

  // Calculate shift 2 hours if present
  if (shift2Start && shift2End) {
    const shift2Result = calculateWorkingHours(
      shift2Start,
      shift2End,
      Boolean(shift2HasBreak),
      shift2BreakStart,
      shift2BreakEnd,
    )
    totalHours += shift2Result.totalHours
    breakHours += shift2Result.breakHours
    workingHours += shift2Result.workingHours
    shift2Hours = shift2Result.workingHours
  }

  return {
    totalHours,
    breakHours,
    workingHours,
    formatted: `${workingHours.toFixed(1)} hours total (${breakHours.toFixed(1)}h break)`,
    shift1Hours: shift1Result.workingHours,
    shift2Hours,
  }
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
    // Dual shift fields
    has_shift_2?: boolean
    is_dual_shift?: boolean
    shift_1_start?: string
    shift_1_end?: string
    shift_1_break_start?: string
    shift_1_break_end?: string
    shift_2_start?: string
    shift_2_end?: string
    shift_2_break_start?: string
    shift_2_break_end?: string
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
  // Dual shift info
  has_shift_2?: boolean
  is_dual_shift?: boolean
  shift_1_start?: string
  shift_1_end?: string
  shift_1_break_start?: string
  shift_1_break_end?: string
  shift_2_start?: string
  shift_2_end?: string
  shift_2_has_break?: boolean
  shift_2_break_start?: string
  shift_2_break_end?: string
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
    const shift1Start = schedule.shift_1_start ?? schedule.shift_start ?? worker.shift_start ?? "00:00"
    const shift1End = schedule.shift_1_end ?? schedule.shift_end ?? worker.shift_end ?? "23:59"
    if (!shift1Start || !shift1End) {
      console.warn(
        "[ShiftUtils] Schedule missing shift times, using fallback defaults:",
        worker.name,
        { date: dateStr, shiftStart: shift1Start, shiftEnd: shift1End },
      )
    }

    const shift1BreakStart = schedule.shift_1_break_start ?? schedule.break_start
    const shift1BreakEnd = schedule.shift_1_break_end ?? schedule.break_end
    const shift1HasBreak = Boolean(shift1BreakStart && shift1BreakEnd)
    let shift2Start = schedule.shift_2_start ?? undefined
    let shift2End = schedule.shift_2_end ?? undefined
    let shift2HasBreak = Boolean(schedule.shift_2_break_start && schedule.shift_2_break_end)
    let finalHasShift2 =
      schedule.has_shift_2 || schedule.is_dual_shift || Boolean(shift2Start && shift2End)

    // If dual-shift columns are missing but a break exists, derive shift segments.
    if (!finalHasShift2 && schedule.break_start && schedule.break_end && shift1End !== schedule.break_start) {
      finalHasShift2 = true
      shift2Start = schedule.break_end ?? undefined
      shift2End = schedule.shift_end ?? shift1End
      shift2HasBreak = false
    }

    return {
      shift_start: shift1Start,
      shift_end: shift1HasBreak && finalHasShift2 && schedule.break_start ? schedule.shift_end ?? shift1End : shift1End,
      has_break: shift1HasBreak,
      break_start: shift1HasBreak ? shift1BreakStart : undefined,
      break_end: shift1HasBreak ? shift1BreakEnd : undefined,
      shift_1_start: shift1Start,
      shift_1_end:
        shift1HasBreak && finalHasShift2 && schedule.break_start ? schedule.break_start : shift1End,
      shift_1_break_start: shift1HasBreak ? shift1BreakStart : undefined,
      shift_1_break_end: shift1HasBreak ? shift1BreakEnd : undefined,
      is_override: schedule.is_override,
      override_reason: schedule.override_reason,
      // Dual shift information
      has_shift_2: finalHasShift2,
      is_dual_shift: schedule.is_dual_shift,
      shift_2_start: finalHasShift2 ? shift2Start : undefined,
      shift_2_end: finalHasShift2 ? shift2End : undefined,
      shift_2_has_break: shift2HasBreak,
      shift_2_break_start: shift2HasBreak ? schedule.shift_2_break_start : undefined,
      shift_2_break_end: shift2HasBreak ? schedule.shift_2_break_end : undefined,
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
  const workerHasShift2 = Boolean(worker.is_dual_shift || worker.has_shift_2)
  const shift2HasBreak = Boolean(worker.shift_2_has_break && worker.shift_2_break_start && worker.shift_2_break_end)

  return {
    shift_start: defaultShiftStart,
    shift_end: defaultShiftEnd,
    has_break: hasBreak,
    break_start: hasBreak ? worker.break_start : undefined,
    break_end: hasBreak ? worker.break_end : undefined,
    shift_1_start: defaultShiftStart,
    shift_1_end: defaultShiftEnd,
    shift_1_break_start: hasBreak ? worker.break_start : undefined,
    shift_1_break_end: hasBreak ? worker.break_end : undefined,
    is_override: false,
    // Dual shift defaults
    has_shift_2: workerHasShift2,
    is_dual_shift: Boolean(worker.is_dual_shift),
    shift_2_start: workerHasShift2 ? worker.shift_2_start : undefined,
    shift_2_end: workerHasShift2 ? worker.shift_2_end : undefined,
    shift_2_has_break: shift2HasBreak,
    shift_2_break_start: shift2HasBreak ? worker.shift_2_break_start : undefined,
    shift_2_break_end: shift2HasBreak ? worker.shift_2_break_end : undefined,
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
    has_shift_2?: boolean
    is_dual_shift?: boolean
    shift_1_start?: string
    shift_1_end?: string
    shift_1_break_start?: string
    shift_1_break_end?: string
    shift_2_start?: string
    shift_2_end?: string
    shift_2_break_start?: string
    shift_2_break_end?: string
  }>,
  options?: ShiftTimeOptions,
): WorkerAvailability {
  const now = new Date()
  const timezoneOffset = options?.timezoneOffsetMinutes
  const todayShift = getWorkerShiftForDate(user, now, shiftSchedules, options)
  const hasActiveShift =
    Boolean(todayShift.shift_start && todayShift.shift_end) ||
    Boolean(todayShift.shift_2_start && todayShift.shift_2_end)

  if (todayShift.is_override && !hasActiveShift) {
    return { workerId: user.id, status: "OFF_DUTY" }
  }

  const shift1Start = todayShift.shift_1_start ?? todayShift.shift_start
  const shift1End = todayShift.shift_1_end ?? todayShift.shift_end

  const shift1BreakStart =
    todayShift.shift_1_break_start ??
    (todayShift.has_break ? todayShift.break_start : undefined)
  const shift1BreakEnd =
    todayShift.shift_1_break_end ??
    (todayShift.has_break ? todayShift.break_end : undefined)

  const hasShift2 =
    todayShift.has_shift_2 ||
    todayShift.is_dual_shift ||
    Boolean(todayShift.shift_2_start && todayShift.shift_2_end)

  const shift2BreakStart = todayShift.shift_2_break_start
  const shift2BreakEnd = todayShift.shift_2_break_end

  return evaluateWorkerAvailability({
    workerId: user.id,
    shift1Start: shift1Start ?? user.shift_start,
    shift1End: shift1End ?? user.shift_end,
    shift1BreakStart,
    shift1BreakEnd,
    shift2Start: hasShift2 ? todayShift.shift_2_start : undefined,
    shift2End: hasShift2 ? todayShift.shift_2_end : undefined,
    shift2BreakStart: hasShift2 ? shift2BreakStart : undefined,
    shift2BreakEnd: hasShift2 ? shift2BreakEnd : undefined,
    timezoneOffsetMinutes: timezoneOffset,
  })
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
