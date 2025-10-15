"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { AlertCircle } from "lucide-react"
import type { Task } from "@/lib/types"

interface HandoverFormProps {
  task: Task
  onSubmit: (data: {
    statusUpdate: string
    priorityChanged: boolean
    handoverNotes: string
  }) => void
}

export function HandoverForm({ task, onSubmit }: HandoverFormProps) {
  const [statusUpdate, setStatusUpdate] = useState("")
  const [priorityChanged, setPriorityChanged] = useState(false)
  const [handoverNotes, setHandoverNotes] = useState("")

  const handleSubmit = () => {
    if (!statusUpdate.trim()) {
      return
    }
    onSubmit({
      statusUpdate,
      priorityChanged,
      handoverNotes,
    })
  }

  const priorityColors = {
    GUEST_REQUEST: "bg-red-500 text-white",
    TIME_SENSITIVE: "bg-orange-500 text-white",
    DAILY_TASK: "bg-blue-500 text-white",
    PREVENTIVE_MAINTENANCE: "bg-green-500 text-white",
  }

  return (
    <Card className="border-orange-500">
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-orange-500" />
          <CardTitle>Shift Handover Required</CardTitle>
        </div>
        <CardDescription>Your shift is ending soon. Please provide handover information for this task.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium">{task.task_type}</span>
            <Badge className={priorityColors[task.priority_level]} variant="secondary">
              {task.priority_level.replace(/_/g, " ")}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">Room {task.room_number}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="status-update" className="text-red-500">
            Status Update *
          </Label>
          <Textarea
            id="status-update"
            placeholder="What's the current status of this task?"
            value={statusUpdate}
            onChange={(e) => setStatusUpdate(e.target.value)}
            rows={3}
            required
          />
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="priority-changed"
            checked={priorityChanged}
            onCheckedChange={(checked) => setPriorityChanged(checked as boolean)}
          />
          <Label htmlFor="priority-changed" className="text-sm font-normal cursor-pointer">
            Priority level should be changed
          </Label>
        </div>

        <div className="space-y-2">
          <Label htmlFor="handover-notes">Additional Notes</Label>
          <Textarea
            id="handover-notes"
            placeholder="Any additional information for the next shift..."
            value={handoverNotes}
            onChange={(e) => setHandoverNotes(e.target.value)}
            rows={3}
          />
        </div>

        <Button onClick={handleSubmit} className="w-full" disabled={!statusUpdate.trim()}>
          Submit Handover
        </Button>
      </CardContent>
    </Card>
  )
}
