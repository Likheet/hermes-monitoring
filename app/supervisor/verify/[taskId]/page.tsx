"use client"

import { use, useState } from "react"
import { useRouter } from "next/navigation"
import { ProtectedRoute } from "@/components/protected-route"
import { useAuth } from "@/lib/auth-context"
import { useTasks } from "@/lib/task-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft, CheckCircle, XCircle, Clock, MapPin, User, Camera, ZoomIn } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { PhotoZoomModal } from "@/components/photo-zoom-modal"
import { Loader2, AlertCircle } from "lucide-react"
import { VerificationChecklist } from "@/components/verification-checklist"
import { RatingModal } from "@/components/rating-modal"
import { RejectionModal } from "@/components/rejection-modal"
import { formatExactTimestamp } from "@/lib/date-utils"

interface VerifyTaskProps {
  params: Promise<{ taskId: string }> | { taskId: string }
}

function VerifyTask({ params }: VerifyTaskProps) {
  const resolvedParams = params instanceof Promise ? use(params) : params
  const { taskId } = resolvedParams

  const router = useRouter()
  const { user } = useAuth()
  const { getTaskById, verifyTask, users } = useTasks()
  const { toast } = useToast()

  const task = getTaskById(taskId)
  const [photoZoomOpen, setPhotoZoomOpen] = useState(false)
  const [photoLoading, setPhotoLoading] = useState(true)
  const [photoError, setPhotoError] = useState(false)
  const [checklistComplete, setChecklistComplete] = useState(false)
  const [showRatingModal, setShowRatingModal] = useState(false)
  const [showRejectionModal, setShowRejectionModal] = useState(false)

  if (!task || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Task not found</p>
      </div>
    )
  }

  const worker = users.find((u) => u.id === task.assigned_to_user_id)

  const handleApprove = () => {
    setShowRatingModal(true)
  }

  const handleRatingSubmit = (rating: number, qualityComment: string, proofPhotoUrl: string | null) => {
    const remark = `Task approved with ${rating} star rating`
    verifyTask(taskId, user.id, true, remark, rating, qualityComment, proofPhotoUrl, null)
    toast({
      title: "Task Approved",
      description: `Task approved with ${rating} star rating`,
    })
    router.push("/supervisor")
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
    router.push("/supervisor")
  }

  const priorityColors = {
    GUEST_REQUEST: "bg-red-500 text-white",
    TIME_SENSITIVE: "bg-orange-500 text-white",
    DAILY_TASK: "bg-blue-500 text-white",
    PREVENTIVE_MAINTENANCE: "bg-green-500 text-white",
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="container mx-auto flex items-center gap-4 px-4 py-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/supervisor")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Verify Task</h1>
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
              <User className="h-4 w-4" />
              <span>{worker?.name}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>Room {task.room_number}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>
                Completed in {task.actual_duration_minutes} minutes (Expected: {task.expected_duration_minutes})
              </span>
            </div>
            <div className="text-sm text-muted-foreground">
              Assigned at: {formatExactTimestamp(task.assigned_at.client)}
            </div>
          </CardContent>
        </Card>

        <VerificationChecklist onChecklistComplete={setChecklistComplete} />

        {task.photo_url && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Completion Photo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                {photoLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-muted rounded-lg min-h-[200px]">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                )}
                {photoError && (
                  <div className="flex flex-col items-center justify-center gap-2 bg-muted rounded-lg min-h-[200px] text-muted-foreground">
                    <AlertCircle className="h-8 w-8" />
                    <p className="text-sm">Failed to load photo</p>
                  </div>
                )}
                <div className="relative cursor-pointer group" onClick={() => !photoError && setPhotoZoomOpen(true)}>
                  <img
                    src={task.photo_url || "/placeholder.svg"}
                    alt="Task completion"
                    className="w-full rounded-lg"
                    onLoad={() => setPhotoLoading(false)}
                    onError={() => {
                      setPhotoLoading(false)
                      setPhotoError(true)
                    }}
                  />
                  {!photoError && !photoLoading && (
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                      <ZoomIn className="h-8 w-8 text-white" />
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {task.worker_remark && (
          <Card>
            <CardHeader>
              <CardTitle>Worker Remarks</CardTitle>
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
                  <p className="text-muted-foreground">
                    Paused at: {new Date(pause.paused_at.client).toLocaleTimeString()}
                  </p>
                  {pause.resumed_at && (
                    <p className="text-muted-foreground">
                      Resumed at: {new Date(pause.resumed_at.client).toLocaleTimeString()}
                    </p>
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
              <p className="text-sm text-center text-muted-foreground">
                Complete the verification checklist to enable approve/reject
              </p>
            )}
          </CardContent>
        </Card>
      </main>

      {task.photo_url && (
        <PhotoZoomModal
          open={photoZoomOpen}
          onOpenChange={setPhotoZoomOpen}
          photoUrl={task.photo_url}
          alt="Task completion photo"
        />
      )}

      <RatingModal
        open={showRatingModal}
        onOpenChange={setShowRatingModal}
        onSubmit={handleRatingSubmit}
        taskId={taskId}
      />

      <RejectionModal
        open={showRejectionModal}
        onOpenChange={setShowRejectionModal}
        onSubmit={handleRejectionSubmit}
        taskId={taskId}
      />
    </div>
  )
}

export default function VerifyTaskPage(props: VerifyTaskProps) {
  return (
    <ProtectedRoute allowedRoles={["supervisor"]}>
      <VerifyTask {...props} />
    </ProtectedRoute>
  )
}
