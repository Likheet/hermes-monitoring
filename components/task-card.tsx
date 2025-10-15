import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { Task } from "@/lib/types"
import { Clock, MapPin, Camera, CalendarClock } from "lucide-react"
import Link from "next/link"
import { formatTimestamp, calculateDuration } from "@/lib/date-utils"

const priorityColors = {
  GUEST_REQUEST: "bg-red-500 text-white",
  TIME_SENSITIVE: "bg-orange-500 text-white",
  DAILY_TASK: "bg-blue-500 text-white",
  PREVENTIVE_MAINTENANCE: "bg-green-500 text-white",
}

const statusColors = {
  PENDING: "bg-yellow-500",
  IN_PROGRESS: "bg-blue-500",
  PAUSED: "bg-orange-500",
  COMPLETED: "bg-green-500",
  REJECTED: "bg-red-500",
}

interface TaskCardProps {
  task: Task
}

export function TaskCard({ task }: TaskCardProps) {
  return (
    <Link href={`/worker/${task.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer active:scale-[0.98] min-h-[120px]">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-lg">{task.task_type}</CardTitle>
            <Badge className={`${priorityColors[task.priority_level]} text-xs px-3 py-1`} variant="secondary">
              {task.priority_level.replace(/_/g, " ")}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-5 w-5" />
            <span>{task.room_number}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-5 w-5" />
            <span>{task.expected_duration_minutes} min expected</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarClock className="h-5 w-5" />
            <span>Assigned {formatTimestamp(task.assigned_at)}</span>
          </div>
          {task.photo_required && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Camera className="h-5 w-5" />
              <span>Photo required</span>
            </div>
          )}
          <div className="flex items-center gap-2 pt-2">
            <div className={`h-3 w-3 rounded-full ${statusColors[task.status]}`} />
            <span className="text-sm font-medium">
              {task.status === "COMPLETED" && task.started_at && task.completed_at
                ? `COMPLETED in ${calculateDuration(task.started_at, task.completed_at)}`
                : task.status.replace(/_/g, " ")}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
