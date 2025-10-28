/**
 * Converts 24-hour time (HH:MM) to 12-hour format with AM/PM
 * @param time24 - Time in 24-hour format (e.g., "14:30")
 * @returns Time in 12-hour format (e.g., "2:30 PM")
 */
export function convert24To12Hour(time24: string): string {
  if (!time24 || !time24.includes(":")) return ""

  const [hours24, minutes] = time24.split(":").map(Number)

  if (isNaN(hours24) || isNaN(minutes)) return ""

  const period = hours24 >= 12 ? "PM" : "AM"
  const hours12 = hours24 % 12 || 12 // Convert 0 to 12 for midnight

  return `${hours12}:${minutes.toString().padStart(2, "0")} ${period}`
}

/**
 * Converts 12-hour time with AM/PM to 24-hour format
 * @param time12 - Time in 12-hour format (e.g., "2:30 PM")
 * @param period - AM or PM
 * @returns Time in 24-hour format (e.g., "14:30")
 */
export function convert12To24Hour(time12: string, period: "AM" | "PM"): string {
  if (!time12 || !time12.includes(":")) return ""

  const [hours12Str, minutesStr] = time12.split(":")
  const hours12 = Number.parseInt(hours12Str)
  const minutes = Number.parseInt(minutesStr)

  if (isNaN(hours12) || isNaN(minutes) || hours12 < 1 || hours12 > 12) return ""

  let hours24 = hours12

  if (period === "PM" && hours12 !== 12) {
    hours24 = hours12 + 12
  } else if (period === "AM" && hours12 === 12) {
    hours24 = 0
  }

  return `${hours24.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`
}

/**
 * Validates 12-hour time format
 * @param time - Time string (e.g., "2:30")
 * @returns true if valid, false otherwise
 */
export function validate12HourTime(time: string): boolean {
  if (!time || !time.includes(":")) return false

  const [hoursStr, minutesStr] = time.split(":")
  const hours = Number.parseInt(hoursStr)
  const minutes = Number.parseInt(minutesStr)

  return !isNaN(hours) && !isNaN(minutes) && hours >= 1 && hours <= 12 && minutes >= 0 && minutes <= 59
}

export function formatDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const seconds = safeSeconds % 60

  const paddedHours = hours.toString().padStart(2, "0")
  const paddedMinutes = minutes.toString().padStart(2, "0")
  const paddedSeconds = seconds.toString().padStart(2, "0")

  return `${paddedHours}:${paddedMinutes}:${paddedSeconds}`
}
