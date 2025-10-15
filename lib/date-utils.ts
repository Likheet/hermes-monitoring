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
