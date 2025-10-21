"use client"

import { Badge } from "@/components/ui/badge"
import { Clock, AlertCircle, CheckCircle } from "lucide-react"
import type { WorkerAvailability } from "@/lib/shift-utils"

interface ShiftBadgeProps {
  availability: WorkerAvailability
  showDetails?: boolean
}

export function ShiftBadge({ availability, showDetails = false }: ShiftBadgeProps) {
  if (availability.status === "ON_SHIFT") {
    return (
      <Badge variant="default" className="bg-green-500 text-white flex items-center gap-1">
        <CheckCircle className="h-3 w-3" />
        On Shift
        {showDetails && availability.minutesUntilEnd && (
          <span className="ml-1 text-xs">({availability.minutesUntilEnd}min left)</span>
        )}
      </Badge>
    )
  }

  if (availability.status === "ENDING_SOON") {
    return (
      <Badge variant="default" className="bg-orange-500 text-white flex items-center gap-1">
        <AlertCircle className="h-3 w-3" />
        Ending Soon
        {showDetails && availability.minutesUntilEnd && (
          <span className="ml-1 text-xs">({availability.minutesUntilEnd}min)</span>
        )}
      </Badge>
    )
  }

  return (
    <Badge variant="secondary" className="flex items-center gap-1">
      <Clock className="h-3 w-3" />
      Off-Duty
    </Badge>
  )
}
