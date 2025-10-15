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
import { ArrowLeft, Play, Pause, CheckCircle, Clock, MapPin, Camera, AlertTriangle, Home, Wrench } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { OfflineIndicator } from "@/components/timer/offline-indicator"
import type { CategorizedPhotos } from "@/lib/types"

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
  const { maintenanceTasks, updateMaintenanceTask } = useTasks()
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
  }, [task, maintenanceTasks, roomNumber]) // Updated to use task directly

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

  const handleStart = () => {
    const inProgressTasks = maintenanceTasks.filter(
      (t) => t.assigned_to === user?.id && t.status === "in_progress" && t.id !== task.id,
    )

    if (inProgressTasks.length > 0) {
      const inProgressTask = inProgressTasks[0]
      toast({
        title: "Another Task In Progress",
        description: `You already have a task in progress (Room ${inProgressTask.room_number}). Please pause it before starting a new task.`,
        variant: "destructive",
      })
      return
    }

    // Check if we already have a paused task and trying to start another
    const pausedTasks = maintenanceTasks.filter(
      (t) => t.assigned_to === user?.id && t.status === "paused" && t.id !== task.id,
    )

    if (pausedTasks.length > 0) {
      // Allow starting if we have only 1 paused task (max 2 tasks: 1 paused + 1 in progress)
      if (pausedTasks.length >= 1) {
        toast({
          title: "Task Limit Reached",
          description: `You can only have 1 task in progress and 1 paused task at a time. Please complete or resume your paused task first.`,
          variant: "destructive",
        })
        return
      }
    }

    const now = new Date().toISOString()
    updateMaintenanceTask(task.id, {
      status: "in_progress",
      started_at: now,
      assigned_to: user.id,
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
    console.log("[v0] Task paused:", task.id, "duration:", elapsedTime)
    toast({
      title: "Task Paused",
      description: "Timer has been paused",
    })
  }

  const handleResume = () => {
    const now = new Date().toISOString()
    // Calculate new start time based on paused duration
    const newStartTime = new Date(Date.now() - elapsedTime * 1000).toISOString()
    updateMaintenanceTask(task.id, {
      status: "in_progress",
      started_at: newStartTime,
      paused_at: undefined,
    })
    setIsRunning(true)
    console.log("[v0] Task resumed:", task.id)
    toast({
      title: "Task Resumed",
      description: "Timer is running again",
    })
  }

  const handleComplete = () => {
    if (categorizedPhotos.room_photos.length === 0 || categorizedPhotos.proof_photos.length === 0) {
      toast({
        title: "Photos Required",
        description: "Please upload at least 1 room photo and 1 proof photo",
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

  const totalPhotos = categorizedPhotos.room_photos.length + categorizedPhotos.proof_photos.length

  return (
    <div className="min-h-screen bg-muted/30">
      <OfflineIndicator />

      <header className="border-b bg-background">
        <div className="container mx-auto flex items-center gap-4 px-4 py-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">{TASK_TYPE_LABELS[taskType as keyof typeof TASK_TYPE_LABELS]}</h1>
            <p className="text-sm text-muted-foreground">
              Room {roomNumber} • {location}
            </p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="text-2xl">{TASK_TYPE_LABELS[taskType as keyof typeof TASK_TYPE_LABELS]}</CardTitle>
              {isCompleted && (
                <Badge className="bg-primary text-primary-foreground" variant="secondary">
                  Completed
                </Badge>
              )}
              {task.status === "paused" && (
                <Badge variant="outline" className="border-muted-foreground">
                  Paused
                </Badge>
              )}
              {task.status === "in_progress" && <Badge variant="default">In Progress</Badge>}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>
                Room {roomNumber} - {location}
              </span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Expected: {task.expected_duration_minutes || 30} minutes</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Camera className="h-4 w-4" />
              <span>Photo required upon completion</span>
            </div>
          </CardContent>
        </Card>

        {isStarted && (
          <Card>
            <CardHeader>
              <CardTitle>Timer</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className="text-4xl font-bold font-mono">{formatTime(elapsedTime)}</div>
                <p className="text-sm text-muted-foreground mt-2">
                  Expected: {task.expected_duration_minutes || 30} min
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {!isRunning && isStarted && !isCompleted && (
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
                <Button variant="outline" size="sm" onClick={() => setPhotoModalOpen(true)} disabled={isCompleted}>
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

        {isStarted && !isCompleted && (
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
                onChange={(e) => {
                  setRemark(e.target.value)
                  updateMaintenanceTask(task.id, { notes: e.target.value })
                }}
                className="mt-2"
                rows={4}
              />
            </CardContent>
          </Card>
        )}

        <div className="flex flex-col gap-2">
          {!isStarted && !isCompleted && (
            <Button onClick={handleStart} size="lg" className="w-full">
              <Play className="mr-2 h-5 w-5" />
              Start Task
            </Button>
          )}

          {isStarted && isRunning && !isCompleted && (
            <>
              <Button onClick={handlePause} variant="outline" size="lg" className="w-full bg-transparent">
                <Pause className="mr-2 h-5 w-5" />
                Pause Task
              </Button>
              {totalPhotos === 0 && (
                <Button
                  onClick={() => setPhotoModalOpen(true)}
                  variant="outline"
                  size="lg"
                  className="w-full bg-transparent"
                >
                  <Camera className="mr-2 h-5 w-5" />
                  Capture Photos
                </Button>
              )}
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

          {isStarted && !isRunning && !isCompleted && (
            <>
              <Button onClick={handleResume} size="lg" className="w-full">
                <Play className="mr-2 h-5 w-5" />
                Resume Task
              </Button>
              {totalPhotos === 0 && (
                <Button
                  onClick={() => setPhotoModalOpen(true)}
                  variant="outline"
                  size="lg"
                  className="w-full bg-transparent"
                >
                  <Camera className="mr-2 h-5 w-5" />
                  Capture Photos
                </Button>
              )}
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

          {isCompleted && (
            <div className="text-center py-8">
              <CheckCircle className="h-16 w-16 text-primary mx-auto mb-4" />
              <p className="text-lg font-medium">Task Completed</p>
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
      />

      <RaiseIssueModal open={issueModalOpen} onOpenChange={setIssueModalOpen} onSubmit={handleRaiseIssue} />
    </div>
  )
}

export default MaintenanceTaskPage

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, "0")}`
}
