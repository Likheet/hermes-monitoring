"use client"

import { use, useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useTasks } from "@/lib/task-context"
import { useAuth } from "@/lib/auth-context"
import { TASK_TYPE_LABELS } from "@/lib/maintenance-types"
import { CategorizedPhotoCaptureModal } from "@/components/categorized-photo-capture-modal"
import { RaiseIssueModal } from "@/components/raise-issue-modal"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { ArrowLeft, Play, CheckCircle, Clock, MapPin, Camera, AlertTriangle, Home, Wrench } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { OfflineIndicator } from "@/components/timer/offline-indicator"
import type { CategorizedPhotos } from "@/lib/types"
import { startPauseMonitoring, stopPauseMonitoring } from "@/lib/pause-monitoring"

interface MaintenanceTaskPageProps {
  params:
    | { roomNumber: string; taskType: string; location: string }
    | Promise<{ roomNumber: string; taskType: string; location: string }>
}

function MaintenanceTaskPage({ params }: MaintenanceTaskPageProps) {
  const resolvedParams = params instanceof Promise ? use(params) : params
  const { roomNumber, taskType, location: encodedLocation } = resolvedParams
  const location = decodeURIComponent(encodedLocation)

  const router = useRouter()
  const { user } = useAuth()
  const { maintenanceTasks, updateMaintenanceTask, tasks } = useTasks()
  const { toast } = useToast()

  const task = maintenanceTasks.find(
    (t) => t.room_number === roomNumber && t.task_type === taskType && t.location === location,
  )

  console.log("[v0] Task detail page loaded:", {
    roomNumber,
    taskType,
    location,
    taskFound: !!task,
    taskId: task?.id,
    totalMaintenanceTasks: maintenanceTasks.length,
    matchingRoomTasks: maintenanceTasks.filter((t) => t.room_number === roomNumber).length,
  })

  const [remark, setRemark] = useState("")
  const [photoModalOpen, setPhotoModalOpen] = useState(false)
  const [issueModalOpen, setIssueModalOpen] = useState(false)
  const [ongoingTaskDialogOpen, setOngoingTaskDialogOpen] = useState(false)
  const [ongoingTask, setOngoingTask] = useState<typeof task | null>(null)
  const [swapDialogOpen, setSwapDialogOpen] = useState(false)
  const [taskToSwap, setTaskToSwap] = useState<typeof task | null>(null)
  const [categorizedPhotos, setCategorizedPhotos] = useState<CategorizedPhotos>({
    room_photos: [],
    proof_photos: [],
  })
  const [elapsedTime, setElapsedTime] = useState(0)
  const [isRunning, setIsRunning] = useState(false)

  useEffect(() => {
    if (!task) {
      console.log(
        "[v0] Task not found. Available tasks for this room:",
        maintenanceTasks
          .filter((t) => t.room_number === roomNumber)
          .map((t) => ({ type: t.task_type, location: t.location, id: t.id })),
      )
      return
    }

    console.log("[v0] Loading task state:", {
      status: task.status,
      started_at: task.started_at,
      timer_duration: task.timer_duration,
      paused_at: task.paused_at,
    })

    // Load existing photos
    if (task.categorized_photos) {
      setCategorizedPhotos({
        room_photos: task.categorized_photos.before_photos || [],
        proof_photos: task.categorized_photos.after_photos || [],
      })
    }

    // Load existing notes
    if (task.notes) {
      setRemark(task.notes)
    }

    // Restore timer state
    if (task.status === "in_progress" && task.started_at) {
      const startTime = new Date(task.started_at).getTime()
      const now = Date.now()
      const elapsed = Math.floor((now - startTime) / 1000)
      setElapsedTime(elapsed)
      setIsRunning(true)
      console.log("[v0] Restored in-progress task, elapsed:", elapsed)
    } else if (task.status === "paused" && task.timer_duration) {
      setElapsedTime(task.timer_duration)
      setIsRunning(false)
      console.log("[v0] Restored paused task, duration:", task.timer_duration)
    }
  }, [task, maintenanceTasks, roomNumber])

  useEffect(() => {
    if (!isRunning || !task?.started_at) return

    const interval = setInterval(() => {
      const startTime = new Date(task.started_at!).getTime()
      const now = Date.now()
      const elapsed = Math.floor((now - startTime) / 1000)
      setElapsedTime(elapsed)
    }, 1000)

    return () => clearInterval(interval)
  }, [isRunning, task?.started_at])

  if (!task || !user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
        <p className="text-lg font-semibold text-foreground">Task Not Found</p>
        <p className="text-muted-foreground text-center max-w-md">
          This maintenance task doesn't exist or hasn't been scheduled yet. Please check the maintenance calendar for
          available tasks.
        </p>
        <Button onClick={() => router.push("/worker")} variant="default" size="lg">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Button>
      </div>
    )
  }

  const isCompleted = task.status === "completed"
  const isStarted = task.status === "in_progress" || task.status === "paused"

  const pauseOtherActiveMaintenanceTasks = (currentTaskId: string) => {
    if (!user) return

    const now = new Date()
    const nowIso = now.toISOString()

    maintenanceTasks
      .filter((t) => t.assigned_to === user.id && t.id !== currentTaskId && t.status === "in_progress")
      .forEach((activeTask) => {
        const elapsedSeconds = activeTask.started_at
          ? Math.floor((now.getTime() - new Date(activeTask.started_at).getTime()) / 1000)
          : activeTask.timer_duration || 0

        updateMaintenanceTask(activeTask.id, {
          status: "paused",
          paused_at: nowIso,
          timer_duration: elapsedSeconds,
        })
        startPauseMonitoring(activeTask.id, user.id)
        console.log("[v0] Auto-paused other maintenance task to enforce single active:", activeTask.id)
      })
  }

  const handleStart = () => {
    const blockingRegularTask = tasks.find(
      (t) => t.assigned_to_user_id === user?.id && t.status === "IN_PROGRESS",
    )

    if (blockingRegularTask) {
      toast({
        title: "Cannot Start Task",
        description: "Pause or complete your other active task before starting scheduled maintenance.",
        variant: "destructive",
      })
      console.log("[v0] Blocked maintenance start - regular task active:", {
        blockingTaskId: blockingRegularTask.id,
        blockingTaskType: blockingRegularTask.task_type,
      })
      return
    }

    const activeMaintenanceTask = maintenanceTasks.find(
      (t) => t.assigned_to === user?.id && t.status === "in_progress" && t.id !== task.id,
    )

    if (activeMaintenanceTask) {
      setOngoingTask(activeMaintenanceTask)
      setTaskToSwap(activeMaintenanceTask)
      setSwapDialogOpen(true)
      console.log("[v0] Blocked task start - another maintenance task active:", {
        ongoingTaskId: activeMaintenanceTask.id,
        ongoingTaskRoom: activeMaintenanceTask.room_number,
      })
      return
    }

    const now = new Date()
    pauseOtherActiveMaintenanceTasks(task.id)
    updateMaintenanceTask(task.id, {
      status: "in_progress",
      started_at: now.toISOString(),
      assigned_to: user.id,
      paused_at: undefined,
    })
    setIsRunning(true)
    console.log("[v0] Task started:", task.id)
    toast({
      title: "Task Started",
      description: "Timer is now running",
    })
  }

  const handlePause = () => {
    const now = new Date().toISOString()
    updateMaintenanceTask(task.id, {
      status: "paused",
      paused_at: now,
      timer_duration: elapsedTime,
    })
    setIsRunning(false)
    startPauseMonitoring(task.id, user!.id)
    console.log("[v0] Task paused:", task.id, "duration:", elapsedTime)
    toast({
      title: "Task Paused",
      description: "Timer has been paused",
    })
  }

  const handleResume = () => {
    const blockingRegularTask = tasks.find(
      (t) => t.assigned_to_user_id === user?.id && t.status === "IN_PROGRESS",
    )

    if (blockingRegularTask) {
      toast({
        title: "Cannot Resume Task",
        description: "Pause or complete your other active task before resuming this one.",
        variant: "destructive",
      })
      console.log("[v0] Blocked maintenance resume - regular task active:", {
        blockingTaskId: blockingRegularTask.id,
        blockingTaskType: blockingRegularTask.task_type,
      })
      return
    }

    pauseOtherActiveMaintenanceTasks(task.id)

    const newStartTime = new Date(Date.now() - elapsedTime * 1000).toISOString()
    updateMaintenanceTask(task.id, {
      status: "in_progress",
      started_at: newStartTime,
      paused_at: undefined,
    })
    setIsRunning(true)
    stopPauseMonitoring()
    console.log("[v0] Task resumed:", task.id)
    toast({
      title: "Task Resumed",
      description: "Timer is running again",
    })
  }

  const handleComplete = () => {
    const minRoomPhotos = task.photo_count ? Math.ceil(task.photo_count / 2) : 1
    const minProofPhotos = task.photo_count ? Math.floor(task.photo_count / 2) : 1

    if (
      categorizedPhotos.room_photos.length < minRoomPhotos ||
      categorizedPhotos.proof_photos.length < minProofPhotos
    ) {
      toast({
        title: "Photos Required",
        description: `Please upload at least ${minRoomPhotos} room photo${minRoomPhotos > 1 ? "s" : ""} and ${minProofPhotos} proof photo${minProofPhotos > 1 ? "s" : ""}`,
        variant: "destructive",
      })
      setPhotoModalOpen(true)
      return
    }

    if (!task) return

    updateMaintenanceTask(task.id, {
      status: "completed",
      categorized_photos: {
        before_photos: categorizedPhotos.room_photos,
        after_photos: categorizedPhotos.proof_photos,
      },
      timer_duration: elapsedTime,
      completed_at: new Date().toISOString(),
      notes: remark,
    })

    console.log("[v0] Task completed:", task.id, "duration:", elapsedTime)
    toast({
      title: "Task Completed",
      description: "Task has been marked as complete",
    })
    router.back()
  }

  const handlePhotosCapture = (photos: CategorizedPhotos) => {
    setCategorizedPhotos(photos)
    updateMaintenanceTask(task.id, {
      categorized_photos: {
        before_photos: photos.room_photos,
        after_photos: photos.proof_photos,
      },
    })
    const totalPhotos = photos.room_photos.length + photos.proof_photos.length
    toast({
      title: "Photos Captured",
      description: `${totalPhotos} photo(s) attached (${photos.room_photos.length} room, ${photos.proof_photos.length} proof)`,
    })
  }

  const handleRaiseIssue = (issue: string) => {
    setRemark((prev) => prev + (prev ? "\n" : "") + `[ISSUE] ${issue}`)
    updateMaintenanceTask(task.id, {
      notes: remark + (remark ? "\n" : "") + `[ISSUE] ${issue}`,
    })
    toast({
      title: "Issue Raised",
      description: "Your issue has been recorded",
    })
  }

  const handleGoToOngoingTask = () => {
    if (!ongoingTask) return
    setOngoingTaskDialogOpen(false)
    router.push(
      `/worker/maintenance/${ongoingTask.room_number}/${ongoingTask.task_type}/${encodeURIComponent(ongoingTask.location)}`,
    )
  }

  const handleSwapConfirm = () => {
    if (!taskToSwap || !user) return

    const blockingRegularTask = tasks.find(
      (t) => t.assigned_to_user_id === user.id && t.status === "IN_PROGRESS",
    )

    if (blockingRegularTask) {
      toast({
        title: "Cannot Swap Tasks",
        description: "Pause or complete your other active task before starting this one.",
        variant: "destructive",
      })
      console.log("[v0] Blocked maintenance swap - regular task active:", {
        blockingTaskId: blockingRegularTask.id,
        blockingTaskType: blockingRegularTask.task_type,
      })
      return
    }

    pauseOtherActiveMaintenanceTasks(task.id)

    const now = new Date().toISOString()
    updateMaintenanceTask(task.id, {
      status: "in_progress",
      started_at: now,
      assigned_to: user.id,
      paused_at: undefined,
    })
    setIsRunning(true)

    toast({
      title: "Tasks Swapped",
      description: "Started this task and paused the other active task",
    })

    setSwapDialogOpen(false)
    setTaskToSwap(null)
    setOngoingTask(null)
  }

  const totalPhotos = categorizedPhotos.room_photos.length + categorizedPhotos.proof_photos.length

  return (
    <div className="min-h-screen bg-muted/30 pb-safe">
      <OfflineIndicator />

      <header className="border-b bg-background sticky top-0 z-40">
        <div className="container mx-auto flex items-center gap-2 sm:gap-4 px-3 sm:px-4 py-3 sm:py-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="min-h-[44px] min-w-[44px] shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base sm:text-xl font-bold truncate">
              {TASK_TYPE_LABELS[taskType as keyof typeof TASK_TYPE_LABELS]}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground truncate">
              Room {roomNumber} • {location}
            </p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-2xl space-y-4 sm:space-y-6">
        <Card>
          <CardHeader className="pb-3 sm:pb-4">
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="text-lg sm:text-2xl leading-tight">
                {TASK_TYPE_LABELS[taskType as keyof typeof TASK_TYPE_LABELS]}
              </CardTitle>
              <div className="flex flex-col gap-1 shrink-0">
                {isCompleted && (
                  <Badge className="bg-primary text-primary-foreground text-xs" variant="secondary">
                    Completed
                  </Badge>
                )}
                {task.status === "paused" && (
                  <Badge variant="outline" className="border-muted-foreground text-xs">
                    Paused
                  </Badge>
                )}
                {task.status === "in_progress" && (
                  <Badge variant="default" className="text-xs">
                    In Progress
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4">
            <div className="flex items-center gap-2 text-sm sm:text-base text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0" />
              <span className="truncate">
                Room {roomNumber} - {location}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm sm:text-base text-muted-foreground">
              <Clock className="h-4 w-4 shrink-0" />
              <span>Expected: {task.expected_duration_minutes || 30} minutes</span>
            </div>
            <div className="flex items-center gap-2 text-sm sm:text-base text-muted-foreground">
              <Camera className="h-4 w-4 shrink-0" />
              <span>Photo required upon completion</span>
            </div>
          </CardContent>
        </Card>

        {isStarted && (
          <Card>
            <CardHeader className="pb-3 sm:pb-4">
              <CardTitle className="text-base sm:text-lg">Timer</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className="text-3xl sm:text-4xl font-bold font-mono">{formatTime(elapsedTime)}</div>
                <p className="text-xs sm:text-sm text-muted-foreground mt-2">
                  Expected: {task.expected_duration_minutes || 30} min
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {!isRunning && isStarted && !isCompleted && (
          <Card className="border-destructive">
            <CardContent className="pt-4 sm:pt-6">
              <p className="text-center text-destructive font-medium text-sm sm:text-base">Task is currently paused</p>
            </CardContent>
          </Card>
        )}

        {totalPhotos > 0 && (
          <Card>
            <CardHeader className="pb-3 sm:pb-4">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base sm:text-lg">Photo Documentation ({totalPhotos})</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPhotoModalOpen(true)}
                  disabled={isCompleted}
                  className="text-xs sm:text-sm"
                >
                  <Camera className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                  Manage
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4">
              {categorizedPhotos.room_photos.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Home className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-xs sm:text-sm font-medium">
                      Room Photos ({categorizedPhotos.room_photos.length})
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
                    <Wrench className="h-4 w-4 text-secondary-foreground shrink-0" />
                    <span className="text-xs sm:text-sm font-medium">
                      Proof Photos ({categorizedPhotos.proof_photos.length})
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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

        {isStarted && !isCompleted && (
          <Card>
            <CardHeader className="pb-3 sm:pb-4">
              <CardTitle className="text-base sm:text-lg">Remarks</CardTitle>
            </CardHeader>
            <CardContent>
              <Label htmlFor="remark" className="text-sm">
                Add any notes about this task
              </Label>
              <Textarea
                id="remark"
                placeholder="Enter your remarks here..."
                value={remark}
                onChange={(e) => {
                  setRemark(e.target.value)
                  updateMaintenanceTask(task.id, { notes: e.target.value })
                }}
                className="mt-2 text-sm sm:text-base"
                rows={4}
              />
            </CardContent>
          </Card>
        )}

        <div className="flex flex-col gap-2 sm:gap-3">
          {!isStarted && !isCompleted && (
            <Button onClick={handleStart} size="lg" className="w-full min-h-[48px] text-base">
              <Play className="mr-2 h-5 w-5" />
              Start Task
            </Button>
          )}

          {isStarted && isRunning && !isCompleted && (
            <>
              {totalPhotos === 0 && (
                <Button
                  onClick={() => setPhotoModalOpen(true)}
                  variant="outline"
                  size="lg"
                  className="w-full min-h-[48px] text-base bg-transparent"
                >
                  <Camera className="mr-2 h-5 w-5" />
                  Capture Photos
                </Button>
              )}
              <Button onClick={handleComplete} size="lg" className="w-full min-h-[48px] text-base">
                <CheckCircle className="mr-2 h-5 w-5" />
                Complete Task
              </Button>
              <Button
                onClick={() => setIssueModalOpen(true)}
                variant="destructive"
                size="lg"
                className="w-full min-h-[48px] text-base"
              >
                <AlertTriangle className="mr-2 h-5 w-5" />
                Raise Issue!
              </Button>
            </>
          )}

          {isStarted && !isRunning && !isCompleted && (
            <>
              <Button onClick={handleResume} size="lg" className="w-full min-h-[48px] text-base">
                <Play className="mr-2 h-5 w-5" />
                Resume Task
              </Button>
              {totalPhotos === 0 && (
                <Button
                  onClick={() => setPhotoModalOpen(true)}
                  variant="outline"
                  size="lg"
                  className="w-full min-h-[48px] text-base bg-transparent"
                >
                  <Camera className="mr-2 h-5 w-5" />
                  Capture Photos
                </Button>
              )}
              <Button
                onClick={handleComplete}
                variant="outline"
                size="lg"
                className="w-full min-h-[48px] text-base bg-transparent"
              >
                <CheckCircle className="mr-2 h-5 w-5" />
                Complete Task
              </Button>
              <Button
                onClick={() => setIssueModalOpen(true)}
                variant="destructive"
                size="lg"
                className="w-full min-h-[48px] text-base"
              >
                <AlertTriangle className="mr-2 h-5 w-5" />
                Raise Issue!
              </Button>
            </>
          )}

          {isCompleted && (
            <div className="text-center py-6 sm:py-8">
              <CheckCircle className="h-12 w-12 sm:h-16 sm:w-16 text-primary mx-auto mb-3 sm:mb-4" />
              <p className="text-base sm:text-lg font-medium">Task Completed</p>
              <p className="text-sm text-muted-foreground">Completed in {Math.floor(elapsedTime / 60)} minutes</p>
            </div>
          )}
        </div>
      </main>

      <CategorizedPhotoCaptureModal
        open={photoModalOpen}
        onOpenChange={setPhotoModalOpen}
        onPhotosCapture={handlePhotosCapture}
        taskId={task.id}
        existingPhotos={categorizedPhotos}
        minRoomPhotos={task.photo_count ? Math.ceil(task.photo_count / 2) : 1}
        minProofPhotos={task.photo_count ? Math.floor(task.photo_count / 2) : 1}
      />

      <RaiseIssueModal open={issueModalOpen} onOpenChange={setIssueModalOpen} onSubmit={handleRaiseIssue} />

      <AlertDialog open={swapDialogOpen} onOpenChange={setSwapDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>You Have Another Task Active</AlertDialogTitle>
            <AlertDialogDescription>
              You currently have a task <strong>in progress</strong> in Room {taskToSwap?.room_number}:{" "}
              <strong>
                {taskToSwap?.task_type && TASK_TYPE_LABELS[taskToSwap.task_type as keyof typeof TASK_TYPE_LABELS]} -{" "}
                {taskToSwap?.location}
              </strong>
              <br />
              <br />
              Starting this task will automatically pause the other one so that only one task runs at a time. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setSwapDialogOpen(false)
                setTaskToSwap(null)
                setOngoingTask(null)
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleSwapConfirm}>Yes, Swap Tasks</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={ongoingTaskDialogOpen} onOpenChange={setOngoingTaskDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>You Still Have an Ongoing Task</DialogTitle>
            <DialogDescription>
              You currently have a task {ongoingTask?.status === "paused" ? "paused" : "in progress"} in Room{" "}
              {ongoingTask?.room_number}. Please complete that task before starting a new one.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Room {ongoingTask?.room_number}</span>
                    <Badge variant={ongoingTask?.status === "paused" ? "outline" : "default"}>
                      {ongoingTask?.status === "paused" ? "Paused" : "In Progress"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {ongoingTask?.task_type && TASK_TYPE_LABELS[ongoingTask.task_type as keyof typeof TASK_TYPE_LABELS]}{" "}
                    - {ongoingTask?.location}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setOngoingTaskDialogOpen(false)} className="w-full sm:w-auto">
              Close
            </Button>
            <Button onClick={handleGoToOngoingTask} className="w-full sm:w-auto">
              Take Me There
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default MaintenanceTaskPage

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, "0")}`
}
