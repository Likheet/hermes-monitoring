"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTasks } from "@/lib/task-context"
import type { Task, PriorityLevel } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
import { AlertCircle, StopCircle } from "lucide-react"
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

interface EditTaskModalProps {
  task: Task
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditTaskModal({ task, open, onOpenChange }: EditTaskModalProps) {
  const { updateTask } = useTasks()
  const { toast } = useToast()
  const [priorityLevel, setPriorityLevel] = useState<PriorityLevel>(task.priority_level)
  const [photoRequired, setPhotoRequired] = useState(task.photo_required)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showStopRecurringDialog, setShowStopRecurringDialog] = useState(false)

  const isOtherTask = task.task_type === "Other (Custom Task)" || task.custom_task_name
  const isRecurring = task.custom_task_is_recurring || task.is_recurring

  const handleStopRecurring = async () => {
    setIsSubmitting(true)

    try {
      await updateTask(task.id, {
        custom_task_is_recurring: false,
        custom_task_recurring_frequency: null,
        custom_task_requires_specific_time: false,
        custom_task_recurring_time: null,
        is_recurring: false,
        recurring_frequency: null,
      })

      toast({
        title: "Recurring Stopped",
        description: "This task will no longer generate new instances when completed",
      })

      setShowStopRecurringDialog(false)
      onOpenChange(false)
    } catch (error) {
      toast({
        title: "Failed to Stop",
        description: "Could not stop recurring. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSave = async () => {
    if (!isOtherTask) {
      toast({
        title: "Cannot Edit",
        description: "Only custom 'Other' tasks can be edited",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      await updateTask(task.id, {
        priority_level: priorityLevel,
        photo_required: photoRequired,
      })

      toast({
        title: "Task Updated",
        description: "Task details have been updated successfully",
      })

      onOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
          <DialogDescription>
            {isOtherTask ? "Update task priority and photo requirements" : "Only custom 'Other' tasks can be edited"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Current Task</Label>
            <div className="p-3 bg-muted rounded-lg text-sm">
              <p className="font-medium">{task.custom_task_name || task.task_type}</p>
              <p className="text-muted-foreground">Room: {task.room_number}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority">Priority Level</Label>
            <Select
              value={priorityLevel}
              onValueChange={(value) => setPriorityLevel(value as PriorityLevel)}
              disabled={!isOtherTask}
            >
              <SelectTrigger id="priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GUEST_REQUEST">Guest Request</SelectItem>
                <SelectItem value="TIME_SENSITIVE">Time Sensitive</SelectItem>
                <SelectItem value="DAILY_TASK">Daily Task</SelectItem>
                <SelectItem value="PREVENTIVE_MAINTENANCE">Preventive Maintenance</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="photo-required"
                checked={photoRequired}
                onChange={(e) => setPhotoRequired(e.target.checked)}
                className="h-4 w-4"
                disabled={!isOtherTask}
              />
              <Label htmlFor="photo-required" className="cursor-pointer">
                Photo documentation required
              </Label>
            </div>
          </div>

          {/* Stop Recurring Section */}
          {isRecurring && (
            <div className="border-t pt-4 mt-4">
              <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-500 mt-0.5 shrink-0" />
                <div className="flex-1 space-y-2">
                  <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                    Recurring Task Active
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    This task will automatically create a new instance when marked as completed.
                    Frequency: <span className="font-medium">{task.custom_task_recurring_frequency || task.recurring_frequency}</span>
                  </p>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowStopRecurringDialog(true)}
                    disabled={isSubmitting}
                    className="mt-2"
                  >
                    <StopCircle className="h-4 w-4 mr-2" />
                    Stop Recurring
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!isOtherTask || isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* Stop Recurring Confirmation Dialog */}
      <AlertDialog open={showStopRecurringDialog} onOpenChange={setShowStopRecurringDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stop Recurring Task?</AlertDialogTitle>
            <AlertDialogDescription>
              This will prevent the task from automatically generating new instances when completed.
              <br />
              <br />
              <strong>Task:</strong> {task.custom_task_name || task.task_type}
              <br />
              <strong>Current Frequency:</strong> {task.custom_task_recurring_frequency || task.recurring_frequency}
              <br />
              <br />
              This action cannot be undone. You'll need to recreate the task if you want it to recur again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleStopRecurring}
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting ? "Stopping..." : "Stop Recurring"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}
