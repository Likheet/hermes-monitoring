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
  href?: string
}

export function TaskCard({ task, href }: TaskCardProps) {
  const getPhotoRequirementText = () => {
    if (task.photo_documentation_required && task.photo_categories) {
      const totalPhotos = task.photo_categories.reduce((sum: number, cat: any) => sum + cat.count, 0)
      const types = task.photo_categories.length
      return `${totalPhotos} photo${totalPhotos > 1 ? "s" : ""} (${types} type${types > 1 ? "s" : ""})`
    }
    if (task.photo_required) {
      const count = task.photo_count || task.custom_task_photo_count || 1
      return `${count} photo${count > 1 ? "s" : ""} required`
    }
    return null
  }

  const photoText = getPhotoRequirementText()
  // </CHANGE>

  const destination = href ?? `/worker/${task.id}`

  return (
    <Link href={destination}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer active:scale-[0.98] min-h-[120px] touch-manipulation">
        <CardHeader className="pb-3 px-4 sm:px-6 pt-4 sm:pt-6">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base sm:text-lg line-clamp-2">{task.task_type}</CardTitle>
            <Badge
              className={`${priorityColors[task.priority_level]} text-xs px-2 sm:px-3 py-1 shrink-0`}
              variant="secondary"
            >
              <span className="hidden sm:inline">{task.priority_level.replace(/_/g, " ")}</span>
              <span className="sm:hidden">{task.priority_level.split("_")[0]}</span>
            </Badge>
          </div>
          {/* Display both worker and supervisor remarks */}
          {task.worker_remark && (
            <p className="text-sm text-blue-600 mt-2 line-clamp-2 italic">
              <span className="font-medium">Remark:</span> "{task.worker_remark}"
            </p>
          )}
          {task.supervisor_remark && (
            <p className="text-sm text-orange-600 mt-2 line-clamp-2 italic">
              <span className="font-medium">Supervisor:</span> "{task.supervisor_remark}"
            </p>
          )}
          {/* </CHANGE> */}
        </CardHeader>
        <CardContent className="space-y-2 px-4 sm:px-6 pb-4 sm:pb-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
            <span className="truncate">Room {task.room_number}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
            <span className="truncate">{task.expected_duration_minutes} min expected</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarClock className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
            <span className="truncate">Assigned {formatTimestamp(task.assigned_at)}</span>
          </div>
          {/* Enhanced photo display with categorized photos support */}
          {photoText && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Camera className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
              <span>{photoText}</span>
            </div>
          )}

          {/* Display categorized photos if available */}
          {task.categorized_photos && (
            <div className="mt-2 space-y-1">
              <div className="text-sm font-medium text-muted-foreground mb-1">
                <Camera className="h-3 w-3 mr-1" />
                Task Photos ({task.categorized_photos.room_photos?.length || 0 + task.categorized_photos.proof_photos?.length || 0})
              </div>
              <div className="flex gap-1">
                {task.categorized_photos.room_photos?.slice(0, 3).map((url, index) => (
                  <img
                    key={`room-${index}`}
                    src={url}
                    alt="Room photo"
                    className="w-12 h-12 object-cover rounded border cursor-pointer hover:opacity-80"
                    onClick={() => console.log('Room photo clicked:', url)}
                  />
                ))}
                {task.categorized_photos.room_photos?.length > 3 && (
                  <div className="w-12 h-12 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">
                    +{task.categorized_photos.room_photos.length - 3}
                  </div>
                )}
              </div>

              {task.categorized_photos.proof_photos?.length > 0 && (
                <>
                  <div className="text-sm font-medium text-muted-foreground mb-1 mt-2">
                    <Camera className="h-3 w-3 mr-1" />
                    Proof Photos ({task.categorized_photos.proof_photos.length})
                  </div>
                  <div className="flex gap-1">
                    {task.categorized_photos.proof_photos.slice(0, 2).map((url, index) => (
                      <img
                        key={`proof-${index}`}
                        src={url}
                        alt="Proof photo"
                        className="w-16 h-16 object-cover rounded border cursor-pointer hover:opacity-80"
                        onClick={() => console.log('Proof photo clicked:', url)}
                      />
                    ))}
                    {task.categorized_photos.proof_photos.length > 2 && (
                      <div className="w-16 h-16 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">
                        +{task.categorized_photos.proof_photos.length - 2}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
          {/* </CHANGE> */}
          <div className="flex items-center gap-2 pt-2">
            <div className={`h-3 w-3 rounded-full ${statusColors[task.status]} shrink-0`} />
            <span className="text-xs sm:text-sm font-medium truncate">
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
