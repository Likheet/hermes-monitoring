"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { SimplePhotoCapture } from "@/components/simple-photo-capture"
import { CategorizedPhotoCaptureModal } from "@/components/categorized-photo-capture-modal"
import { PauseTimeline } from "@/components/timer/pause-timeline"
import { useTasks } from "@/lib/task-context"
import { useAuth } from "@/lib/auth-context"
import { useToast } from "@/hooks/use-toast"
import { formatFullTimestamp } from "@/lib/date-utils"
import { formatDuration } from "@/lib/time-utils"
import type { Task, CategorizedPhotos } from "@/lib/types"
import {
  CheckCircle2,
  Clock,
  ImageIcon,
  Loader2,
  MapPin,
  Pause,
  Play,
  ShieldCheck,
  User,
} from "lucide-react"
import { bucketToCategorizedPhotos, categorizedPhotosToBucket, type PhotoBucket } from "@/lib/photo-utils"

interface FrontDeskActiveTaskModalProps {
  task: Task | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const PRIORITY_STYLES: Record<string, string> = {
  GUEST_REQUEST: "bg-red-500 text-white",
  TIME_SENSITIVE: "bg-orange-500 text-white",
  DAILY_TASK: "bg-blue-500 text-white",
  PREVENTIVE_MAINTENANCE: "bg-emerald-500 text-white",
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-yellow-500 text-white",
  IN_PROGRESS: "bg-blue-500 text-white",
  PAUSED: "bg-orange-500 text-white",
  COMPLETED: "bg-green-500 text-white",
  REJECTED: "bg-red-500 text-white",
}

type PendingAction = "start" | "pause" | "resume" | "complete" | null

export function FrontDeskActiveTaskModal({ task, open, onOpenChange }: FrontDeskActiveTaskModalProps) {
  const { user } = useAuth()
  const { tasks, users, startTask, pauseTask, resumeTask, completeTask, updateTask } = useTasks()
  const { toast } = useToast()

  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [pauseReason, setPauseReason] = useState("")
  const [completionRemark, setCompletionRemark] = useState("")
  const [photos, setPhotos] = useState<string[]>([])
  const [categorizedPhotos, setCategorizedPhotos] = useState<PhotoBucket | null>(null)
  const [showCategorizedPhotoModal, setShowCategorizedPhotoModal] = useState(false)
  const [elapsedTime, setElapsedTime] = useState(0)

  const activeTask = useMemo(() => {
    if (!task) return null
    return tasks.find((candidate) => candidate.id === task.id) ?? task
  }, [task, tasks])

  useEffect(() => {
    if (!activeTask) return

    setPauseReason("")
    setCompletionRemark(activeTask.worker_remark || "")
    setPhotos(activeTask.photo_urls || [])
    setCategorizedPhotos(
      activeTask.categorized_photos ? categorizedPhotosToBucket(activeTask.categorized_photos) : null,
    )

    if (activeTask.status === "IN_PROGRESS" && activeTask.started_at) {
      const interval = setInterval(() => {
        const startTime = new Date(activeTask.started_at!.client).getTime()
        const now = Date.now()

        let pausedDuration = 0
        activeTask.pause_history.forEach((pause) => {
          if (pause.resumed_at) {
            const pauseStart = new Date(pause.paused_at.client).getTime()
            const pauseEnd = new Date(pause.resumed_at.client).getTime()
            pausedDuration += pauseEnd - pauseStart
          } else {
            const pauseStart = new Date(pause.paused_at.client).getTime()
            pausedDuration += now - pauseStart
          }
        })

        const elapsed = Math.max(0, Math.floor((now - startTime - pausedDuration) / 1000))
        setElapsedTime(elapsed)
      }, 1000)

      return () => clearInterval(interval)
    }

    setElapsedTime(0)
  }, [activeTask])

  useEffect(() => {
    if (!activeTask || !activeTask.photo_documentation_required) {
      return
    }

    const hasPersistedPhotos = Boolean(
      activeTask.categorized_photos &&
        Object.values(activeTask.categorized_photos).some((value) => Array.isArray(value) && value.length > 0),
    )

    if (hasPersistedPhotos) {
      return
    }

    let cancelled = false

    const hydrate = async () => {
      try {
        const response = await fetch(`/api/tasks/${activeTask.id}`, {
          method: "GET",
          cache: "no-store",
          credentials: "include",
        })

        if (!response.ok) {
          return
        }

        const payload = (await response.json()) as { task?: Task }
        if (cancelled || !payload?.task?.categorized_photos) {
          return
        }

        setCategorizedPhotos(categorizedPhotosToBucket(payload.task.categorized_photos))
      } catch (error) {
        console.error("[front-desk] Failed to hydrate categorized photos", error)
      }
    }

    void hydrate()

    return () => {
      cancelled = true
    }
  }, [activeTask])

  useEffect(() => {
    if (!open) {
      setPendingAction(null)
      setPauseReason("")
      setCompletionRemark("")
      setPhotos([])
  setCategorizedPhotos(null)
      setElapsedTime(0)
    }
  }, [open])

  if (!activeTask) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>No task selected</DialogTitle>
            <DialogDescription>Select a task to manage it.</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    )
  }

  const assignerName =
    users.find((candidate) => candidate.id === activeTask.assigned_by_user_id)?.name || "Unknown"

  const requiredSimplePhotoCount =
    activeTask.photo_count || activeTask.custom_task_photo_count || (activeTask.photo_required ? 1 : 0)

  const isCategorizedRequirement =
    !!activeTask.photo_documentation_required && !!activeTask.photo_categories?.length

  const statusLabel = activeTask.status.replace(/_/g, " ")
  const priorityLabel = activeTask.priority_level.replace(/_/g, " ")

  const handleStart = async () => {
    if (!user) return
    setPendingAction("start")
    const result = await startTask(activeTask.id, user.id)
    setPendingAction(null)
    if (!result?.success) {
      toast({
        title: "Could not start task",
        description: result?.error || "Please try again.",
        variant: "destructive",
      })
      return
    }
    toast({ title: "Task started", description: "Timer is now running." })
  }

  const handlePause = async () => {
    if (!user) return
    const reason = pauseReason.trim()
    if (!reason) {
      toast({
        title: "Pause reason required",
        description: "Please add a brief reason before pausing.",
        variant: "destructive",
      })
      return
    }
    setPendingAction("pause")
    const result = await pauseTask(activeTask.id, user.id, reason)
    setPendingAction(null)
    if (!result?.success) {
      toast({
        title: "Could not pause task",
        description: result?.error || "Please try again.",
        variant: "destructive",
      })
      return
    }
    toast({ title: "Task paused", description: "Task is now paused." })
  }

  const handleResume = async () => {
    if (!user) return
    setPendingAction("resume")
    const result = await resumeTask(activeTask.id, user.id)
    setPendingAction(null)
    if (!result?.success) {
      toast({
        title: "Could not resume task",
        description: result?.error || "Please try again.",
        variant: "destructive",
      })
      return
    }
    toast({ title: "Task resumed", description: "Timer is running again." })
  }

  const handleComplete = async () => {
    if (!user) return

    if (isCategorizedRequirement) {
      const categories = activeTask.photo_categories!
      const allCaptured = categories.every((category) => {
        const key = category.name.toLowerCase().replace(/\s+/g, "_")
        const captured = categorizedPhotos?.[key] || []
        return captured.length >= category.count
      })
      if (!allCaptured) {
        toast({
          title: "Photos required",
          description: "Please capture all required photo categories before completing.",
          variant: "destructive",
        })
        return
      }
    } else if (activeTask.photo_required) {
      if (photos.length < requiredSimplePhotoCount) {
        toast({
          title: "Photos required",
          description: `Capture at least ${requiredSimplePhotoCount} photo${
            requiredSimplePhotoCount > 1 ? "s" : ""
          } before completing.`,
          variant: "destructive",
        })
        return
      }
    }

    setPendingAction("complete")
    try {
      const remark = completionRemark.trim()
      let payload: CategorizedPhotos

      if (isCategorizedRequirement && categorizedPhotos) {
        payload = bucketToCategorizedPhotos(categorizedPhotos)
      } else {
        const midway = Math.ceil(photos.length / 2)
        payload = {
          room_photos: photos.slice(0, midway),
          proof_photos: photos.slice(midway),
        }
      }

      await completeTask(activeTask.id, user.id, payload, remark)
      toast({
        title: "Task completed",
        description: "Task submitted for supervisor review.",
      })
      onOpenChange(false)
    } catch (error) {
      console.error("[front-desk] Failed to complete task", error)
      toast({
        title: "Failed to complete task",
        description: "Please try again.",
        variant: "destructive",
      })
    } finally {
      setPendingAction(null)
    }
  }

  const formattedAssignedAt = formatFullTimestamp(activeTask.assigned_at.client)
  const isActionLoading = !!pendingAction
  const totalSimplePhotos = photos.length

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) {
            onOpenChange(false)
          }
        }}
      >
        <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="border-b bg-muted/30 px-4 py-4 sm:px-6 sm:py-5">
            <DialogTitle className="flex flex-col gap-2">
              <span className="text-xl font-semibold sm:text-2xl">{activeTask.task_type}</span>
              <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                <Badge variant="secondary" className={STATUS_STYLES[activeTask.status]}>
                  {statusLabel}
                </Badge>
                <Badge className={PRIORITY_STYLES[activeTask.priority_level]}>{priorityLabel}</Badge>
                <Badge variant="outline" className="gap-1">
                  <Clock className="h-3 w-3" />
                  Expected {activeTask.expected_duration_minutes} min
                </Badge>
              </div>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground sm:text-sm">
              Assigned {formattedAssignedAt} by {assignerName}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
            <div className="space-y-6">
            <section className="grid gap-4 sm:grid-cols-2">
              <Card className="border-primary/20">
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <CardTitle className="text-base font-medium">Assignment</CardTitle>
                  <ShieldCheck className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span>Assigned by {assignerName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span>Room {activeTask.room_number || "N/A"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span>Updated {formattedAssignedAt}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-medium">
                    Status
                    {activeTask.status === "IN_PROGRESS" && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">(live)</span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2">
                    <span className="font-medium text-foreground">{statusLabel}</span>
                    {activeTask.status === "IN_PROGRESS" ? (
                      <span className="font-mono text-sm text-primary">{formatDuration(elapsedTime)}</span>
                    ) : (
                      <span>{activeTask.started_at ? formatFullTimestamp(activeTask.started_at.client) : "Not started"}</span>
                    )}
                  </div>
                  {activeTask.completed_at && (
                    <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2">
                      <span className="font-medium text-foreground">Completed</span>
                      <span>{formatFullTimestamp(activeTask.completed_at.client)}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>

            {isCategorizedRequirement && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <CardTitle className="text-base font-medium">Photo documentation</CardTitle>
                  <Button variant="outline" size="sm" onClick={() => setShowCategorizedPhotoModal(true)}>
                    <ImageIcon className="mr-2 h-4 w-4" />
                    Manage photos
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-2 text-sm">
                    {activeTask.photo_categories?.map((category) => {
                      const key = category.name.toLowerCase().replace(/\s+/g, "_")
                      const captured = categorizedPhotos?.[key]?.length || 0
                      const isComplete = captured >= category.count
                      return (
                        <div
                          key={key}
                          className="flex items-center justify-between rounded-md border px-3 py-2 text-muted-foreground"
                        >
                          <span className="font-medium text-foreground">{category.name}</span>
                          <span className={isComplete ? "text-primary font-semibold" : ""}>
                            {captured}/{category.count} required
                          </span>
                        </div>
                      )
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Photos upload instantly and can be edited anytime before completion.
                  </p>
                </CardContent>
              </Card>
            )}

            {activeTask.photo_required && !isCategorizedRequirement && (
              <SimplePhotoCapture
                taskId={activeTask.id}
                existingPhotos={photos}
                onPhotosChange={setPhotos}
                minPhotos={requiredSimplePhotoCount}
                initialButtonLabel="Add photo proof"
                additionalButtonLabel="Add another proof photo"
              />
            )}

            {!activeTask.photo_required && !isCategorizedRequirement && totalSimplePhotos > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-medium">
                    Photos submitted ({totalSimplePhotos})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-2">
                    {photos.map((photo, index) => (
                      <div key={index} className="aspect-square">
                        {/* eslint-disable-next-line @next/next/no-img-element -- Photos come from the camera capture pipeline as data URLs */}
                        <img
                          src={photo || "/placeholder.svg"}
                          alt={`Photo ${index + 1}`}
                          className="h-full w-full rounded-lg border object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTask.pause_history.length > 0 && <PauseTimeline pauseHistory={activeTask.pause_history} />}

            {activeTask.status === "IN_PROGRESS" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-medium">Pause task</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Label htmlFor="pause-reason">Pause reason</Label>
                  <Input
                    id="pause-reason"
                    placeholder="e.g., assisting a guest at reception"
                    value={pauseReason}
                    onChange={(event) => setPauseReason(event.target.value)}
                  />
                </CardContent>
              </Card>
            )}

            {(activeTask.status === "IN_PROGRESS" || activeTask.status === "PAUSED") && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-medium">Completion note</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Label htmlFor="completion-note">Optional note for supervisors</Label>
                  <Textarea
                    id="completion-note"
                    placeholder="Share context or final remarks before completing."
                    rows={4}
                    value={completionRemark}
                    onChange={(event) => setCompletionRemark(event.target.value)}
                  />
                </CardContent>
              </Card>
            )}

            </div>
          </div>

          <div className="border-t bg-muted/30 px-4 py-4 sm:px-6 sm:py-5">
            <div className="grid gap-2 sm:grid-cols-2">
              {activeTask.status === "PENDING" && (
                <Button
                  onClick={handleStart}
                  disabled={isActionLoading}
                  className="min-h-[48px] w-full justify-center gap-2 sm:col-span-2 sm:w-auto sm:justify-self-center"
                >
                  {pendingAction === "start" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      Start task
                    </>
                  )}
                </Button>
              )}

              {activeTask.status === "IN_PROGRESS" && (
                <>
                  <Button
                    variant="outline"
                    onClick={handlePause}
                    disabled={isActionLoading}
                    className="min-h-[48px] justify-center gap-2"
                  >
                    {pendingAction === "pause" ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Pausing...
                      </>
                    ) : (
                      <>
                        <Pause className="h-4 w-4" />
                        Pause task
                      </>
                    )}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={handleComplete}
                    disabled={isActionLoading}
                    className="min-h-[48px] justify-center gap-2"
                  >
                    {pendingAction === "complete" ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Completing...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Complete task
                      </>
                    )}
                  </Button>
                </>
              )}

              {activeTask.status === "PAUSED" && (
                <>
                  <Button
                    onClick={handleResume}
                    disabled={isActionLoading}
                    className="min-h-[48px] justify-center gap-2"
                  >
                    {pendingAction === "resume" ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Resuming...
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4" />
                        Resume task
                      </>
                    )}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={handleComplete}
                    disabled={isActionLoading}
                    className="min-h-[48px] justify-center gap-2"
                  >
                    {pendingAction === "complete" ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Completing...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Complete task
                      </>
                    )}
                  </Button>
                </>
              )}

            </div>
          </div>
        </DialogContent>
      </Dialog>

      {isCategorizedRequirement && activeTask.photo_categories && (
        <CategorizedPhotoCaptureModal
          open={showCategorizedPhotoModal}
          onOpenChange={setShowCategorizedPhotoModal}
          taskId={activeTask.id}
          photoCategories={activeTask.photo_categories}
          existingPhotos={categorizedPhotos || undefined}
          onSave={async (nextPhotos) => {
            setCategorizedPhotos(nextPhotos)
            setShowCategorizedPhotoModal(false)

            if (!activeTask) {
              toast({
                title: "Task unavailable",
                description: "Unable to locate the active task to save photos.",
                variant: "destructive",
              })
              return
            }

            const payload = bucketToCategorizedPhotos(nextPhotos)
            const success = await updateTask(activeTask.id, { categorized_photos: payload })

            if (success) {
              toast({
                title: "Photos updated",
                description: "Photo documentation saved successfully.",
              })
            } else {
              toast({
                title: "Save failed",
                description: "Could not persist photos. Please try again soon.",
                variant: "destructive",
              })
            }
          }}
        />
      )}
    </>
  )
}
