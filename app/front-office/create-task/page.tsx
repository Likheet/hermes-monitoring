"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { ProtectedRoute } from "@/components/protected-route"
import { useAuth } from "@/lib/auth-context"
import { useTasks } from "@/lib/task-context"
import { createDualTimestamp } from "@/lib/mock-data"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { PriorityLevel, Priority, Department } from "@/lib/types"
import { TaskSearch } from "@/components/task-search"
import type { TaskDefinition } from "@/lib/task-definitions"
import { TaskAssignmentForm, type TaskAssignmentData } from "@/components/task-assignment-form"

function mapPriorityToPriorityLevel(priority: Priority, category: string): PriorityLevel {
  if (category === "GUEST_REQUEST") return "GUEST_REQUEST"
  if (category === "TIME_SENSITIVE") return "TIME_SENSITIVE"
  if (category === "PREVENTIVE_MAINTENANCE") return "PREVENTIVE_MAINTENANCE"
  return "DAILY_TASK"
}

function CreateTaskForm() {
  const router = useRouter()
  const { user } = useAuth()
  const { createTask, tasks, users } = useTasks()
  const { toast } = useToast()

  const [selectedTaskDef, setSelectedTaskDef] = useState<TaskDefinition | null>(null)

  const workers = users.filter((u) => u.role === "worker")

  const handleTaskSelect = (task: TaskDefinition) => {
    setSelectedTaskDef(task)
  }

  const handleCancel = () => {
    setSelectedTaskDef(null)
  }

  const handleSubmit = async (data: TaskAssignmentData) => {
    if (!user) {
      toast({
        title: "Error",
        description: "User not authenticated",
        variant: "destructive",
      })
      return
    }

    const priorityLevel = mapPriorityToPriorityLevel(data.priority as Priority, data.category)

    const taskName = data.customTaskName || data.taskName

    createTask({
      task_type: taskName,
      priority_level: priorityLevel,
      status: "PENDING",
      department: data.department as Department,
      assigned_to_user_id: data.assignedTo,
      assigned_by_user_id: user.id,
      assigned_at: createDualTimestamp(),
      started_at: null,
      completed_at: null,
      expected_duration_minutes: data.duration,
      actual_duration_minutes: null,
      photo_urls: [],
      categorized_photos: null,
      photo_required: data.photoRequired,
      worker_remark: data.additionalDetails || "",
      supervisor_remark: "",
      rating: null,
      quality_comment: null,
      rating_proof_photo_url: null,
      rejection_proof_photo_url: null,
      room_number: data.location || "",
    })

    if (data.customTaskName) {
      // This will be handled in the task context
      console.log("[v0] Custom task created, admin will be notified:", data.customTaskName)
    }

    const workerCurrentTask = tasks.find((t) => t.assigned_to_user_id === data.assignedTo && t.status === "IN_PROGRESS")

    if (priorityLevel === "GUEST_REQUEST" && workerCurrentTask) {
      toast({
        title: "Urgent Task Created",
        description: "Worker's current task has been auto-paused for this urgent request",
      })
    } else {
      toast({
        title: "Task Created",
        description: data.customTaskName
          ? "Custom task created and admin has been notified"
          : "Task has been assigned successfully",
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
            <p className="text-sm text-muted-foreground">Search for a task type and assign it to a worker</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl">
        {!selectedTaskDef && (
          <Card>
            <CardHeader>
              <CardTitle>Search for Task</CardTitle>
            </CardHeader>
            <CardContent>
              <TaskSearch onSelectTask={handleTaskSelect} />
            </CardContent>
          </Card>
        )}

        {selectedTaskDef && (
          <TaskAssignmentForm
            task={selectedTaskDef}
            onCancel={handleCancel}
            onSubmit={handleSubmit}
            workers={workers}
          />
        )}
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
