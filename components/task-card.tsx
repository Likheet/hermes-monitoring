import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { Task } from "@/lib/types"
import { Clock, MapPin, Camera, CalendarClock } from "lucide-react"
import Link from "next/link"
import { formatTimestamp, calculateDuration } from "@/lib/date-utils"
import { TaskImage } from "@/components/task-image"

const priorityColors = {
  GUEST_REQUEST: "bg-red-50 text-red-600 border-red-100",
  TIME_SENSITIVE: "bg-orange-50 text-orange-600 border-orange-100",
  DAILY_TASK: "bg-gray-100 text-gray-600 border-gray-200",
  PREVENTIVE_MAINTENANCE: "bg-blue-50 text-blue-600 border-blue-100",
}

const statusColors = {
  PENDING: "bg-gray-200",
  IN_PROGRESS: "bg-black",
  PAUSED: "bg-orange-400",
  COMPLETED: "bg-green-500",
  REJECTED: "bg-red-500",
}

interface TaskCardProps {
  task: Task
  href?: string
}

export function TaskCard({ task, href }: TaskCardProps) {
  const getPhotoRequirementText = () => {
    if (task.photo_documentation_required && task.photo_categories) {
      const totalPhotos = task.photo_categories.reduce(
        (sum: number, cat: NonNullable<Task["photo_categories"]>[number]) => sum + cat.count,
        0,
      )
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

  const destination = href ?? `/worker/${task.id}`

  return (
    <Link href={destination}>
      <div className="bg-white rounded-xl p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] transition-all duration-200 hover:shadow-md active:scale-[0.99] touch-manipulation border-none">
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="text-lg font-bold text-black line-clamp-2 leading-tight">{task.task_type}</h3>
          <Badge
            className={`${priorityColors[task.priority_level]} text-[10px] uppercase tracking-wider font-bold px-2 py-1 shrink-0 border shadow-none rounded-lg`}
            variant="secondary"
          >
            <span className="hidden sm:inline">{task.priority_level.replace(/_/g, " ")}</span>
            <span className="sm:hidden">{task.priority_level.split("_")[0]}</span>
          </Badge>
        </div>
        
        {/* Display both worker and supervisor remarks */}
        {task.worker_remark && (
          <p className="text-sm text-blue-600 mb-3 line-clamp-2 italic bg-blue-50 p-2 rounded-lg">
            <span className="font-bold not-italic text-blue-700 text-xs uppercase tracking-wide block mb-1">Remark</span> 
            &quot;{task.worker_remark}&quot;
          </p>
        )}
        {task.supervisor_remark && (
          <p className="text-sm text-orange-600 mb-3 line-clamp-2 italic bg-orange-50 p-2 rounded-lg">
            <span className="font-bold not-italic text-orange-700 text-xs uppercase tracking-wide block mb-1">Supervisor</span> 
            &quot;{task.supervisor_remark}&quot;
          </p>
        )}

        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2.5 text-sm text-gray-500">
            <MapPin className="h-4 w-4 shrink-0 text-gray-400" />
            <span className="truncate font-medium text-black">Room {task.room_number}</span>
          </div>
          <div className="flex items-center gap-2.5 text-sm text-gray-500">
            <Clock className="h-4 w-4 shrink-0 text-gray-400" />
            <span className="truncate">{task.expected_duration_minutes} min expected</span>
          </div>
          <div className="flex items-center gap-2.5 text-sm text-gray-500">
            <CalendarClock className="h-4 w-4 shrink-0 text-gray-400" />
            <span className="truncate">Assigned {formatTimestamp(task.assigned_at)}</span>
          </div>
          {/* Enhanced photo display with categorized photos support */}
          {photoText && (
            <div className="flex items-center gap-2.5 text-sm text-gray-500">
              <Camera className="h-4 w-4 shrink-0 text-gray-400" />
              <span>{photoText}</span>
            </div>
          )}

          {/* Display categorized photos if available */}
          {task.categorized_photos && (
            <div className="mt-3 space-y-2">
              {(task.categorized_photos.room_photos?.length || 0) > 0 && (
                <div>
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    Task Photos
                  </div>
                  <div className="flex gap-2">
                    {task.categorized_photos.room_photos?.slice(0, 3).map((url, index) => (
                      <TaskImage
                        key={`room-${index}`}
                        src={url}
                        alt="Room photo"
                        width={48}
                        height={48}
                        className="w-12 h-12 object-cover rounded-lg border border-gray-100 cursor-pointer hover:opacity-80 shadow-sm"
                        onClick={() => console.log("Room photo clicked:", url)}
                      />
                    ))}
                    {(task.categorized_photos.room_photos?.length || 0) > 3 && (
                      <div className="w-12 h-12 bg-gray-50 rounded-lg flex items-center justify-center text-xs font-bold text-gray-500 border border-gray-100">
                        +{(task.categorized_photos.room_photos?.length || 0) - 3}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {(task.categorized_photos.proof_photos?.length || 0) > 0 && (
                <div>
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1 mt-2">
                    Proof Photos
                  </div>
                  <div className="flex gap-2">
                    {task.categorized_photos.proof_photos?.slice(0, 2).map((url, index) => (
                      <TaskImage
                        key={`proof-${index}`}
                        src={url}
                        alt="Proof photo"
                        width={64}
                        height={64}
                        className="w-16 h-16 object-cover rounded-lg border border-gray-100 cursor-pointer hover:opacity-80 shadow-sm"
                        onClick={() => console.log("Proof photo clicked:", url)}
                      />
                    ))}
                    {(task.categorized_photos.proof_photos?.length || 0) > 2 && (
                      <div className="w-16 h-16 bg-gray-50 rounded-lg flex items-center justify-center text-xs font-bold text-gray-500 border border-gray-100">
                        +{(task.categorized_photos.proof_photos?.length || 0) - 2}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2 pt-3 border-t border-gray-50">
          <div className={`h-2.5 w-2.5 rounded-full ${statusColors[task.status]} shrink-0`} />
          <span className="text-xs font-bold uppercase tracking-wide text-gray-600 truncate">
            {task.status === "COMPLETED" && task.started_at && task.completed_at
              ? `COMPLETED in ${calculateDuration(task.started_at, task.completed_at)}`
              : task.status.replace(/_/g, " ")}
          </span>
        </div>
      </div>
    </Link>
  )
}
