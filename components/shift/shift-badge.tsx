"use client"

import { Badge } from "@/components/ui/badge"
import { Clock, AlertCircle, CheckCircle } from "lucide-react"
import type { WorkerAvailability } from "@/lib/shift-utils"
import { formatDurationMinutes } from "@/lib/date-utils"

interface ShiftBadgeProps {
  availability: WorkerAvailability
  showDetails?: boolean
}

export function ShiftBadge({ availability, showDetails = false }: ShiftBadgeProps) {
  if (availability.status === "AVAILABLE") {
    const endingSoon = availability.isEndingSoon && availability.minutesUntilStateChange
    const label = endingSoon ? "Ending Soon" : "Available"
    return (
      <Badge
        variant="default"
        className={`flex items-center gap-1 ${endingSoon ? "bg-orange-500 text-white" : "bg-green-500 text-white"}`}
      >
        {endingSoon ? <AlertCircle className="h-3 w-3" /> : <CheckCircle className="h-3 w-3" />}
        {label}
        {showDetails && availability.minutesUntilStateChange && (
          <span className="ml-1 text-xs">
            ({formatDurationMinutes(availability.minutesUntilStateChange)})
          </span>
        )}
      </Badge>
    )
  }

  if (availability.status === "SHIFT_BREAK") {
    const isBetweenShifts = availability.breakType === "INTER_SHIFT"
    const breakCountdown =
      typeof availability.minutesUntilStateChange === "number"
        ? formatDurationMinutes(availability.minutesUntilStateChange)
        : null

    return (
      <Badge variant="default" className="bg-yellow-500 text-white flex items-center gap-1">
        <Clock className="h-3 w-3" />
        {isBetweenShifts ? "Between Shifts" : "Shift Break"}
        {showDetails && breakCountdown && (
          <span className="ml-1 text-xs">
            {isBetweenShifts ? `Next in ${breakCountdown}` : `(${breakCountdown})`}
          </span>
        )}
      </Badge>
    )
  }

  return (
    <Badge variant="secondary" className="flex items-center gap-1">
      <Clock className="h-3 w-3" />
      Off Duty
    </Badge>
  )
}
