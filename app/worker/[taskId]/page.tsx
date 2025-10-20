"use client"

import { use, useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ProtectedRoute } from "@/components/protected-route"
import { useAuth } from "@/lib/auth-context"
import { useTasks } from "@/lib/task-context"
import { SimplePhotoCapture } from "@/components/simple-photo-capture"
import { RaiseIssueModal } from "@/components/raise-issue-modal"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Play, Pause, CheckCircle, Clock, MapPin, Camera, AlertTriangle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { OfflineIndicator } from "@/components/timer/offline-indicator"
import { PauseTimeline } from "@/components/timer/pause-timeline"
import { saveTimerState, getTimerState, clearTimerState, addToOfflineQueue, isOnline } from "@/lib/timer-utils"
import { formatExactTimestamp } from "@/lib/date-utils"
import { startPauseMonitoring, stopPauseMonitoring } from "@/lib/pause-monitoring"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { CategorizedPhotoCaptureModal } from "@/components/categorized-photo-capture-modal"

interface TaskDetailProps {
  params: { taskId: string } | Promise<{ taskId: string }>
}

function TaskDetail({ params }: TaskDetailProps) {
  const resolvedParams = params instanceof Promise ? use(params) : params
  const { taskId } = resolvedParams
  const router = useRouter()
  const { user } = useAuth()
  const {
    getTaskById,
    startTask,
    pauseTask,
    resumeTask,
    completeTask,
    raiseIssue,
    tasks,
    maintenanceTasks,
    swapTasks,
  } = useTasks()
  const { toast } = useToast()

  const task = getTaskById(taskId)
  const [remark, setRemark] = useState("")
  const [issueModalOpen, setIssueModalOpen] = useState(false)
  const [swapDialogOpen, setSwapDialogOpen] = useState(false)
  const [pausedTaskToSwap, setPausedTaskToSwap] = useState<{ id: string; name: string } | null>(null)
  const [photos, setPhotos] = useState<string[]>([])
  const [showCategorizedPhotoModal, setShowCategorizedPhotoModal] = useState(false)
  const [categorizedPhotos, setCategorizedPhotos] = useState<any>(null)
  const [elapsedTime, setElapsedTime] = useState(0)

  useEffect(() => {
    if (task?.status === "IN_PROGRESS" && task.started_at) {
      const interval = setInterval(() => {
        const startTime = new Date(task.started_at!.client).getTime()
        const now = Date.now()

        let pausedDuration = 0
        task.pause_history.forEach((pause) => {
          if (pause.resumed_at) {
            const pauseStart = new Date(pause.paused_at.client).getTime()
            const pauseEnd = new Date(pause.resumed_at.client).getTime()
            pausedDuration += pauseEnd - pauseStart
          } else {
            const pauseStart = new Date(pause.paused_at.client).getTime()
            pausedDuration += now - pauseStart
          }
        })

        const elapsed = Math.floor((now - startTime - pausedDuration) / 1000)
        setElapsedTime(elapsed)
      }, 1000)

      return () => clearInterval(interval)
    }
  }, [task])

  useEffect(() => {
    const savedState = getTimerState()
    if (savedState && savedState.taskId === taskId) {
      toast({
        title: "Timer Restored",
        description: "Your active task timer has been restored",
      })
    }
  }, [taskId, toast])

  useEffect(() => {
    if (task?.status === "IN_PROGRESS" && task.started_at) {
      saveTimerState({
        taskId: task.id,
        userId: user?.id || "",
        startedAt: task.started_at.client,
        pauseHistory: task.pause_history.map((p) => ({
          pausedAt: p.paused_at.client,
          resumedAt: p.resumed_at?.client || null,
          reason: p.reason,
        })),
      })
    } else {
      clearTimerState()
    }
  }, [task, user])

  useEffect(() => {
    if (task?.photo_urls && task.photo_urls.length > 0) {
      setPhotos(task.photo_urls)
    }
    if (task?.categorized_photos) {
      setCategorizedPhotos(task.categorized_photos)
    }
  }, [task?.id])

  console.log("[v0] TaskDetail page loaded with taskId:", taskId)
  console.log("[v0] Task found:", !!task)

  if (!task || !user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
        <p className="text-muted-foreground">Task not found</p>
        <Button onClick={() => router.push("/worker")} variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
      </div>
    )
  }

  console.log("[v0] Task status:", task.status)
  console.log("[v0] Should show Raise Issue button:", task.status === "IN_PROGRESS" || task.status === "PAUSED")

  const handleStart = async () => {
    if (!isOnline()) {
      addToOfflineQueue({
        type: "START",
        taskId,
        userId: user!.id,
        timestamp: new Date().toISOString(),
      })
      toast({
        title: "Queued Offline",
        description: "Action will sync when connection is restored",
        variant: "default",
      })
      return
    }

    const result = await startTask(taskId, user!.id)
    if (result && "error" in result) {
      toast({
        title: "Cannot Start Task",
        description: result.error,
        variant: "destructive",
      })
      return
    }

    toast({
      title: "Task Started",
      description: "Timer is now running",
    })
  }

  const handlePause = async () => {
    if (!canPauseTask()) {
      toast({
        title: "Cannot Pause",
        description: "You need at least 2 tasks to pause one. Complete this task or wait for another assignment.",
        variant: "destructive",
      })
      return
    }

    if (!isOnline()) {
      addToOfflineQueue({
        type: "PAUSE",
        taskId,
        userId: user!.id,
        timestamp: new Date().toISOString(),
        data: { reason: "Worker paused task" },
      })
      toast({
        title: "Queued Offline",
        description: "Action will sync when connection is restored",
      })
      return
    }

    const result = await pauseTask(taskId, user!.id, "Worker paused task")
    if (result && "error" in result) {
      if (result.pausedTaskId && result.pausedTaskName) {
        setPausedTaskToSwap({ id: result.pausedTaskId, name: result.pausedTaskName })
        setSwapDialogOpen(true)
      } else {
        toast({
          title: "Cannot Pause Task",
          description: result.error,
          variant: "destructive",
        })
      }
      return
    }

    startPauseMonitoring(taskId, user!.id)
    toast({
      title: "Task Paused",
      description: "Timer has been paused",
    })
  }

  const handleResume = async () => {
    if (!isOnline()) {
      addToOfflineQueue({
        type: "RESUME",
        taskId,
        userId: user!.id,
        timestamp: new Date().toISOString(),
      })
      toast({
        title: "Queued Offline",
        description: "Action will sync when connection is restored",
      })
      return
    }

    const result = await resumeTask(taskId, user!.id)
    if (result && "error" in result) {
      toast({
        title: "Cannot Resume Task",
        description: result.error,
        variant: "destructive",
      })
      return
    }

    stopPauseMonitoring()
    toast({
      title: "Task Resumed",
      description: "Timer is running again",
    })
  }

  const handleComplete = async () => {
    if (task.photo_documentation_required && task.photo_categories) {
      const allCategoriesFilled = task.photo_categories.every((cat: any) => {
        const categoryPhotos = categorizedPhotos?.[cat.name.toLowerCase().replace(/\s+/g, "_")] || []
        return categoryPhotos.length >= cat.count
      })

      if (!allCategoriesFilled) {
        toast({
          title: "Photos Required",
          description: "Please capture all required photos before completing",
          variant: "destructive",
        })
        return
      }
    } else if (task.photo_required) {
      const requiredPhotoCount = task.photo_count || task.custom_task_photo_count || 1
      if (photos.length < requiredPhotoCount) {
        toast({
          title: "Photos Required",
          description: `Please capture at least ${requiredPhotoCount} photo${requiredPhotoCount > 1 ? "s" : ""} before completing`,
          variant: "destructive",
        })
        return
      }
    }

    if (!isOnline()) {
      addToOfflineQueue({
        type: "COMPLETE",
        taskId,
        userId: user!.id,
        timestamp: new Date().toISOString(),
        data: {
          categorizedPhotos: task.photo_documentation_required
            ? categorizedPhotos
            : {
                room_photos: photos.slice(0, Math.ceil(photos.length / 2)),
                proof_photos: photos.slice(Math.ceil(photos.length / 2)),
              },
          remark,
        },
      })
      toast({
        title: "Queued Offline",
        description: "Task will be submitted when connection is restored",
      })
      router.push("/worker")
      return
    }

    const photosToSubmit = task.photo_documentation_required
      ? categorizedPhotos
      : {
          room_photos: photos.slice(0, Math.ceil(photos.length / 2)),
          proof_photos: photos.slice(Math.ceil(photos.length / 2)),
        }

    await completeTask(taskId, user!.id, photosToSubmit, remark)
    stopPauseMonitoring()
    toast({
      title: "Task Completed",
      description: "Task has been submitted for verification",
    })
    router.push("/worker")
  }

  const handlePhotosChange = (newPhotos: string[]) => {
    setPhotos(newPhotos)
    console.log("[v0] Photos updated:", newPhotos.length)
  }

  const handleRaiseIssue = (issueDescription: string, issuePhotos: string[]) => {
    raiseIssue(taskId, user!.id, issueDescription, issuePhotos)
    setIssueModalOpen(false)
    toast({
      title: "Issue Raised",
      description: "Your issue has been reported to management",
    })
  }

  const canPauseTask = () => {
    if (!user) return false

    if (user.department !== "housekeeping") return false

    const myTasks = tasks.filter((t) => t.assigned_to_user_id === user.id && t.status !== "COMPLETED")
    const myMaintenanceTasks = maintenanceTasks.filter((t) => t.assigned_to === user.id && t.status !== "completed")
    const totalTasks = myTasks.length + myMaintenanceTasks.length

    return totalTasks >= 2
  }

  const totalPhotos = photos.length

  const getPhotoRequirementText = () => {
    if (task.photo_documentation_required && task.photo_categories) {
      const totalPhotos = task.photo_categories.reduce((sum: number, cat: any) => sum + cat.count, 0)
      const types = task.photo_categories.length
      return `${totalPhotos} photo${totalPhotos > 1 ? "s" : ""} (${types} type${types > 1 ? "s" : ""}) required`
    }
    if (task.photo_required) {
      const count = task.photo_count || task.custom_task_photo_count || 1
      return `${count} photo${count > 1 ? "s" : ""} required`
    }
    return null
  }

  const photoRequirementText = getPhotoRequirementText()

  return (
    <div className="min-h-screen bg-muted/30">
      <OfflineIndicator />

      <header className="border-b bg-background sticky top-0 z-40">
        <div className="container mx-auto flex items-center gap-2 sm:gap-4 px-3 sm:px-4 py-3 sm:py-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/worker")}
            className="shrink-0 min-h-[44px] min-w-[44px]"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-xl font-bold truncate">Task Details</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-2xl space-y-4 sm:space-y-6">
        <Card>
          <CardHeader className="pb-3 sm:pb-6">
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="text-xl sm:text-2xl leading-tight">{task.task_type}</CardTitle>
              <Badge className={priorityColors[task.priority_level]} variant="secondary">
                {task.priority_level.replace(/_/g, " ")}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4 shrink-0" />
              <span className="truncate">Assigned at: {formatExactTimestamp(task.assigned_at.client)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0" />
              <span>Room {task.room_number}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4 shrink-0" />
              <span>Expected: {task.expected_duration_minutes} minutes</span>
            </div>
            {task.worker_remark && (
              <div className="mt-4 p-4 border-2 border-blue-500 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
                      Instructions from Front Office
                    </p>
                    <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed break-words whitespace-normal">
                      {task.worker_remark}
                    </p>
                  </div>
                </div>
              </div>
            )}
            {photoRequirementText && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Camera className="h-4 w-4 shrink-0" />
                <span>{photoRequirementText}</span>
              </div>
            )}
            {task.task_type === "Housekeeping" && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Housekeeping Task</span>
              </div>
            )}
            {task.task_type === "Maintenance" && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Maintenance Task</span>
              </div>
            )}
          </CardContent>
        </Card>

        {task.status === "IN_PROGRESS" && (
          <Card>
            <CardHeader>
              <CardTitle>Timer</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className="text-4xl font-bold font-mono">{formatTime(elapsedTime)}</div>
                <p className="text-sm text-muted-foreground mt-2">Expected: {task.expected_duration_minutes} min</p>
              </div>
            </CardContent>
          </Card>
        )}

        {task.status === "PAUSED" && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <p className="text-center text-destructive font-medium">Task is currently paused</p>
            </CardContent>
          </Card>
        )}

        {(task.status === "IN_PROGRESS" || task.status === "PAUSED") &&
          task.photo_documentation_required &&
          task.photo_categories && (
            <Card>
              <CardHeader>
                <CardTitle>Photo Documentation</CardTitle>
              </CardHeader>
              <CardContent>
                <Button onClick={() => setShowCategorizedPhotoModal(true)} variant="outline" className="w-full">
                  <Camera className="mr-2 h-4 w-4" />
                  Capture Photos ({task.photo_categories.reduce((sum: number, cat: any) => sum + cat.count, 0)}{" "}
                  required)
                </Button>
              </CardContent>
            </Card>
          )}

        {(task.status === "IN_PROGRESS" || task.status === "PAUSED") &&
          task.photo_required &&
          !task.photo_documentation_required && (
            <SimplePhotoCapture
              taskId={taskId}
              existingPhotos={photos}
              onPhotosChange={handlePhotosChange}
              minPhotos={task.photo_count || task.custom_task_photo_count || 1}
            />
          )}

        {task.status === "COMPLETED" && totalPhotos > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Photos Submitted ({totalPhotos})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2">
                {photos.map((photo, index) => (
                  <img
                    key={index}
                    src={photo || "/placeholder.svg"}
                    alt={`Photo ${index + 1}`}
                    className="w-full aspect-square object-cover rounded-lg border"
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {(task.status === "IN_PROGRESS" || task.status === "PAUSED") && (
          <Card>
            <CardHeader>
              <CardTitle>Remarks</CardTitle>
            </CardHeader>
            <CardContent>
              <Label htmlFor="remark">Add any notes about this task</Label>
              <Textarea
                id="remark"
                placeholder="Enter your remarks here..."
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                className="mt-2"
                rows={4}
              />
            </CardContent>
          </Card>
        )}

        {task.pause_history.length > 0 && <PauseTimeline pauseHistory={task.pause_history} />}

        <div className="flex flex-col gap-2 sm:gap-3">
          {task.status === "PENDING" && (
            <Button onClick={handleStart} size="lg" className="w-full min-h-[48px] sm:min-h-[52px]">
              <Play className="mr-2 h-5 w-5" />
              Start Task
            </Button>
          )}

          {task.status === "IN_PROGRESS" && (
            <>
              {user?.department === "housekeeping" && (
                <Button
                  onClick={handlePause}
                  variant="outline"
                  size="lg"
                  className="w-full min-h-[48px] sm:min-h-[52px] bg-transparent"
                  disabled={!canPauseTask()}
                >
                  <Pause className="mr-2 h-5 w-5" />
                  <span className="truncate">Pause Task{!canPauseTask() && " (Need 2+ tasks)"}</span>
                </Button>
              )}
              <Button onClick={handleComplete} size="lg" className="w-full min-h-[48px] sm:min-h-[52px]">
                <CheckCircle className="mr-2 h-5 w-5" />
                Complete Task
              </Button>
              <Button
                onClick={() => setIssueModalOpen(true)}
                variant="destructive"
                size="lg"
                className="w-full min-h-[48px] sm:min-h-[52px]"
              >
                <AlertTriangle className="mr-2 h-5 w-5" />
                Raise Issue!
              </Button>
            </>
          )}

          {task.status === "PAUSED" && (
            <>
              <Button onClick={handleResume} size="lg" className="w-full min-h-[48px] sm:min-h-[52px]">
                <Play className="mr-2 h-5 w-5" />
                Resume Task
              </Button>
              <Button
                onClick={handleComplete}
                variant="outline"
                size="lg"
                className="w-full min-h-[48px] sm:min-h-[52px] bg-transparent"
              >
                <CheckCircle className="mr-2 h-5 w-5" />
                Complete Task
              </Button>
              <Button
                onClick={() => setIssueModalOpen(true)}
                variant="destructive"
                size="lg"
                className="w-full min-h-[48px] sm:min-h-[52px]"
              >
                <AlertTriangle className="mr-2 h-5 w-5" />
                Raise Issue!
              </Button>
            </>
          )}

          {task.status === "COMPLETED" && (
            <div className="text-center py-8">
              <CheckCircle className="h-16 w-16 text-primary mx-auto mb-4" />
              <p className="text-lg font-medium">Task Completed</p>
              <p className="text-sm text-muted-foreground">Completed in {task.actual_duration_minutes} minutes</p>
            </div>
          )}
        </div>
      </main>

      {task.photo_documentation_required && task.photo_categories && (
        <CategorizedPhotoCaptureModal
          open={showCategorizedPhotoModal}
          onOpenChange={setShowCategorizedPhotoModal}
          taskId={taskId}
          photoCategories={task.photo_categories}
          existingPhotos={categorizedPhotos}
          onSave={(photos) => {
            setCategorizedPhotos(photos)
            setShowCategorizedPhotoModal(false)
            toast({
              title: "Photos Saved",
              description: "Your photos have been saved",
            })
          }}
        />
      )}

      <RaiseIssueModal open={issueModalOpen} onOpenChange={setIssueModalOpen} onSubmit={handleRaiseIssue} />

      <AlertDialog open={swapDialogOpen} onOpenChange={setSwapDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Can't Pause Multiple Tasks</AlertDialogTitle>
            <AlertDialogDescription>
              You already have a paused task: <strong>{pausedTaskToSwap?.name}</strong>
              <br />
              <br />
              Would you like to pause this task and resume the other one instead?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setSwapDialogOpen(false)
                setPausedTaskToSwap(null)
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => swapTasks(taskId, pausedTaskToSwap!.id)}>
              Yes, Swap Tasks
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default function TaskDetailPage(props: TaskDetailProps) {
  return (
    <ProtectedRoute allowedRoles={["worker"]}>
      <TaskDetail {...props} />
    </ProtectedRoute>
  )
}

const priorityColors = {
  GUEST_REQUEST: "bg-destructive text-destructive-foreground",
  TIME_SENSITIVE: "bg-accent text-accent-foreground",
  DAILY_TASK: "bg-muted text-muted-foreground",
  PREVENTIVE_MAINTENANCE: "bg-secondary text-secondary-foreground",
}

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, "0")}`
}
