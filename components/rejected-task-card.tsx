"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AlertCircle, Calendar, User, ImageIcon } from "lucide-react"
import type { Task } from "@/lib/types"
import { useTasks } from "@/lib/task-context"
import { formatExactTimestamp } from "@/lib/date-utils"
import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"

interface RejectedTaskCardProps {
  task: Task
}

export function RejectedTaskCard({ task }: RejectedTaskCardProps) {
  const [showProof, setShowProof] = useState(false)
  const { users } = useTasks()
  const worker = users.find((u) => u.id === task.assigned_to_user_id)

  return (
    <>
      <Card className="border-destructive">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base">{task.title}</CardTitle>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-3 w-3" />
                <span>{worker?.name || "Unknown"}</span>
              </div>
            </div>
            <Badge variant="destructive">Rejected</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>Rejected: {formatExactTimestamp(task.assigned_at)}</span>
          </div>

          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium">Rejection Reason:</p>
                <p className="text-sm text-muted-foreground">{task.supervisor_remark || "No reason provided"}</p>
              </div>
            </div>

            {task.rejection_proof_photo_url && (
              <Button variant="outline" size="sm" onClick={() => setShowProof(true)} className="w-full">
                <ImageIcon className="mr-2 h-4 w-4" />
                View Proof Photo
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={showProof} onOpenChange={setShowProof}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Rejection Proof</DialogTitle>
            <DialogDescription>Photo evidence of the issue</DialogDescription>
          </DialogHeader>
          <img
            src={task.rejection_proof_photo_url || "/placeholder.svg"}
            alt="Rejection proof"
            className="w-full rounded-lg"
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
