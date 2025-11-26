"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, ChevronDown, ChevronRight } from "lucide-react"
import { useTasks } from "@/lib/task-context"
import { ALL_ROOMS } from "@/lib/location-data"
import { TASK_TYPE_LABELS } from "@/lib/maintenance-types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export default function MaintenanceRoomPage() {
  const params = useParams()
  const router = useRouter()
  const roomNumber = params.roomNumber as string
  const { maintenanceTasks } = useTasks()

  const [expandedTaskType, setExpandedTaskType] = useState<string | null>(null)
  const [isRedirecting, setIsRedirecting] = useState(false)

  // Check if this is a lift task (lift IDs look like "A-Lift-1", "B-Lift-1", etc.)
  const isLiftTask = roomNumber.includes("Lift")
  
  // For lift tasks, filter by lift_id; for room tasks, filter by room_number
  const tasks = isLiftTask
    ? maintenanceTasks.filter((t) => t.lift_id === roomNumber || t.task_type === "lift" && t.location?.includes(roomNumber.split("-")[0]))
    : maintenanceTasks.filter((t) => t.room_number === roomNumber)

  // For lift tasks, if we have exactly one task, navigate directly to the task detail page
  const singleLiftTask = isLiftTask && tasks.length === 1 ? tasks[0] : null

  // Redirect for single lift task - must be in useEffect to avoid render-time navigation
  // Use replace() to avoid adding to history stack (prevents back button loop)
  useEffect(() => {
    if (singleLiftTask && !isRedirecting) {
      setIsRedirecting(true)
      const liftLocation = singleLiftTask.location || singleLiftTask.lift_id || "Lift"
      router.replace(`/worker/maintenance/${roomNumber}/lift/${encodeURIComponent(liftLocation)}`)
    }
  }, [singleLiftTask, roomNumber, router, isRedirecting])

  console.log("[v0] Room page loaded:", {
    roomNumber,
    isLiftTask,
    totalTasks: tasks.length,
    taskTypes: Array.from(new Set(tasks.map((t) => t.task_type))),
  })

  const tasksByType = tasks.reduce(
    (acc, task) => {
      if (!acc[task.task_type]) {
        acc[task.task_type] = []
      }
      acc[task.task_type].push(task)
      return acc
    },
    {} as Record<string, typeof tasks>,
  )

  const taskTypes = Object.keys(tasksByType)

  const totalTasks = tasks.length
  const completedTasks = tasks.filter((t) => t.status === "completed").length

  // For room navigation, only applicable to actual rooms, not lifts
  const currentRoomIndex = isLiftTask ? -1 : ALL_ROOMS.findIndex((r) => r.number === roomNumber)
  const previousRoom = currentRoomIndex > 0 ? ALL_ROOMS[currentRoomIndex - 1] : null
  const nextRoom = currentRoomIndex < ALL_ROOMS.length - 1 ? ALL_ROOMS[currentRoomIndex + 1] : null

  // Entity label for display
  const entityLabel = isLiftTask ? "Lift" : "Room"

  const handleLocationSelect = (taskType: string, location: string) => {
    console.log("[v0] Navigating to task:", { roomNumber, taskType, location })
    router.push(`/worker/maintenance/${roomNumber}/${taskType}/${encodeURIComponent(location)}`)
  }

  // Show loading state while redirecting for single lift task
  if (singleLiftTask || isRedirecting) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <p className="text-muted-foreground">Loading lift maintenance...</p>
      </div>
    )
  }

  if (tasks.length === 0) {
    return (
      <div className="min-h-screen bg-muted/30">
        <div className="sticky top-0 bg-card border-b-2 border-border p-4 z-10">
          <div className="container mx-auto flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-muted rounded-lg transition-colors min-h-[44px] min-w-[44px]"
            >
              <ArrowLeft className="w-6 h-6 text-muted-foreground" />
            </button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-foreground">{entityLabel} {roomNumber}</h1>
              <p className="text-sm text-muted-foreground">No maintenance tasks scheduled</p>
            </div>
          </div>
        </div>
        <div className="container mx-auto px-4 py-12 text-center">
          <p className="text-muted-foreground">No maintenance tasks are currently scheduled for this {entityLabel.toLowerCase()}.</p>
          <Button onClick={() => router.back()} variant="outline" className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Calendar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30 pb-24">
      {/* Header */}
      <div className="sticky top-0 bg-card border-b-2 border-border p-4 z-10">
        <div className="container mx-auto flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-muted rounded-lg transition-colors min-h-[44px] min-w-[44px]"
          >
            <ArrowLeft className="w-6 h-6 text-muted-foreground" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground">{entityLabel} {roomNumber}</h1>
            <p className="text-sm text-muted-foreground">
              {completedTasks}/{totalTasks} tasks completed
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-primary">{Math.round((completedTasks / totalTasks) * 100)}%</div>
          </div>
        </div>
      </div>

      {/* Task Type List - Accordion Style */}
      <div className="container mx-auto px-4 py-6 space-y-3">
        {taskTypes.map((taskType, index) => {
          const isExpanded = expandedTaskType === taskType
          const tasksForType = tasksByType[taskType] || []
          const completedCount = tasksForType.filter((t) => t.status === "completed").length
          const totalCount = tasksForType.length
          const allCompleted = completedCount === totalCount

          return (
            <div
              key={taskType}
              className={`bg-card border-2 rounded-xl overflow-hidden transition-all ${
                allCompleted ? "border-primary" : "border-border"
              }`}
            >
              {/* Task Type Header */}
              <button
                onClick={() => setExpandedTaskType(isExpanded ? null : taskType)}
                className="w-full flex items-center justify-between p-5 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-4 flex-1 text-left">
                  <div
                    className={`flex items-center justify-center w-12 h-12 rounded-full font-bold text-lg ${
                      allCompleted ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground"
                    }`}
                  >
                    {allCompleted ? "✓" : index + 1}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-foreground mb-1">
                      {TASK_TYPE_LABELS[taskType as keyof typeof TASK_TYPE_LABELS]}
                    </h3>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-muted-foreground">
                        {completedCount}/{totalCount} locations completed
                      </span>
                      {allCompleted && (
                        <Badge variant="default" className="bg-primary">
                          All Complete
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                {isExpanded ? (
                  <ChevronDown className="w-6 h-6 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-6 h-6 text-muted-foreground" />
                )}
              </button>

              {/* Expanded - Show Locations */}
              {isExpanded && (
                <div className="border-t-2 border-border p-5 space-y-2 bg-muted/30">
                  {tasksForType.map((task) => {
                    const status = task.status
                    return (
                      <button
                        key={task.id}
                        onClick={() => handleLocationSelect(task.task_type, task.location)}
                        className="w-full flex items-center justify-between p-4 bg-card hover:bg-muted/50 rounded-lg transition-colors border-2 border-border"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-3 h-3 rounded-full ${
                              status === "completed"
                                ? "bg-primary"
                                : status === "in_progress"
                                  ? "bg-accent"
                                  : status === "paused"
                                    ? "bg-muted"
                                    : "bg-muted-foreground/30"
                            }`}
                          />
                          <span className="font-medium text-foreground">{task.location}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {status === "completed" && (
                            <Badge variant="default" className="bg-primary">
                              Completed
                            </Badge>
                          )}
                          {status === "in_progress" && (
                            <Badge variant="default" className="bg-accent text-accent-foreground">
                              In Progress
                            </Badge>
                          )}
                          {status === "paused" && (
                            <Badge variant="secondary" className="bg-muted text-muted-foreground border border-border">
                              Paused
                            </Badge>
                          )}
                          {status === "pending" && (
                            <Badge variant="outline" className="text-muted-foreground">
                              Not Started
                            </Badge>
                          )}
                          <ChevronRight className="w-5 h-5 text-muted-foreground" />
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Navigation Buttons - Only for rooms, not lifts */}
      {!isLiftTask && (previousRoom || nextRoom) && (
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t-2 border-border p-4">
        <div className="container mx-auto flex gap-3">
          {previousRoom && (
            <Button
              onClick={() => router.push(`/worker/maintenance/${previousRoom.number}`)}
              variant="outline"
              className="flex-1 h-14 text-base"
              size="lg"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Previous Room
            </Button>
          )}
          {nextRoom && (
            <Button
              onClick={() => router.push(`/worker/maintenance/${nextRoom.number}`)}
              variant="outline"
              className="flex-1 h-14 text-base"
              size="lg"
            >
              Next Room
              <ChevronRight className="w-5 h-5 ml-2" />
            </Button>
          )}
        </div>
      </div>
      )}
    </div>
  )
}
