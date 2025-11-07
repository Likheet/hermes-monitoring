"use client"

import { use, useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useTasks } from "@/lib/task-context"
import { useAuth } from "@/lib/auth-context"
import { TASK_TYPE_LABELS } from "@/lib/maintenance-types"
import { CategorizedPhotoCaptureModal } from "@/components/categorized-photo-capture-modal"
import { RaiseIssueModal } from "@/components/raise-issue-modal"
import { TaskImage } from "@/components/task-image"
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
import { ArrowLeft, Play, CheckCircle, Clock, MapPin, Camera, AlertTriangle, CheckCheck } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { OfflineIndicator } from "@/components/timer/offline-indicator"
import type { CategorizedPhotos, Task } from "@/lib/types"
import { startPauseMonitoring, stopPauseMonitoring } from "@/lib/pause-monitoring"
import {
  bucketToCategorizedPhotos,
  categorizedPhotosToBucket,
  hasCategorizedPhotoEntries,
  type PhotoBucket,
} from "@/lib/photo-utils"
import { formatDuration } from "@/lib/time-utils"
import { isOnline } from "@/lib/timer-utils"

interface MaintenanceTaskPageProps {
  params:
    | { roomNumber: string; taskType: string; location: string }
    | Promise<{ roomNumber: string; taskType: string; location: string }>
}

const MAINTENANCE_PHOTO_CATEGORIES = [
  { name: "Before Photos", count: 1, description: "Capture the area before maintenance" },
  { name: "After Photos", count: 1, description: "Capture the area after maintenance" },
]

const cloneCategoryArray = (value?: string[]): string[] => (Array.isArray(value) ? [...value] : [])

const normalizeDynamicCategories = (source?: Record<string, string[]>): Record<string, string[]> | undefined => {
  if (!source) return undefined

  return Object.fromEntries(
    Object.entries(source).map(([key, photos]) => [key, Array.isArray(photos) ? [...photos] : []]),
  )
}

const createEmptyCategorizedPhotos = (): CategorizedPhotos => ({
  room_photos: [],
  proof_photos: [],
  before_photos: [],
  after_photos: [],
})

const normalizeCategorizedPhotos = (
  source: Partial<CategorizedPhotos> | CategorizedPhotos | null | undefined,
): CategorizedPhotos => {
  if (!source) {
    return createEmptyCategorizedPhotos()
  }

  return {
    room_photos: cloneCategoryArray(source.room_photos),
    proof_photos: cloneCategoryArray(source.proof_photos),
    before_photos: cloneCategoryArray(source.before_photos),
    during_photos: source.during_photos ? [...source.during_photos] : undefined,
    after_photos: cloneCategoryArray(source.after_photos),
    dynamic_categories: normalizeDynamicCategories(source.dynamic_categories),
  }
}

const extractServerVersion = (source: unknown): string | null => {
  if (source && typeof source === "object" && "server_updated_at" in source) {
    const candidate = (source as { server_updated_at?: unknown }).server_updated_at
    return typeof candidate === "string" ? candidate : null
  }

  return null
}

function MaintenanceTaskPage({ params }: MaintenanceTaskPageProps) {
  const resolvedParams = params instanceof Promise ? use(params) : params
  const { roomNumber, taskType, location: encodedLocation } = resolvedParams
  const location = decodeURIComponent(encodedLocation)

  const router = useRouter()
  const { user } = useAuth()
  const { maintenanceTasks, updateMaintenanceTask, tasks, updateTask } = useTasks()
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
  const [categorizedPhotos, setCategorizedPhotos] = useState<CategorizedPhotos>(() =>
    normalizeCategorizedPhotos(task?.categorized_photos),
  )
  const lastHydratedTaskIdRef = useRef<string | null>(task?.id ?? null)
  const lastTaskVersionRef = useRef<string | null>(extractServerVersion(task))
  const [elapsedTime, setElapsedTime] = useState(0)
  const [isRunning, setIsRunning] = useState(false)

  useEffect(() => {
    if (!task) {
      lastHydratedTaskIdRef.current = null
      lastTaskVersionRef.current = null
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
      categorized_photos: task.categorized_photos,
    })

    const isNewTask = lastHydratedTaskIdRef.current !== task.id
    const incomingVersion = extractServerVersion(task)
    const incomingPhotos = normalizeCategorizedPhotos(task.categorized_photos)

    setCategorizedPhotos((prev) => {
      const incomingHas = hasCategorizedPhotoEntries(incomingPhotos)
      const prevHas = hasCategorizedPhotoEntries(prev)

      if (incomingHas) {
        console.log("[v0] Loaded categorized photos from task:", {
          before: incomingPhotos.before_photos?.length || 0,
          after: incomingPhotos.after_photos?.length || 0,
        })
        if (incomingVersion) {
          lastTaskVersionRef.current = incomingVersion
        }
        return incomingPhotos
      }

      if (isNewTask || !prevHas) {
        if (incomingVersion) {
          lastTaskVersionRef.current = incomingVersion
        }
        return incomingPhotos
      }

      if (incomingVersion) {
        lastTaskVersionRef.current = incomingVersion
      }

      return prev
    })

    lastHydratedTaskIdRef.current = task.id

    // Load existing notes
    if (task.notes) {
      setRemark(task.notes)
    }

    // Restore timer state
    if (task.status === "in_progress" && task.started_at) {
      const startTime = new Date(task.started_at).getTime()
      const now = Date.now()
      const elapsed = Math.floor((now - startTime) / 1000)
      setElapsedTime(elapsed > 0 ? elapsed : 0)
      setIsRunning(true)
      console.log("[v0] Restored in-progress task, elapsed:", elapsed)
    } else if (task.status === "paused" && task.timer_duration) {
      setElapsedTime(Math.max(task.timer_duration, 0))
      setIsRunning(false)
      console.log("[v0] Restored paused task, duration:", task.timer_duration)
    }
  }, [task, maintenanceTasks, roomNumber])

  useEffect(() => {
    if (!task) return

    const hasPersistedPhotos = hasCategorizedPhotoEntries(
      task.categorized_photos ? normalizeCategorizedPhotos(task.categorized_photos) : null,
    )

    if (hasPersistedPhotos) {
      return
    }

    let cancelled = false

    const hydrate = async () => {
      try {
        const response = await fetch(`/api/tasks/${task.id}`, {
          method: "GET",
          cache: "no-store",
          credentials: "include",
        })

        if (!response.ok) {
          return
        }

        const payload = await response.json()
        if (cancelled) return

        const fetchedTask = payload?.task as Task | undefined
        if (fetchedTask) {
          const incoming = normalizeCategorizedPhotos(fetchedTask.categorized_photos)
          const incomingVersion = extractServerVersion(fetchedTask)

          setCategorizedPhotos((prev) => {
            const incomingHas = hasCategorizedPhotoEntries(incoming)
            const prevHas = hasCategorizedPhotoEntries(prev)

            if (incomingHas || !prevHas) {
              if (incomingVersion) {
                lastTaskVersionRef.current = incomingVersion
              }
              return incoming
            }

            return prev
          })
        }
      } catch (error) {
        console.error("[maintenance] Failed to hydrate task photos", error)
      }
    }

    void hydrate()

    return () => {
      cancelled = true
    }
  }, [task])

  useEffect(() => {
    if (!isRunning || !task?.started_at) return

    const interval = setInterval(() => {
      const startTime = new Date(task.started_at!).getTime()
      const now = Date.now()
      const elapsed = Math.floor((now - startTime) / 1000)
      setElapsedTime(elapsed > 0 ? elapsed : 0)
    }, 1000)

    return () => clearInterval(interval)
  }, [isRunning, task])

  if (!task || !user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
        <p className="text-lg font-semibold text-foreground">Task Not Found</p>
        <p className="text-muted-foreground text-center max-w-md">
          This maintenance task doesn&apos;t exist or hasn&apos;t been scheduled yet. Please check the maintenance calendar for
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
          ? Math.max(Math.floor((now.getTime() - new Date(activeTask.started_at).getTime()) / 1000), 0)
          : Math.max(activeTask.timer_duration || 0, 0)

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
    const blockingRegularTask = tasks.find((t) => t.assigned_to_user_id === user?.id && t.status === "IN_PROGRESS")

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

  const handleResume = () => {
    const blockingRegularTask = tasks.find((t) => t.assigned_to_user_id === user?.id && t.status === "IN_PROGRESS")

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
    const minBeforePhotos = 1
    const minAfterPhotos = 1
    const beforePhotos = categorizedPhotos.before_photos ?? []
    const afterPhotos = categorizedPhotos.after_photos ?? []

    if (beforePhotos.length < minBeforePhotos || afterPhotos.length < minAfterPhotos) {
      toast({
        title: "Photos Required",
        description: `Please upload at least ${minBeforePhotos} before photo and ${minAfterPhotos} after photo for maintenance documentation`,
        variant: "destructive",
      })
      setPhotoModalOpen(true)
      return
    }

    if (!task) return

    updateMaintenanceTask(task.id, {
      status: "completed",
      categorized_photos: {
        before_photos: beforePhotos,
        after_photos: afterPhotos,
      },
      timer_duration: Math.max(elapsedTime, 0),
      completed_at: new Date().toISOString(),
      notes: remark,
    })

    console.log("[v0] Task completed:", task.id, "duration:", elapsedTime)
    toast({
      title: "Task Completed",
      description: "Maintenance task has been marked as complete",
    })
    router.back()
  }

  const handlePhotosCapture = async (bucket: PhotoBucket) => {
    if (!task) return

    const photos = bucketToCategorizedPhotos(bucket)
    const updatedPhotos = normalizeCategorizedPhotos({
      ...categorizedPhotos,
      ...photos,
    })
    const beforePhotos = updatedPhotos.before_photos ?? []
    const afterPhotos = updatedPhotos.after_photos ?? []

    setCategorizedPhotos(updatedPhotos)
    updateMaintenanceTask(task.id, {
      categorized_photos: {
        before_photos: beforePhotos,
        after_photos: afterPhotos,
      },
    })

    if (isOnline()) {
      const success = await updateTask(task.id, { categorized_photos: updatedPhotos })
      if (!success) {
        toast({
          title: "Sync failed",
          description: "Could not persist photos to the server. They remain saved locally.",
          variant: "destructive",
        })
      }
    }

    const totalPhotos = beforePhotos.length + afterPhotos.length

    console.log("[v0] Photos saved to task:", {
      taskId: task.id,
      before: updatedPhotos.before_photos?.length || 0,
      after: updatedPhotos.after_photos?.length || 0,
      total: totalPhotos,
    })

    toast({
      title: "Photos Saved",
      description: `${totalPhotos} photo(s) saved (${updatedPhotos.before_photos?.length || 0} before, ${updatedPhotos.after_photos?.length || 0} after)`,
    })
  }

  const handleRaiseIssue = (issueDescription: string, issuePhotos: string[]) => {
    void issuePhotos
    setRemark((prev) => prev + (prev ? "\n" : "") + `[ISSUE] ${issueDescription}`)
    updateMaintenanceTask(task.id, {
      notes: remark + (remark ? "\n" : "") + `[ISSUE] ${issueDescription}`,
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

    const blockingRegularTask = tasks.find((t) => t.assigned_to_user_id === user.id && t.status === "IN_PROGRESS")

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

  const totalPhotos = (categorizedPhotos.before_photos?.length || 0) + (categorizedPhotos.after_photos?.length || 0)

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
                <div className="text-3xl sm:text-4xl font-bold font-mono">{formatDuration(elapsedTime)}</div>
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
                  {totalPhotos > 0 ? "Add More" : "Capture"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4">
              {categorizedPhotos.before_photos && categorizedPhotos.before_photos.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-500 shrink-0" />
                    <span className="text-xs sm:text-sm font-medium">
                      Before Photos ({categorizedPhotos.before_photos.length})
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {categorizedPhotos.before_photos.map((photo, index) => (
                      <div key={index} className="relative w-full aspect-square">
                        <TaskImage
                          src={photo}
                          alt={`Before photo ${index + 1}`}
                          fill
                          className="rounded-lg border-2 border-blue-500 object-cover"
                          priority={index === 0}
                          sizes="(max-width: 768px) 45vw, 200px"
                        />
                        <div className="absolute bottom-1 left-1 bg-blue-500 text-white text-xs px-2 py-0.5 rounded">
                          Before {index + 1}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {categorizedPhotos.after_photos && categorizedPhotos.after_photos.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCheck className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-xs sm:text-sm font-medium">
                      After Photos ({categorizedPhotos.after_photos.length})
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {categorizedPhotos.after_photos.map((photo, index) => (
                      <div key={index} className="relative w-full aspect-square">
                        <TaskImage
                          src={photo}
                          alt={`After photo ${index + 1}`}
                          fill
                          className="rounded-lg border-2 border-primary object-cover"
                          priority={index === 0}
                          sizes="(max-width: 768px) 45vw, 200px"
                        />
                        <div className="absolute bottom-1 left-1 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded">
                          After {index + 1}
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
              <p className="text-sm text-muted-foreground">
                Completed in {formatDuration(Math.max(elapsedTime, task.timer_duration ?? 0))}
              </p>
            </div>
          )}
        </div>
      </main>

      <CategorizedPhotoCaptureModal
        open={photoModalOpen}
        onOpenChange={setPhotoModalOpen}
        taskId={task.id}
        photoCategories={MAINTENANCE_PHOTO_CATEGORIES}
        existingPhotos={categorizedPhotosToBucket(categorizedPhotos)}
        onSave={handlePhotosCapture}
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
