"use client"

import { use, useState, useEffect, useRef, useCallback, useMemo } from "react"
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
import { getCategorizedPhotoSections } from "@/lib/image-utils"
import type { CategorizedPhotos, Task } from "@/lib/types"
import { bucketToCategorizedPhotos, categorizedPhotosToBucket, hasCategorizedPhotoEntries } from "@/lib/photo-utils"
import { formatDuration } from "@/lib/time-utils"
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
import { TaskImage } from "@/components/task-image"

interface TaskDetailProps {
  params: { taskId: string } | Promise<{ taskId: string }>
}

type PhotoCategoryRequirement = NonNullable<Task["photo_categories"]>[number]

const BASE_CATEGORY_KEYS = new Set(["room_photos", "proof_photos", "before_photos", "during_photos", "after_photos"])

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
    updateTask,
    cacheTaskPhotos,
    loadTaskPhotos,
  } = useTasks()
  const { toast } = useToast()

  const task = getTaskById(taskId)
  const [isLoading, setIsLoading] = useState(true)
  const [remark, setRemark] = useState("")
  const [issueModalOpen, setIssueModalOpen] = useState(false)
  const [swapDialogOpen, setSwapDialogOpen] = useState(false)
  const [pausedTaskToSwap, setPausedTaskToSwap] = useState<{ id: string; name: string } | null>(null)
  const [photos, setPhotos] = useState<string[]>([])
  const [showCategorizedPhotoModal, setShowCategorizedPhotoModal] = useState(false)
  const [categorizedPhotos, setCategorizedPhotos] = useState<CategorizedPhotos | null>(null)
  const [elapsedTime, setElapsedTime] = useState(0)
  const lastHydratedTaskIdRef = useRef<string | null>(null)
  const lastTaskVersionRef = useRef<string | null>(null)
  const lastSavedPhotosHashRef = useRef<string | null>(null)

  const sourcePhotos = categorizedPhotos ?? task?.categorized_photos ?? null

  const getPhotosForCategory = useCallback((source: CategorizedPhotos | null, normalizedKey: string): string[] => {
    if (!source) {
      return []
    }

    if (BASE_CATEGORY_KEYS.has(normalizedKey)) {
      const basePhotos = source[normalizedKey as keyof CategorizedPhotos]
      if (Array.isArray(basePhotos)) {
        return basePhotos.filter((item): item is string => typeof item === "string")
      }
    }

    const dynamic = source.dynamic_categories?.[normalizedKey]
    if (Array.isArray(dynamic)) {
      return dynamic.filter((item): item is string => typeof item === "string")
    }

    return []
  }, [])

  // Set loading to false once we have tasks loaded OR after timeout
  useEffect(() => {
    if (task) {
      // Task found, stop loading immediately
      setIsLoading(false)
      return
    }

    // If no task yet, wait max 3 seconds for tasks to load
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 3000)

    return () => clearTimeout(timer)
  }, [task, tasks.length]) // Also depend on tasks.length to re-check when tasks load

  const computePhotosHash = useCallback((photos: CategorizedPhotos | null) => JSON.stringify(photos ?? null), [])

  const photoCacheKey = useMemo(() => `hermes-task-photos-${taskId}`, [taskId])

  const applyLocalCategorizedPhotos = useCallback(
    (photos: CategorizedPhotos | null) => {
      setCategorizedPhotos(photos)
      lastSavedPhotosHashRef.current = computePhotosHash(photos)
      cacheTaskPhotos(taskId, photos)
    },
    [cacheTaskPhotos, computePhotosHash, taskId],
  )

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    if (window.localStorage.getItem(photoCacheKey)) {
      window.localStorage.removeItem(photoCacheKey)
    }
  }, [photoCacheKey])

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
    if (!task) {
      setPhotos([])
      applyLocalCategorizedPhotos(null)
      lastHydratedTaskIdRef.current = null
      lastTaskVersionRef.current = null
      lastSavedPhotosHashRef.current = null
      return
    }

    if (task.photo_urls && task.photo_urls.length > 0) {
      setPhotos(task.photo_urls)
    }

    // Don't overwrite local changes while modal is open
    if (showCategorizedPhotoModal) {
      console.log("[worker] Skipping photo sync - modal is open")
      return
    }

    const isNewTask = lastHydratedTaskIdRef.current !== task.id
    const incomingVersion = task.server_updated_at ?? null
    const incomingPhotos = task.categorized_photos ?? null
    const incomingHas = hasCategorizedPhotoEntries(incomingPhotos)
    const incomingHash = computePhotosHash(incomingPhotos)
    const lastSavedHash = lastSavedPhotosHashRef.current
    const localHas = hasCategorizedPhotoEntries(categorizedPhotos)

    console.log("[worker] Photo sync check:", {
      isNewTask,
      incomingHas,
      localHas,
      incomingVersion,
      lastTaskVersion: lastTaskVersionRef.current,
      incomingHash: incomingHash.substring(0, 50),
      lastSavedHash: lastSavedHash?.substring(0, 50),
    })

    // On fresh page load or new task, always use server data
    if (isNewTask) {
      console.log("[worker] New task detected - applying server photos")
      applyLocalCategorizedPhotos(incomingPhotos)
      lastTaskVersionRef.current = incomingVersion ?? lastTaskVersionRef.current
      lastHydratedTaskIdRef.current = task.id
      return
    }

    // Server has photos and they're different from what we have
    if (incomingHas && incomingHash !== lastSavedHash) {
      console.log("[worker] Server has different photos - applying update")
      applyLocalCategorizedPhotos(incomingPhotos)
      lastTaskVersionRef.current = incomingVersion ?? lastTaskVersionRef.current
    } 
    // Server has no photos, we have no photos, and this is initial load
    else if (!incomingHas && !localHas && lastSavedHash === null) {
      console.log("[worker] No photos anywhere - initializing empty")
      applyLocalCategorizedPhotos(incomingPhotos)
      lastTaskVersionRef.current = incomingVersion ?? lastTaskVersionRef.current
    } 
    // Version changed - check if we should update
    else if (incomingVersion && incomingVersion !== lastTaskVersionRef.current) {
      console.log("[worker] Server version changed - checking if update needed")
      lastTaskVersionRef.current = incomingVersion
      // Only apply if hashes match (no local changes) or server has photos
      if (incomingHash === lastSavedHash || incomingHas) {
        console.log("[worker] Applying server photos due to version change")
        applyLocalCategorizedPhotos(incomingPhotos)
      }
    } else {
      console.log("[worker] No photo sync needed - keeping current state")
    }

    lastHydratedTaskIdRef.current = task.id
  }, [applyLocalCategorizedPhotos, categorizedPhotos, computePhotosHash, showCategorizedPhotoModal, task])

  useEffect(() => {
    if (!task || !task.photo_documentation_required) {
      return
    }

    // Don't fetch if modal is open - user might be actively adding photos
    if (showCategorizedPhotoModal) {
      return
    }

    const hasLocalPhotos = hasCategorizedPhotoEntries(categorizedPhotos)
    const hasTaskPhotos = hasCategorizedPhotoEntries(task.categorized_photos)

    if (hasLocalPhotos || hasTaskPhotos) {
      return
    }

    let cancelled = false

    const hydrateTask = async () => {
      try {
        const response = await loadTaskPhotos(task.id)
        if (cancelled || !response) {
          return
        }

        const incoming = response.photos ?? null
        const incomingVersion = response.serverUpdatedAt ?? null
        const incomingHas = hasCategorizedPhotoEntries(incoming)
        const incomingHash = computePhotosHash(incoming)
        const isNewPageLoad = lastHydratedTaskIdRef.current !== task.id

        if (isNewPageLoad) {
          applyLocalCategorizedPhotos(incoming)
          lastTaskVersionRef.current = incomingVersion ?? lastTaskVersionRef.current
          return
        }

        const prevHas = hasCategorizedPhotoEntries(categorizedPhotos)
        if (incomingHas || !prevHas || incomingHash === lastSavedPhotosHashRef.current) {
          applyLocalCategorizedPhotos(incoming)
          lastTaskVersionRef.current = incomingVersion ?? lastTaskVersionRef.current
        }
      } catch (error) {
        console.error("[worker] Failed to hydrate categorized photos", error)
      }
    }

    void hydrateTask()

    return () => {
      cancelled = true
    }
  }, [
    applyLocalCategorizedPhotos,
    categorizedPhotos,
    computePhotosHash,
    loadTaskPhotos,
    showCategorizedPhotoModal,
    task,
    task?.id,
    task?.photo_documentation_required,
  ])

  // Show loading state while waiting for task data
  if (isLoading && !task) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="text-muted-foreground">Loading task...</p>
      </div>
    )
  }

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
      const requiredCategories = task.photo_categories.filter(
        (category): category is PhotoCategoryRequirement => Boolean(category),
      )

      console.log("[worker] Checking photo requirements before complete:", {
        requiredCategories,
        categorizedPhotos,
        task_categorized_photos: task.categorized_photos,
        sourcePhotos,
      })

      const allCategoriesFilled = requiredCategories.every((category) => {
        const key = category.name.toLowerCase().replace(/\s+/g, "_")
        const photosForCategory = getPhotosForCategory(sourcePhotos, key)
        const photoCount = photosForCategory.length
        const isFilled = photoCount >= category.count

        console.log(
          `[worker] Category '${category.name}' (${key}): ${photoCount}/${category.count} - ${isFilled ? "OK" : "MISSING"}`,
          photosForCategory,
        )

        return isFilled
      })

      if (!allCategoriesFilled) {
        console.error("[worker] Photo validation failed", {
          categorizedPhotos,
          task_categorized_photos: task.categorized_photos,
          sourcePhotos,
        })
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
            ? sourcePhotos
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
      ? sourcePhotos ?? {
          room_photos: [],
          proof_photos: [],
        }
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
      const requiredCategories = task.photo_categories.filter(
        (category): category is PhotoCategoryRequirement => Boolean(category),
      )
      const totalPhotos = requiredCategories.reduce((sum, category) => sum + category.count, 0)
      const types = requiredCategories.length
      return `${totalPhotos} photo${totalPhotos > 1 ? "s" : ""} (${types} type${types > 1 ? "s" : ""}) required`
    }
    if (task.photo_required) {
      const count = task.photo_count || task.custom_task_photo_count || 1
      return `${count} photo${count > 1 ? "s" : ""} required`
    }
    return null
  }

  const photoRequirementText = getPhotoRequirementText()
  const combinedCategorizedPhotos = categorizedPhotos ?? task.categorized_photos ?? null
  const categorizedSections = getCategorizedPhotoSections(combinedCategorizedPhotos)

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
              <div className="mt-4 rounded-xl border border-blue-500/70 bg-blue-500/15 px-4 py-3 shadow-sm dark:border-blue-400/60 dark:bg-blue-900/40">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-blue-600 dark:text-blue-300 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-blue-900 dark:text-blue-50 mb-1">
                      Instructions from Front Office
                    </p>
                    <p className="text-sm text-blue-950 dark:text-blue-100 leading-relaxed break-words whitespace-normal">
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
                <div className="text-4xl font-bold font-mono">{formatDuration(elapsedTime)}</div>
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
              <CardContent className="space-y-4">
                <Button onClick={() => setShowCategorizedPhotoModal(true)} variant="outline" className="w-full">
                  <Camera className="mr-2 h-4 w-4" />
                  Capture Photos ({
                    task.photo_categories
                      .filter((category): category is PhotoCategoryRequirement => Boolean(category))
                      .reduce((sum, category) => sum + category.count, 0)
                  }{" "}
                  required)
                </Button>

                {categorizedSections.length > 0 ? (
                  <div className="space-y-4">
                    {categorizedSections.map((section, sectionIndex) => (
                      <div key={section.key} className="space-y-2">
                        <p className="text-sm font-semibold text-muted-foreground">{section.label}</p>
                        <div className="grid grid-cols-3 gap-2 sm:gap-3">
                          {section.urls.map((url, index) => (
                            <div key={`${section.key}-${index}`} className="relative w-full aspect-square">
                              <TaskImage
                                src={url}
                                alt={`${section.label} ${index + 1}`}
                                fill
                                className="rounded-lg object-cover border border-border"
                                priority={sectionIndex === 0 && index === 0}
                                sizes="(max-width: 768px) 28vw, 160px"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center">
                    No photos captured yet. Use the button above to start documenting the task.
                  </p>
                )}
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
                  <div key={index} className="relative w-full aspect-square">
                    <TaskImage
                      src={photo}
                      alt={`Photo ${index + 1}`}
                      fill
                      className="rounded-lg border object-cover"
                      sizes="(max-width: 768px) 28vw, 160px"
                    />
                  </div>
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
          existingPhotos={categorizedPhotos ? categorizedPhotosToBucket(categorizedPhotos) : undefined}
          onSave={async (photoBucket) => {
            const nextCategorized = bucketToCategorizedPhotos(photoBucket)
            console.log("[worker] Saving photos from modal:", nextCategorized)
            
            // Apply immediately to local state
            applyLocalCategorizedPhotos(nextCategorized)

            if (!isOnline()) {
              setShowCategorizedPhotoModal(false)
              toast({
                title: "Offline Mode",
                description: "Photos saved locally. They will sync when you're back online.",
              })
              return
            }

            // Save to server
            const success = await updateTask(task.id, { categorized_photos: nextCategorized })
            
            if (success) {
              console.log("[worker] Photos saved to server successfully")
              // Force update local state again to ensure it's in sync
              applyLocalCategorizedPhotos(nextCategorized)
              
              setShowCategorizedPhotoModal(false)
              toast({
                title: "Photos Saved",
                description: "Your photo documentation is stored safely.",
              })
            } else {
              console.error("[worker] Failed to save photos to server")
              setShowCategorizedPhotoModal(false)
              toast({
                title: "Save Failed",
                description: "Unable to persist photos. Please try again when connection stabilises.",
                variant: "destructive",
              })
            }
          }}
        />
      )}

      <RaiseIssueModal open={issueModalOpen} onOpenChange={setIssueModalOpen} onSubmit={handleRaiseIssue} />

      <AlertDialog open={swapDialogOpen} onOpenChange={setSwapDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Can&apos;t Pause Multiple Tasks</AlertDialogTitle>
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
            <AlertDialogAction onClick={() => swapTasks(taskId, pausedTaskToSwap!.id, user!.id)}>
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
    <ProtectedRoute allowedRoles={["worker", "front_office", "supervisor", "manager", "admin"]}>
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
