import { Badge } from "@/components/ui/badge"
import { AlertTriangle } from "lucide-react"
import type { Task } from "@/lib/types"

interface EscalationBadgeProps {
  task: Task
}

export function EscalationBadge({ task }: EscalationBadgeProps) {
  if (task.status !== "IN_PROGRESS" || !task.started_at) return null

  const startTime = new Date(task.started_at.client).getTime()
  const now = Date.now()

  // Calculate pause duration
  let pausedDuration = 0
  task.pause_history.forEach((pause) => {
    if (pause.resumed_at) {
      const pauseStart = new Date(pause.paused_at.client).getTime()
      const pauseEnd = new Date(pause.resumed_at.client).getTime()
      pausedDuration += pauseEnd - pauseStart
    } else {
      // Currently paused
      const pauseStart = new Date(pause.paused_at.client).getTime()
      pausedDuration += now - pauseStart
    }
  })

  const elapsedMinutes = Math.floor((now - startTime - pausedDuration) / 60000)
  const expectedMinutes = task.expected_duration_minutes

  // Escalation thresholds
  const fiftyPercentOvertime = expectedMinutes * 1.5

  if (elapsedMinutes >= fiftyPercentOvertime) {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertTriangle className="h-3 w-3" />
        50% Overtime
      </Badge>
    )
  }

  if (elapsedMinutes >= 20) {
    return (
      <Badge variant="destructive" className="gap-1 bg-orange-500">
        <AlertTriangle className="h-3 w-3" />
        20+ min
      </Badge>
    )
  }

  if (elapsedMinutes >= 15) {
    return (
      <Badge variant="secondary" className="gap-1 bg-yellow-500 text-white">
        <AlertTriangle className="h-3 w-3" />
        15+ min
      </Badge>
    )
  }

  return null
}
