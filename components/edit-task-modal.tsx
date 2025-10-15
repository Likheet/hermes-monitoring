"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTasks } from "@/lib/task-context"
import type { Task, PriorityLevel } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"

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

  const isOtherTask = task.task_type === "Other (Custom Task)" || task.custom_task_name

  const handleSave = () => {
    if (!isOtherTask) {
      toast({
        title: "Cannot Edit",
        description: "Only custom 'Other' tasks can be edited",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    updateTask(task.id, {
      priority_level: priorityLevel,
      photo_required: photoRequired,
    })

    toast({
      title: "Task Updated",
      description: "Task details have been updated successfully",
    })

    setIsSubmitting(false)
    onOpenChange(false)
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
    </Dialog>
  )
}
