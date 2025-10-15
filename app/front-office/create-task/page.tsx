"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ProtectedRoute } from "@/components/protected-route"
import { useAuth } from "@/lib/auth-context"
import { useTasks } from "@/lib/task-context"
import { createDualTimestamp } from "@/lib/mock-data"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { ArrowLeft, AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { PriorityLevel } from "@/lib/types"
import { ShiftBadge } from "@/components/shift/shift-badge"
import { getWorkersWithShiftStatusFromUsers, canAssignTaskToUser } from "@/lib/shift-utils"
import { Alert, AlertDescription } from "@/components/ui/alert"

function CreateTaskForm() {
  const router = useRouter()
  const { user } = useAuth()
  const { createTask, tasks, users } = useTasks()
  const { toast } = useToast()

  const [taskType, setTaskType] = useState("")
  const [roomNumber, setRoomNumber] = useState("")
  const [priority, setPriority] = useState<PriorityLevel>("DAILY_TASK")
  const [assignedTo, setAssignedTo] = useState("")
  const [expectedDuration, setExpectedDuration] = useState("30")
  const [photoRequired, setPhotoRequired] = useState(false)

  const workers = users.filter((u) => u.role === "worker")

  const workersWithShifts = getWorkersWithShiftStatusFromUsers(workers)

  const sortedWorkers = [...workersWithShifts].sort((a, b) => {
    const statusOrder = { ON_SHIFT: 0, ENDING_SOON: 1, OFF_DUTY: 2 }
    return statusOrder[a.availability.status] - statusOrder[b.availability.status]
  })

  const selectedWorker = workersWithShifts.find((w) => w.id === assignedTo)
  const assignmentValidation = selectedWorker
    ? canAssignTaskToUser(selectedWorker, Number.parseInt(expectedDuration))
    : { canAssign: true }

  console.log(
    "[v0] Workers with shift status:",
    workersWithShifts.map((w) => ({
      name: w.name,
      shift: `${w.shift_start} - ${w.shift_end}`,
      status: w.availability.status,
    })),
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!taskType || !roomNumber || !assignedTo || !user) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    if (!assignmentValidation.canAssign) {
      toast({
        title: "Cannot Assign Task",
        description: assignmentValidation.reason,
        variant: "destructive",
      })
      return
    }

    createTask({
      task_type: taskType,
      priority_level: priority,
      status: "PENDING",
      assigned_to_user_id: assignedTo,
      assigned_by_user_id: user.id,
      assigned_at: createDualTimestamp(),
      started_at: null,
      completed_at: null,
      expected_duration_minutes: Number.parseInt(expectedDuration),
      actual_duration_minutes: null,
      photo_url: null,
      photo_required: photoRequired,
      worker_remark: "",
      supervisor_remark: "",
      room_number: roomNumber,
    })

    const workerCurrentTask = tasks.find((t) => t.assigned_to_user_id === assignedTo && t.status === "IN_PROGRESS")

    if (priority === "GUEST_REQUEST" && workerCurrentTask) {
      toast({
        title: "Urgent Task Created",
        description: "Worker's current task has been auto-paused for this urgent request",
      })
    } else {
      toast({
        title: "Task Created",
        description: "Task has been assigned successfully",
      })
    }

    router.push("/front-office")
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="container mx-auto flex items-center gap-4 px-4 py-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/front-office")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Create New Task</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Task Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="task-type">Task Type</Label>
                <Input
                  id="task-type"
                  placeholder="e.g., Clean Room, Fix AC, Replace Towels"
                  value={taskType}
                  onChange={(e) => setTaskType(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="room-number">Room Number</Label>
                <Input
                  id="room-number"
                  placeholder="e.g., 101, POOL, LOBBY"
                  value={roomNumber}
                  onChange={(e) => setRoomNumber(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Priority Level</Label>
                <Select value={priority} onValueChange={(value) => setPriority(value as PriorityLevel)}>
                  <SelectTrigger id="priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GUEST_REQUEST">Guest Request (Urgent)</SelectItem>
                    <SelectItem value="TIME_SENSITIVE">Time Sensitive</SelectItem>
                    <SelectItem value="DAILY_TASK">Daily Task</SelectItem>
                    <SelectItem value="PREVENTIVE_MAINTENANCE">Preventive Maintenance</SelectItem>
                  </SelectContent>
                </Select>
                {priority === "GUEST_REQUEST" && (
                  <p className="text-sm text-orange-600">
                    Note: This will auto-pause any current task the worker is doing
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="assigned-to">Assign To</Label>
                <Select value={assignedTo} onValueChange={setAssignedTo}>
                  <SelectTrigger id="assigned-to">
                    <SelectValue placeholder="Select a worker" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedWorkers.map((worker) => (
                      <SelectItem key={worker.id} value={worker.id}>
                        <div className="flex items-center justify-between w-full gap-2">
                          <span>
                            {worker.name} - {worker.department}
                          </span>
                          <ShiftBadge availability={worker.availability} />
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedWorker && selectedWorker.availability.status === "OFF_DUTY" && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    This worker is currently off duty. Task assignment is not allowed.
                  </AlertDescription>
                </Alert>
              )}

              {selectedWorker && selectedWorker.availability.status === "ENDING_SOON" && (
                <Alert className="border-orange-500 bg-orange-50">
                  <AlertCircle className="h-4 w-4 text-orange-500" />
                  <AlertDescription className="text-orange-700">
                    Worker's shift ends in {selectedWorker.availability.minutesUntilEnd} minutes. Ensure task duration
                    fits within remaining shift time.
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="duration">Expected Duration (minutes)</Label>
                <Input
                  id="duration"
                  type="number"
                  min="5"
                  step="5"
                  value={expectedDuration}
                  onChange={(e) => setExpectedDuration(e.target.value)}
                  required
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="photo-required">Photo Required</Label>
                  <p className="text-sm text-muted-foreground">Worker must take a photo upon completion</p>
                </div>
                <Switch id="photo-required" checked={photoRequired} onCheckedChange={setPhotoRequired} />
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/front-office")}
                  className="flex-1 bg-transparent"
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={!assignmentValidation.canAssign}>
                  Create Task
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

export default function CreateTaskPage() {
  return (
    <ProtectedRoute allowedRoles={["front_office"]}>
      <CreateTaskForm />
    </ProtectedRoute>
  )
}
