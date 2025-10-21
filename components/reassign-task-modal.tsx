"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTasks } from "@/lib/task-context"
import { useAuth } from "@/lib/auth-context"
import type { Task } from "@/lib/types"

interface ReassignTaskModalProps {
  task: Task
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ReassignTaskModal({ task, open, onOpenChange }: ReassignTaskModalProps) {
  const { reassignTask, users } = useTasks()
  const { user } = useAuth()
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>("")
  const [reason, setReason] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const workerOptions = users.filter((u) => u.role === "worker" && u.id !== task.assigned_to_user_id)

  const assigneeOptions = (() => {
    if (!user || user.id === task.assigned_to_user_id) {
      return workerOptions
    }

    const alreadyIncluded = workerOptions.some((worker) => worker.id === user.id)
    return alreadyIncluded ? workerOptions : [user, ...workerOptions]
  })()

  const handleReassign = () => {
    if (!selectedWorkerId || !reason.trim() || !user) return

    setIsSubmitting(true)
    reassignTask(task.id, selectedWorkerId, user.id, reason)
    setIsSubmitting(false)
    onOpenChange(false)
    setSelectedWorkerId("")
    setReason("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Re-assign Task</DialogTitle>
          <DialogDescription>
            Re-assign this task to a different worker. The current worker will no longer see this task.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Current Task</Label>
            <div className="p-3 bg-muted rounded-lg text-sm">
              <p className="font-medium">{task.task_type}</p>
              <p className="text-muted-foreground">Room: {task.room_number}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="worker">Select New Assignee</Label>
            <Select value={selectedWorkerId} onValueChange={setSelectedWorkerId}>
              <SelectTrigger id="worker">
                <SelectValue placeholder="Choose an assignee" />
              </SelectTrigger>
              <SelectContent>
                {assigneeOptions.map((assignee) => {
                  const isSelf = user && assignee.id === user.id
                  return (
                    <SelectItem key={assignee.id} value={assignee.id}>
                      {isSelf ? `Assign to myself (${assignee.name})` : `${assignee.name} - ${assignee.department}`}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Re-assignment</Label>
            <Textarea
              id="reason"
              placeholder="e.g., Worker is too far away, wrong assignment, etc."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleReassign} disabled={!selectedWorkerId || !reason.trim() || isSubmitting}>
              {isSubmitting ? "Re-assigning..." : "Re-assign Task"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
