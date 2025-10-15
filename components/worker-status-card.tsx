import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { User, Task } from "@/lib/types"
import { UserIcon, Clock, AlertTriangle } from "lucide-react"
import { formatShiftTime } from "@/lib/date-utils"

interface WorkerStatusCardProps {
  worker: User
  currentTask?: Task
}

export function WorkerStatusCard({ worker, currentTask }: WorkerStatusCardProps) {
  const isWorking = currentTask && (currentTask.status === "IN_PROGRESS" || currentTask.status === "PAUSED")

  const isDelayed =
    currentTask && isWorking
      ? (() => {
          if (!currentTask.started_at) return false

          const startTime = new Date(currentTask.started_at.client).getTime()
          const now = Date.now()

          // Calculate total pause duration
          let pausedDuration = 0
          currentTask.pause_history.forEach((pause) => {
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

          const elapsedMinutes = Math.floor((now - startTime - pausedDuration) / 1000 / 60)
          return elapsedMinutes > currentTask.expected_duration_minutes
        })()
      : false

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <UserIcon className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">{worker.name}</CardTitle>
          </div>
          <Badge variant={isWorking ? "default" : "secondary"}>{isWorking ? "Working" : "Available"}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-sm text-muted-foreground">
          <p>Department: {worker.department}</p>
          <p>
            Shift:{" "}
            {worker.shift_start && worker.shift_end
              ? `${formatShiftTime(worker.shift_start)} - ${formatShiftTime(worker.shift_end)}`
              : "Not set"}
          </p>
        </div>
        {currentTask && isWorking && (
          <div className="pt-2 border-t">
            <div className="flex items-center gap-2 mb-2">
              {isDelayed && (
                <Badge variant="destructive" className="text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Delayed
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4" />
              <span className="font-medium">{currentTask.task_type}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Room {currentTask.room_number}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
