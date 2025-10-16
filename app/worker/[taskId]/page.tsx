"use client"

import { use, useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ProtectedRoute } from "@/components/protected-route"
import { useAuth } from "@/lib/auth-context"
import { useTasks } from "@/lib/task-context"
import { CategorizedPhotoCaptureModal } from "@/components/categorized-photo-capture-modal"
import { RaiseIssueModal } from "@/components/raise-issue-modal"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Play, Pause, CheckCircle, Clock, MapPin, Camera, AlertTriangle, Home, Wrench } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { OfflineIndicator } from "@/components/timer/offline-indicator"
import { PauseTimeline } from "@/components/timer/pause-timeline"
import { saveTimerState, getTimerState, clearTimerState, addToOfflineQueue, isOnline } from "@/lib/timer-utils"
import { formatExactTimestamp } from "@/lib/date-utils"
import type { CategorizedPhotos } from "@/lib/types"
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
  const [photoModalOpen, setPhotoModalOpen] = useState(false)
  const [issueModalOpen, setIssueModalOpen] = useState(false)
  const [swapDialogOpen, setSwapDialogOpen] = useState(false)
  const [pausedTaskToSwap, setPausedTaskToSwap] = useState<{ id: string; name: string } | null>(null)
  const [categorizedPhotos, setCategorizedPhotos] = useState<CategorizedPhotos>({
    room_photos: [],
    proof_photos: [],
  })
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

  const handleStart = () => {
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

    const result = startTask(taskId, user!.id)
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

  const handlePause = () => {
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

    const result = pauseTask(taskId, user!.id, "Worker paused task")
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

  const handleResume = () => {
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

    const result = resumeTask(taskId, user!.id)
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

  const handleComplete = () => {
    if (
      task.photo_required &&
      (categorizedPhotos.room_photos.length === 0 || categorizedPhotos.proof_photos.length === 0)
    ) {
      setPhotoModalOpen(true)
      return
    }

    if (!isOnline()) {
      addToOfflineQueue({
        type: "COMPLETE",
        taskId,
        userId: user!.id,
        timestamp: new Date().toISOString(),
        data: { categorizedPhotos, remark },
      })
      toast({
        title: "Queued Offline",
        description: "Task will be submitted when connection is restored",
      })
      router.push("/worker")
      return
    }

    completeTask(taskId, user!.id, categorizedPhotos, remark)
    stopPauseMonitoring()
    toast({
      title: "Task Completed",
      description: "Task has been submitted for verification",
    })
    router.push("/worker")
  }

  const handlePhotosCapture = (photos: CategorizedPhotos) => {
    setCategorizedPhotos(photos)
    const totalPhotos = photos.room_photos.length + photos.proof_photos.length
    toast({
      title: "Photos Captured",
      description: `${totalPhotos} photo(s) attached (${photos.room_photos.length} room, ${photos.proof_photos.length} proof)`,
    })
  }

  const handleRaiseIssue = (issue: string) => {
    raiseIssue(taskId, user!.id, issue)
    toast({
      title: "Issue Raised",
      description: "Your issue has been recorded",
    })
  }

  const handleSwapConfirm = () => {
    if (!pausedTaskToSwap || !user) return

    const result = swapTasks(taskId, pausedTaskToSwap.id, user.id)
    if (result && "error" in result) {
      toast({
        title: "Cannot Swap Tasks",
        description: result.error,
        variant: "destructive",
      })
    } else {
      stopPauseMonitoring()
      startPauseMonitoring(taskId, user.id)
      toast({
        title: "Tasks Swapped",
        description: `Paused this task and resumed "${pausedTaskToSwap.name}"`,
      })
      router.push(`/worker/${pausedTaskToSwap.id}`)
    }
    setSwapDialogOpen(false)
    setPausedTaskToSwap(null)
  }

  const totalPhotos = categorizedPhotos.room_photos.length + categorizedPhotos.proof_photos.length

  const canPauseTask = () => {
    if (!user) return false

    if (user.department !== "housekeeping") return false

    const myTasks = tasks.filter((t) => t.assigned_to_user_id === user.id && t.status !== "COMPLETED")
    const myMaintenanceTasks = maintenanceTasks.filter((t) => t.assigned_to === user.id && t.status !== "completed")
    const totalTasks = myTasks.length + myMaintenanceTasks.length

    return totalTasks >= 2
  }

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
            {task.photo_required && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Camera className="h-4 w-4 shrink-0" />
                <span>Photo required upon completion</span>
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

        {totalPhotos > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Photo Documentation ({totalPhotos})</CardTitle>
                <Button variant="outline" size="sm" onClick={() => setPhotoModalOpen(true)}>
                  <Camera className="mr-2 h-4 w-4" />
                  Manage
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {categorizedPhotos.room_photos.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Home className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Room Photos ({categorizedPhotos.room_photos.length})</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {categorizedPhotos.room_photos.map((photo, index) => (
                      <div key={index} className="relative">
                        <img
                          src={photo || "/placeholder.svg"}
                          alt={`Room photo ${index + 1}`}
                          className="w-full aspect-square object-cover rounded-lg border-2 border-primary"
                        />
                        <div className="absolute bottom-1 left-1 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded">
                          R{index + 1}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {categorizedPhotos.proof_photos.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-secondary-foreground" />
                    <span className="text-sm font-medium">Proof Photos ({categorizedPhotos.proof_photos.length})</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {categorizedPhotos.proof_photos.map((photo, index) => (
                      <div key={index} className="relative">
                        <img
                          src={photo || "/placeholder.svg"}
                          alt={`Proof photo ${index + 1}`}
                          className="w-full aspect-square object-cover rounded-lg border-2 border-secondary"
                        />
                        <div className="absolute bottom-1 left-1 bg-secondary text-secondary-foreground text-xs px-2 py-0.5 rounded">
                          P{index + 1}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
              {totalPhotos === 0 && task.photo_required && (
                <Button
                  onClick={() => setPhotoModalOpen(true)}
                  variant="outline"
                  size="lg"
                  className="w-full min-h-[48px] sm:min-h-[52px]"
                >
                  <Camera className="mr-2 h-5 w-5" />
                  Capture Photos
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
              {totalPhotos === 0 && task.photo_required && (
                <Button
                  onClick={() => setPhotoModalOpen(true)}
                  variant="outline"
                  size="lg"
                  className="w-full min-h-[48px] sm:min-h-[52px]"
                >
                  <Camera className="mr-2 h-4 w-4" />
                  Capture Photos
                </Button>
              )}
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

      <CategorizedPhotoCaptureModal
        open={photoModalOpen}
        onOpenChange={setPhotoModalOpen}
        onPhotosCapture={handlePhotosCapture}
        taskId={taskId}
        existingPhotos={categorizedPhotos}
        minRoomPhotos={task.custom_task_photo_count ? Math.ceil(task.custom_task_photo_count / 2) : 1}
        minProofPhotos={task.custom_task_photo_count ? Math.floor(task.custom_task_photo_count / 2) : 1}
      />

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
            <AlertDialogAction onClick={handleSwapConfirm}>Yes, Swap Tasks</AlertDialogAction>
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
