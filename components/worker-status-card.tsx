import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { User, Task } from "@/lib/types"
import type { MaintenanceTask } from "@/lib/maintenance-types"
import { UserIcon, Clock, AlertTriangle, Coffee } from "lucide-react"
import { formatShiftTime } from "@/lib/date-utils"
import { isWorkerOnShiftFromUser, getWorkerShiftForDate } from "@/lib/shift-utils"
import { useTasks } from "@/lib/task-context"

interface WorkerStatusCardProps {
  worker: User
  currentTask?: Task | MaintenanceTask
}

export function WorkerStatusCard({ worker, currentTask }: WorkerStatusCardProps) {
  const { shiftSchedules } = useTasks()

  const isRegularTask = currentTask && "assigned_to_user_id" in currentTask
  const isMaintenanceTask = currentTask && !("assigned_to_user_id" in currentTask)

  const today = new Date()
  const todayShift = getWorkerShiftForDate(worker, today, shiftSchedules)

  const availability = isWorkerOnShiftFromUser(worker)
  const isOnBreak = availability.status === "ON_BREAK"

  const isWorking = currentTask
    ? isRegularTask
      ? (currentTask as Task).status === "IN_PROGRESS" || (currentTask as Task).status === "PAUSED"
      : (currentTask as MaintenanceTask).status === "in_progress" ||
        (currentTask as MaintenanceTask).status === "paused"
    : false

  console.log("[v0] WorkerStatusCard:", {
    workerName: worker.name,
    hasCurrentTask: !!currentTask,
    taskStatus: currentTask
      ? isRegularTask
        ? (currentTask as Task).status
        : (currentTask as MaintenanceTask).status
      : "none",
    isWorking,
    isOnBreak,
    todayShift: {
      start: todayShift.shift_start,
      end: todayShift.shift_end,
      isOverride: todayShift.is_override,
      reason: todayShift.override_reason,
    },
  })

  const isDelayed =
    currentTask && isWorking && isRegularTask
      ? (() => {
          const task = currentTask as Task
          if (!task.started_at) return false

          const startTime = new Date(task.started_at.client).getTime()
          const now = Date.now()

          // Calculate total pause duration
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

          const elapsedMinutes = Math.floor((now - startTime - pausedDuration) / 1000 / 60)
          return elapsedMinutes > task.expected_duration_minutes
        })()
      : false

  const getTaskDisplay = () => {
    if (!currentTask) return null

    if (isRegularTask) {
      const task = currentTask as Task
      return {
        type: task.task_type,
        room: task.room_number,
        status: task.status,
      }
    } else {
      const task = currentTask as MaintenanceTask
      return {
        type: `${task.task_type === "ac_indoor" ? "AC Indoor" : task.task_type === "ac_outdoor" ? "AC Outdoor" : task.task_type === "fan" ? "Fan" : "Exhaust"} - ${task.location}`,
        room: task.room_number,
        status: task.status,
      }
    }
  }

  const taskDisplay = getTaskDisplay()

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <UserIcon className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">{worker.name}</CardTitle>
          </div>
          {todayShift.is_override && todayShift.override_reason ? (
            <Badge variant="secondary" className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100">
              Off Duty
            </Badge>
          ) : isOnBreak ? (
            <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100">
              <Coffee className="h-3 w-3 mr-1" />
              On break
            </Badge>
          ) : (
            <Badge variant={isWorking ? "default" : "secondary"}>{isWorking ? "Working" : "Available"}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-sm text-muted-foreground">
          <p>Department: {worker.department}</p>
          {todayShift.is_override && todayShift.override_reason ? (
            <p className="text-xs text-muted-foreground italic">{todayShift.override_reason}</p>
          ) : (
            <>
              <p>
                Shift:{" "}
                {todayShift.shift_start && todayShift.shift_end
                  ? `${formatShiftTime(todayShift.shift_start)} - ${formatShiftTime(todayShift.shift_end)}`
                  : "Not set"}
              </p>
              {todayShift.has_break && todayShift.break_start && todayShift.break_end && (
                <p className="text-xs text-muted-foreground">
                  Break: {formatShiftTime(todayShift.break_start)} - {formatShiftTime(todayShift.break_end)}
                </p>
              )}
            </>
          )}
        </div>
        {taskDisplay && isWorking && (
          <div className="pt-2 border-t">
            <div className="flex items-center gap-2 mb-2">
              {isDelayed && (
                <Badge variant="destructive" className="text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Delayed
                </Badge>
              )}
              {isMaintenanceTask && (
                <Badge variant="outline" className="text-xs bg-accent/10">
                  Maintenance
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4" />
              <span className="font-medium">{taskDisplay.type}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Room {taskDisplay.room}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
