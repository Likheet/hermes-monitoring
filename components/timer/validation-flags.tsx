"use client"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertTriangle, AlertCircle } from "lucide-react"
import type { TimerValidationFlag } from "@/lib/timer-utils"

interface ValidationFlagsProps {
  flags: TimerValidationFlag[]
}

export function ValidationFlags({ flags }: ValidationFlagsProps) {
  if (flags.length === 0) return null

  return (
    <div className="space-y-2">
      {flags.map((flag, index) => (
        <Alert
          key={index}
          variant={flag.severity === "error" ? "destructive" : "default"}
          className={flag.severity === "warning" ? "border-orange-500 bg-orange-50" : ""}
        >
          {flag.severity === "error" ? (
            <AlertCircle className="h-4 w-4" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          )}
          <AlertTitle className="text-sm font-medium">{flag.type.replace(/_/g, " ")}</AlertTitle>
          <AlertDescription className="text-xs">{flag.message}</AlertDescription>
        </Alert>
      ))}
    </div>
  )
}
