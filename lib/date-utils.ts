// Utility functions for date formatting

export function formatTimestamp(timestamp: { client: string; server: string } | string): string {
  const dateStr = typeof timestamp === "string" ? timestamp : timestamp.client
  const date = new Date(dateStr)

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

export function formatFullTimestamp(timestamp: { client: string; server: string } | string): string {
  const dateStr = typeof timestamp === "string" ? timestamp : timestamp.client
  const date = new Date(dateStr)

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

export function formatExactTimestamp(timestamp: { client: string; server: string } | string): string {
  const dateStr = typeof timestamp === "string" ? timestamp : timestamp.client
  const date = new Date(dateStr)

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

export function calculateDuration(
  startTimestamp: { client: string; server: string } | string,
  endTimestamp: { client: string; server: string } | string,
): string {
  const startStr = typeof startTimestamp === "string" ? startTimestamp : startTimestamp.client
  const endStr = typeof endTimestamp === "string" ? endTimestamp : endTimestamp.client

  const start = new Date(startStr)
  const end = new Date(endStr)

  const diffMs = end.getTime() - start.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 60) {
    return `${diffMins}m`
  }

  const hours = Math.floor(diffMins / 60)
  const mins = diffMins % 60

  if (mins === 0) {
    return `${hours}h`
  }

  return `${hours}h ${mins}m`
}

export function calculateShiftHours(shiftStart: string, shiftEnd: string): string {
  // Parse time strings in HH:MM format
  const [startHour, startMin] = shiftStart.split(":").map(Number)
  const [endHour, endMin] = shiftEnd.split(":").map(Number)

  // Calculate total minutes
  let totalMinutes = endHour * 60 + endMin - (startHour * 60 + startMin)

  // Handle overnight shifts (e.g., 22:00 to 06:00)
  if (totalMinutes < 0) {
    totalMinutes += 24 * 60
  }

  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (minutes === 0) {
    return `${hours}h`
  }

  return `${hours}h ${minutes}m`
}

export function formatShiftTime(time: string): string {
  // Convert 24-hour format (HH:MM) to 12-hour format with AM/PM
  const [hour, minute] = time.split(":").map(Number)
  const period = hour >= 12 ? "PM" : "AM"
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour

  return `${displayHour}:${minute.toString().padStart(2, "0")} ${period}`
}

export function formatShiftRange(shiftStart: string, shiftEnd: string): string {
  return `${formatShiftTime(shiftStart)} - ${formatShiftTime(shiftEnd)}`
}

export function formatDistanceToNow(date: Date | string): string {
  const now = new Date()
  const targetDate = typeof date === "string" ? new Date(date) : date
  const diffMs = now.getTime() - targetDate.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSecs < 60) {
    return "just now"
  } else if (diffMins < 60) {
    return `${diffMins} minute${diffMins !== 1 ? "s" : ""} ago`
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`
  } else if (diffDays < 30) {
    return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`
  } else {
    const diffMonths = Math.floor(diffDays / 30)
    return `${diffMonths} month${diffMonths !== 1 ? "s" : ""} ago`
  }
}

export function startOfMonth(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function endOfMonth(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
}

export function calculateWorkingHours(
  shiftStart: string,
  shiftEnd: string,
  hasBreak: boolean,
  breakStart?: string,
  breakEnd?: string,
): { totalHours: number; breakHours: number; workingHours: number; formatted: string } {
  // Calculate total shift hours
  const [startHour, startMin] = shiftStart.split(":").map(Number)
  const [endHour, endMin] = shiftEnd.split(":").map(Number)

  let totalMinutes = endHour * 60 + endMin - (startHour * 60 + startMin)

  // Handle overnight shifts
  if (totalMinutes < 0) {
    totalMinutes += 24 * 60
  }

  const totalHours = totalMinutes / 60

  if (!hasBreak || !breakStart || !breakEnd) {
    return {
      totalHours,
      breakHours: 0,
      workingHours: totalHours,
      formatted: `${totalHours.toFixed(1)} hours`,
    }
  }

  // Calculate break duration
  const [breakStartHour, breakStartMin] = breakStart.split(":").map(Number)
  const [breakEndHour, breakEndMin] = breakEnd.split(":").map(Number)
  const breakMinutes = breakEndHour * 60 + breakEndMin - (breakStartHour * 60 + breakStartMin)
  const breakHours = breakMinutes / 60

  const workingHours = totalHours - breakHours

  return {
    totalHours,
    breakHours,
    workingHours,
    formatted: `${workingHours.toFixed(1)} hours (${breakHours.toFixed(1)}h break)`,
  }
}

// Calculate working hours for dual shifts
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
    const shift2Result = calculateWorkingHours(shift2Start, shift2End, shift2HasBreak || false, shift2BreakStart, shift2BreakEnd)
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
