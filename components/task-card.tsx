import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { Task } from "@/lib/types"
import { Clock, MapPin, Camera, CalendarClock } from "lucide-react"
import Link from "next/link"
import { formatTimestamp, calculateDuration } from "@/lib/date-utils"

const priorityColors = {
  GUEST_REQUEST: "bg-destructive text-destructive-foreground",
  TIME_SENSITIVE: "bg-accent text-accent-foreground",
  DAILY_TASK: "bg-muted text-muted-foreground",
  PREVENTIVE_MAINTENANCE: "bg-secondary text-secondary-foreground",
}

const statusColors = {
  PENDING: "bg-muted",
  IN_PROGRESS: "bg-primary",
  PAUSED: "bg-accent",
  COMPLETED: "bg-secondary",
  REJECTED: "bg-destructive",
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
