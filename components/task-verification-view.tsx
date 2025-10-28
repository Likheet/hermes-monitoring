"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft, CheckCircle, XCircle, Clock, MapPin, User, Camera, ZoomIn } from "lucide-react"
import { PhotoZoomModal } from "@/components/photo-zoom-modal"
import { VerificationChecklist } from "@/components/verification-checklist"
import { RatingModal } from "@/components/rating-modal"
import { RejectionModal } from "@/components/rejection-modal"
import { TaskImage } from "@/components/task-image"
import { useAuth } from "@/lib/auth-context"
import { useTasks } from "@/lib/task-context"
import { useToast } from "@/hooks/use-toast"
import { formatExactTimestamp } from "@/lib/date-utils"
import { getCategorizedPhotoSections } from "@/lib/image-utils"
import type { Task } from "@/lib/types"

const priorityColors: Record<string, string> = {
  GUEST_REQUEST: "bg-red-500 text-white",
  TIME_SENSITIVE: "bg-orange-500 text-white",
  DAILY_TASK: "bg-blue-500 text-white",
  PREVENTIVE_MAINTENANCE: "bg-green-500 text-white",
}

interface TaskVerificationViewProps {
  taskId: string
  returnPath: string
}

type TaskWithLegacyPhoto = Task & { photo_url?: string | null }

type PhotoState = {
  proofPhotos: string[]
  documentationSections: ReturnType<typeof getCategorizedPhotoSections>
  simplePhotos: string[]
  totalPhotoCount: number
}

function derivePhotoState(task: TaskWithLegacyPhoto | null | undefined): PhotoState {
  if (!task) {
    return {
      proofPhotos: [],
      documentationSections: [],
      simplePhotos: [],
      totalPhotoCount: 0,
    }
  }

  const categorizedSections = getCategorizedPhotoSections(task.categorized_photos)
  const proofSection = categorizedSections.find((section) => section.key === "proof_photos")
  const proofPhotos = proofSection?.urls ?? []
  const documentationSections = categorizedSections.filter((section) => section.key !== "proof_photos")
  const documentationCount = documentationSections.reduce((total, section) => total + section.urls.length, 0)
  const simplePhotos = (task.photo_urls ?? []).filter((url): url is string => typeof url === "string" && url.length > 0)
  if (!simplePhotos.length && task.photo_url) {
    simplePhotos.push(task.photo_url)
  }

  return {
    proofPhotos,
    documentationSections,
    simplePhotos,
    totalPhotoCount: proofPhotos.length + documentationCount + simplePhotos.length,
  }
}

export function TaskVerificationView({ taskId, returnPath }: TaskVerificationViewProps) {
  const router = useRouter()
  const { user } = useAuth()
  const { getTaskById, verifyTask, users } = useTasks()
  const { toast } = useToast()

  const baseTask = getTaskById(taskId) as TaskWithLegacyPhoto | undefined
  const [task, setTask] = useState<TaskWithLegacyPhoto | null>(baseTask ?? null)
  const initialPhotoState = useMemo(() => derivePhotoState(baseTask), [baseTask])
  const [photoState, setPhotoState] = useState<PhotoState>(initialPhotoState)
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(initialPhotoState.totalPhotoCount === 0)
  const [photoError, setPhotoError] = useState<string | null>(null)

  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null)
  const [photoZoomOpen, setPhotoZoomOpen] = useState(false)
  const [checklistComplete, setChecklistComplete] = useState(false)
  const [showRatingModal, setShowRatingModal] = useState(false)
  const [showRejectionModal, setShowRejectionModal] = useState(false)

  useEffect(() => {
    if (baseTask) {
      setTask((previous) => {
        if (!previous || previous.id !== baseTask.id) {
          return baseTask
        }
        return previous
      })
    } else {
      setTask((previous) => previous ?? null)
    }
  }, [baseTask])

  useEffect(() => {
    const derived = derivePhotoState(baseTask)
    setPhotoState(derived)
    setIsLoadingPhotos(derived.totalPhotoCount === 0)
    setPhotoError(null)
    setTask(baseTask ?? null)
  }, [taskId])

  useEffect(() => {
    if (initialPhotoState.totalPhotoCount > 0) {
      setPhotoState(initialPhotoState)
      setIsLoadingPhotos(false)
      setPhotoError(null)
    }
  }, [initialPhotoState])

  useEffect(() => {
    if (photoState.totalPhotoCount > 0) {
      return
    }

    let isCancelled = false

    const fetchTaskWithPhotos = async () => {
      setIsLoadingPhotos(true)
      setPhotoError(null)

      try {
        const response = await fetch(`/api/tasks/${taskId}`, {
          method: "GET",
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
          credentials: "include",
        })

        if (!response.ok) {
          throw new Error(`Failed to load task: ${response.status}`)
        }

        const payload = (await response.json()) as { task?: TaskWithLegacyPhoto }
        if (!isCancelled && payload?.task) {
          setTask(payload.task)
          const derived = derivePhotoState(payload.task)
          setPhotoState(derived)
          if (derived.totalPhotoCount > 0) {
            setPhotoError(null)
          }
        }
      } catch (error) {
        console.error("[TaskVerificationView] Unable to fetch task photos:", error)
        if (!isCancelled) {
          setPhotoError("Unable to load photo documentation. Please refresh and try again.")
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingPhotos(false)
        }
      }
    }

    void fetchTaskWithPhotos()

    return () => {
      isCancelled = true
    }
  }, [photoState.totalPhotoCount, taskId])

  if ((!task || !user) && isLoadingPhotos) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading task details…</p>
      </div>
    )
  }

  if (!task || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Task not found</p>
      </div>
    )
  }

  const { proofPhotos, documentationSections, simplePhotos, totalPhotoCount } = photoState
  const documentationCount = documentationSections.reduce((total, section) => total + section.urls.length, 0)
  const hasPhotos = totalPhotoCount > 0
  const hasDocumentation = documentationCount + simplePhotos.length > 0

  // DEBUG: Log image data for troubleshooting
  console.log("[DEBUG] TaskVerificationView - Image Data Analysis:", {
    taskId: task.id,
    taskType: task.task_type,
    categorizedPhotos: task.categorized_photos,
    proofPhotos,
    documentationSections,
    documentationCount,
    simplePhotos,
    photoUrls: task.photo_urls,
    photoUrl: task.photo_url,
    totalPhotoCount,
    userRole: user?.role,
    userDepartment: user?.department
  })

  const worker = users.find((teamMember) => teamMember.id === task.assigned_to_user_id)

  const handleBack = () => {
    router.push(returnPath)
  }

  const handleApprove = () => {
    setShowRatingModal(true)
  }

  const handleRatingSubmit = (rating: number, qualityComment: string, proofPhotoUrl: string | null) => {
    const remark = `Task approved with ${rating} star rating`
    verifyTask(taskId, user.id, true, remark, rating, qualityComment, proofPhotoUrl, null)
    toast({
      title: "Task Approved",
      description: remark,
    })
    router.push(returnPath)
  }

  const handleReject = () => {
    setShowRejectionModal(true)
  }

  const handleRejectionSubmit = (remark: string, proofPhotoUrl: string | null) => {
    verifyTask(taskId, user.id, false, remark, null, null, null, proofPhotoUrl)
    toast({
      title: "Task Rejected",
      description: "Task has been rejected and will be reassigned",
    })
    router.push(returnPath)
  }

  const actualDuration = task.actual_duration_minutes ?? "N/A"
  const expectedDuration = task.expected_duration_minutes ?? "N/A"
  const assignedAt = task.assigned_at ? formatExactTimestamp(task.assigned_at) : "N/A"
  const startedAt = task.started_at ? formatExactTimestamp(task.started_at) : null
  const completedAt = task.completed_at ? formatExactTimestamp(task.completed_at) : null

  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <header className="border-b bg-background">
        <div className="mx-auto flex w-full max-w-4xl items-center gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Back</span>
          </Button>
          <div className="space-y-1">
            <h1 className="text-lg font-semibold sm:text-2xl">Verify Task</h1>
            <p className="text-sm text-muted-foreground">Review documentation and finalize the task outcome.</p>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className="text-xl font-semibold capitalize">{task.task_type.replace(/_/g, " ")}</CardTitle>
                <p className="text-sm text-muted-foreground">Task ID: {task.id}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="uppercase">
                  {task.status.replace(/_/g, " ")}
                </Badge>
                <Badge className={priorityColors[task.priority_level] ?? "bg-secondary text-secondary-foreground"}>
                  {task.priority_level.replace(/_/g, " ")}
                </Badge>
                <Badge variant="outline" className="uppercase">
                  {task.department.replace(/_/g, " ")}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                Assigned Worker
              </div>
              <p className="text-sm font-medium">{worker?.name ?? "Unassigned"}</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                Room
              </div>
              <p className="text-sm font-medium">{task.room_number || "N/A"}</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                Timeline
              </div>
              <p className="text-sm font-medium">Assigned: {assignedAt}</p>
              {startedAt && <p className="text-sm text-muted-foreground">Started: {startedAt}</p>}
              {completedAt && <p className="text-sm text-muted-foreground">Completed: {completedAt}</p>}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                Duration
              </div>
              <p className="text-sm font-medium">
                Expected {expectedDuration} min · {actualDuration === "N/A" ? "Actual pending" : `${actualDuration} min actual`}
              </p>
            </div>
          </CardContent>
        </Card>

        <VerificationChecklist onChecklistComplete={setChecklistComplete} />

        {proofPhotos.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Completion Proof ({proofPhotos.length} photo{proofPhotos.length === 1 ? "" : "s"})
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {proofPhotos.map((url, index) => (
                <button
                  key={`proof-${index}`}
                  type="button"
                  onClick={() => {
                    setSelectedPhoto(url)
                    setPhotoZoomOpen(true)
                  }}
                  className="group relative aspect-[4/3] overflow-hidden rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <TaskImage
                    src={url}
                    alt={`Proof Photo ${index + 1}`}
                    priority={index === 0}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 45vw, 320px"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/40">
                    <ZoomIn className="h-6 w-6 text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>
        )}

        {hasDocumentation && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Task Documentation ({documentationCount + simplePhotos.length} photo
                {documentationCount + simplePhotos.length === 1 ? "" : "s"})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {documentationSections.map((section) => (
                <div key={section.key} className="space-y-2">
                  <p className="text-sm font-semibold text-muted-foreground">{section.label}</p>
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    {section.urls.map((url, index) => (
                      <button
                        key={`${section.key}-${index}`}
                        type="button"
                        onClick={() => {
                          setSelectedPhoto(url)
                          setPhotoZoomOpen(true)
                        }}
                        className="group relative aspect-square overflow-hidden rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <TaskImage
                          src={url}
                          alt={`${section.label} ${index + 1}`}
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 28vw, 160px"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/40">
                          <ZoomIn className="h-6 w-6 text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              {simplePhotos.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-muted-foreground">Task Photos</p>
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    {simplePhotos.map((url, index) => (
                      <button
                        key={`simple-${index}`}
                        type="button"
                        onClick={() => {
                          setSelectedPhoto(url)
                          setPhotoZoomOpen(true)
                        }}
                        className="group relative aspect-square overflow-hidden rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <TaskImage
                          src={url}
                          alt={`Task Photo ${index + 1}`}
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 28vw, 160px"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/40">
                          <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {!hasPhotos && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Task Documentation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {isLoadingPhotos
                  ? "Loading photo documentation…"
                  : photoError ?? "No photo documentation was submitted for this task."}
              </p>
            </CardContent>
          </Card>
        )}

        {task.worker_remark && (
          <Card>
            <CardHeader>
              <CardTitle>Task Remark</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{task.worker_remark}</p>
            </CardContent>
          </Card>
        )}

        {task.pause_history.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Pause History</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {task.pause_history.map((pause, index) => (
                <div key={index} className="text-sm">
                  <p className="font-medium">Pause {index + 1}</p>
                  <p className="text-muted-foreground">Reason: {pause.reason}</p>
                  <p className="text-muted-foreground">Paused at: {new Date(pause.paused_at.client).toLocaleTimeString()}</p>
                  {pause.resumed_at && (
                    <p className="text-muted-foreground">Resumed at: {new Date(pause.resumed_at.client).toLocaleTimeString()}</p>
                  )}
                  {index < task.pause_history.length - 1 && <Separator className="mt-2" />}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {task.audit_log.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Audit Log</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {task.audit_log.map((entry, index) => (
                <div key={index} className="text-sm">
                  <p className="font-medium">{entry.action.replace(/_/g, " ")}</p>
                  <p className="text-muted-foreground">{entry.details}</p>
                  <p className="text-xs text-muted-foreground">{new Date(entry.timestamp.client).toLocaleString()}</p>
                  {index < task.audit_log.length - 1 && <Separator className="mt-2" />}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Supervisor Verification</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button onClick={handleReject} variant="destructive" className="flex-1" disabled={!checklistComplete}>
                <XCircle className="mr-2 h-5 w-5" />
                Reject
              </Button>
              <Button onClick={handleApprove} className="flex-1" disabled={!checklistComplete}>
                <CheckCircle className="mr-2 h-5 w-5" />
                Approve
              </Button>
            </div>

            {!checklistComplete && (
              <p className="text-sm text-center text-muted-foreground">Complete the verification checklist to enable approve/reject</p>
            )}
          </CardContent>
        </Card>
      </main>

      {selectedPhoto && (
        <PhotoZoomModal
          open={photoZoomOpen}
          onOpenChange={(open) => {
            setPhotoZoomOpen(open)
            if (!open) {
              setSelectedPhoto(null)
            }
          }}
          photoUrl={selectedPhoto}
          alt="Task documentation photo"
        />
      )}

      <RatingModal open={showRatingModal} onOpenChange={setShowRatingModal} onSubmit={handleRatingSubmit} taskId={taskId} />

      <RejectionModal open={showRejectionModal} onOpenChange={setShowRejectionModal} onSubmit={handleRejectionSubmit} taskId={taskId} />
    </div>
  )
}
