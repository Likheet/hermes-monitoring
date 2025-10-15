"use client"

import { use, useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ProtectedRoute } from "@/components/protected-route"
import { useAuth } from "@/lib/auth-context"
import { useTasks } from "@/lib/task-context"
import { PhotoCaptureModal } from "@/components/photo-capture-modal"
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

interface TaskDetailProps {
  params: { taskId: string } | Promise<{ taskId: string }>
}

function TaskDetail({ params }: TaskDetailProps) {
  const resolvedParams = params instanceof Promise ? use(params) : params
  const { taskId } = resolvedParams
  const router = useRouter()
  const { user } = useAuth()
  const { getTaskById, startTask, pauseTask, resumeTask, completeTask, raiseIssue } = useTasks()
  const { toast } = useToast()

  const task = getTaskById(taskId)
  const [remark, setRemark] = useState("")
  const [photoModalOpen, setPhotoModalOpen] = useState(false)
  const [issueModalOpen, setIssueModalOpen] = useState(false)
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null)
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

    startTask(taskId, user!.id)
    toast({
      title: "Task Started",
      description: "Timer is now running",
    })
  }

  const handlePause = () => {
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

    pauseTask(taskId, user!.id, "Worker paused task")
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

    resumeTask(taskId, user!.id)
    toast({
      title: "Task Resumed",
      description: "Timer is running again",
    })
  }

  const handleComplete = () => {
    if (task.photo_required && !capturedPhoto) {
      setPhotoModalOpen(true)
      return
    }

    if (!isOnline()) {
      addToOfflineQueue({
        type: "COMPLETE",
        taskId,
        userId: user!.id,
        timestamp: new Date().toISOString(),
        data: { photoUrl: capturedPhoto, remark },
      })
      toast({
        title: "Queued Offline",
        description: "Task will be submitted when connection is restored",
      })
      router.push("/worker")
      return
    }

    completeTask(taskId, user!.id, capturedPhoto, remark)
    toast({
      title: "Task Completed",
      description: "Task has been submitted for verification",
    })
    router.push("/worker")
  }

  const handlePhotoCapture = (photoUrl: string) => {
    setCapturedPhoto(photoUrl)
    toast({
      title: "Photo Captured",
      description: "Photo has been attached to the task",
    })
  }

  const handleRaiseIssue = (issueDescription: string) => {
    raiseIssue(taskId, user!.id, issueDescription)
    toast({
      title: "Issue Reported",
      description: "Your issue has been sent to supervisor and front office",
    })
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const priorityColors = {
    GUEST_REQUEST: "bg-red-500 text-white",
    TIME_SENSITIVE: "bg-orange-500 text-white",
    DAILY_TASK: "bg-blue-500 text-white",
    PREVENTIVE_MAINTENANCE: "bg-green-500 text-white",
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <OfflineIndicator />

      <header className="border-b bg-background">
        <div className="container mx-auto flex items-center gap-4 px-4 py-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/worker")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Task Details</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="text-2xl">{task.task_type}</CardTitle>
              <Badge className={priorityColors[task.priority_level]} variant="secondary">
                {task.priority_level.replace(/_/g, " ")}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Assigned at: {formatExactTimestamp(task.assigned_at.client)}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>Room {task.room_number}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Expected: {task.expected_duration_minutes} minutes</span>
            </div>
            {task.photo_required && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Camera className="h-4 w-4" />
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
          <Card className="border-orange-500">
            <CardContent className="pt-6">
              <p className="text-center text-orange-600 font-medium">Task is currently paused</p>
            </CardContent>
          </Card>
        )}

        {capturedPhoto && (
          <Card>
            <CardHeader>
              <CardTitle>Captured Photo</CardTitle>
            </CardHeader>
            <CardContent>
              <img src={capturedPhoto || "/placeholder.svg"} alt="Task completion" className="w-full rounded-lg" />
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

        <div className="flex flex-col gap-2">
          {task.status === "PENDING" && (
            <Button onClick={handleStart} size="lg" className="w-full">
              <Play className="mr-2 h-5 w-5" />
              Start Task
            </Button>
          )}

          {task.status === "IN_PROGRESS" && (
            <>
              <Button onClick={handlePause} variant="outline" size="lg" className="w-full bg-transparent">
                <Pause className="mr-2 h-5 w-5" />
                Pause Task
              </Button>
              <Button onClick={handleComplete} size="lg" className="w-full">
                <CheckCircle className="mr-2 h-5 w-5" />
                Complete Task
              </Button>
              <Button onClick={() => setIssueModalOpen(true)} variant="destructive" size="lg" className="w-full">
                <AlertTriangle className="mr-2 h-5 w-5" />
                Raise Issue!
              </Button>
            </>
          )}

          {task.status === "PAUSED" && (
            <>
              <Button onClick={handleResume} size="lg" className="w-full">
                <Play className="mr-2 h-5 w-5" />
                Resume Task
              </Button>
              <Button onClick={handleComplete} variant="outline" size="lg" className="w-full bg-transparent">
                <CheckCircle className="mr-2 h-5 w-5" />
                Complete Task
              </Button>
              <Button onClick={() => setIssueModalOpen(true)} variant="destructive" size="lg" className="w-full">
                <AlertTriangle className="mr-2 h-5 w-5" />
                Raise Issue!
              </Button>
            </>
          )}

          {task.status === "COMPLETED" && (
            <div className="text-center py-8">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <p className="text-lg font-medium">Task Completed</p>
              <p className="text-sm text-muted-foreground">Completed in {task.actual_duration_minutes} minutes</p>
            </div>
          )}
        </div>
      </main>

      <PhotoCaptureModal
        open={photoModalOpen}
        onOpenChange={setPhotoModalOpen}
        onPhotoCapture={handlePhotoCapture}
        taskId={taskId}
      />

      <RaiseIssueModal open={issueModalOpen} onOpenChange={setIssueModalOpen} onSubmit={handleRaiseIssue} />
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
