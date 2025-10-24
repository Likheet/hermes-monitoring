"use client"
import { useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ProtectedRoute } from "@/components/protected-route"
import { useAuth } from "@/lib/auth-context"
import { useTasks } from "@/lib/task-context"
import { createDualTimestamp } from "@/lib/mock-data"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { PriorityLevel, Priority, Department } from "@/lib/types"
import { TaskSearch } from "@/components/task-search"
import type { TaskDefinition, TaskCategory } from "@/lib/task-definitions"
import { TaskAssignmentForm, type TaskAssignmentData } from "@/components/task-assignment-form"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

function mapPriorityToPriorityLevel(priority: Priority, category: TaskCategory): PriorityLevel {
  if (category === "GUEST_REQUEST") return "GUEST_REQUEST"
  if (category === "TIME_SENSITIVE") return "TIME_SENSITIVE"
  if (category === "PREVENTIVE_MAINTENANCE") return "PREVENTIVE_MAINTENANCE"
  return "DAILY_TASK"
}

function CreateTaskForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const { createTask, tasks, users, usersLoaded, usersLoadError, shiftSchedules } = useTasks()
  const { toast } = useToast()

  const [selectedTaskDef, setSelectedTaskDef] = useState<TaskDefinition | null>(null)
  const [rejectedTask, setRejectedTask] = useState<any>(null)
  const hasLoadedRejectedTask = useRef(false)

  const workers = users.filter((u) => u.role === "worker" || u.role === "front_office")

  useEffect(() => {
    if (hasLoadedRejectedTask.current) return

    const rejectedTaskId = searchParams.get("rejectedTaskId")
    if (rejectedTaskId) {
      const task = tasks.find((t) => t.id === rejectedTaskId)
      if (task) {
        hasLoadedRejectedTask.current = true
        setRejectedTask(task)
        const taskDef: TaskDefinition = {
          id: task.task_type,
          name: task.task_type,
          category: task.custom_task_category || "ROOM_CLEANING",
          priority: task.custom_task_priority || "medium",
          department: task.department === "front_desk" ? "housekeeping" : task.department,
          duration: task.expected_duration_minutes,
          photoRequired: task.photo_required,
          photoCount: task.custom_task_photo_count || 1,
          photoDocumentationRequired: !!task.photo_documentation_required,
          photoCategories: task.photo_categories || undefined,
          keywords: [],
          requiresRoom: !!task.room_number,
          requiresACLocation: false,
          isRecurring: Boolean(task.custom_task_is_recurring),
          recurringFrequency: task.custom_task_recurring_frequency ?? undefined,
          requiresSpecificTime: Boolean(task.custom_task_requires_specific_time),
          recurringTime: task.custom_task_recurring_time ?? undefined,
        }
        setSelectedTaskDef(taskDef)
      }
    }
  }, [searchParams, tasks])

  const handleTaskSelect = (task: TaskDefinition) => {
    setSelectedTaskDef(task)
  }

  const handleCancel = () => {
    setSelectedTaskDef(null)
    setRejectedTask(null)
    hasLoadedRejectedTask.current = false
    router.push("/front-office/create-task")
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

    const priorityLevel = mapPriorityToPriorityLevel(data.priority, data.category)

    const trimmedCustomName = data.customTaskName?.trim()
    const isCustomTask = data.isCustomTask && !!trimmedCustomName
    const taskName = isCustomTask ? trimmedCustomName! : data.taskName

    const success = await createTask({
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
      photo_count: data.photoCount,
      photo_documentation_required: data.photoDocumentationRequired,
      photo_categories: data.photoDocumentationRequired ? data.photoCategories : null,
      worker_remark: data.remarks || "",
      supervisor_remark: "",
      rating: null,
      quality_comment: null,
      rating_proof_photo_url: null,
      rejection_proof_photo_url: null,
      room_number: data.location || "",
      is_custom_task: isCustomTask,
      custom_task_name: isCustomTask ? trimmedCustomName! : null,
      custom_task_category: isCustomTask ? data.category : null,
      custom_task_priority: isCustomTask ? data.priority : null,
      custom_task_photo_required: isCustomTask ? data.photoRequired : null,
      custom_task_photo_count: isCustomTask ? data.photoCount : null,
      custom_task_is_recurring: isCustomTask ? data.isRecurring : null,
      custom_task_recurring_frequency: isCustomTask ? data.recurringFrequency ?? null : null,
      custom_task_requires_specific_time: isCustomTask ? data.requiresSpecificTime ?? null : null,
      custom_task_recurring_time: isCustomTask ? data.recurringTime ?? null : null,
      is_recurring: data.isRecurring,
      recurring_frequency: data.recurringFrequency ?? null,
      requires_specific_time: data.requiresSpecificTime ?? false,
      recurring_time: data.recurringTime ?? null,
    })

    if (!success) {
      toast({
        title: "Failed to Assign Task",
        description: "The task could not be created. Please verify the assignee's availability and try again.",
        variant: "destructive",
      })
      return
    }

    const workerCurrentTask = tasks.find((t) => t.assigned_to_user_id === data.assignedTo && t.status === "IN_PROGRESS")

    if (priorityLevel === "GUEST_REQUEST" && workerCurrentTask) {
      toast({
        title: "Urgent Task Created",
        description: "Worker's current task has been auto-paused for this urgent request",
      })
    } else {
      toast({
        title: rejectedTask ? "Task Re-created" : "Task Created",
        description: rejectedTask
          ? "Task has been re-created and assigned successfully"
          : data.customTaskName
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
            <h1 className="text-xl font-bold">{rejectedTask ? "Re-create Rejected Task" : "Create New Task"}</h1>
            <p className="text-sm text-muted-foreground">
              {rejectedTask
                ? "Review the rejection reason and make necessary corrections"
                : "Search for a task type and assign it to a worker"}
            </p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl space-y-4">
        {rejectedTask && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Task was rejected by supervisor</AlertTitle>
            <AlertDescription className="mt-2">
              <strong>Rejection Reason:</strong> {rejectedTask.supervisor_remark || "No reason provided"}
            </AlertDescription>
          </Alert>
        )}

        {usersLoadError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Unable to load workers</AlertTitle>
            <AlertDescription className="mt-2">
              Check your internet connection or Supabase project, then refresh the page before assigning new
              tasks.
            </AlertDescription>
          </Alert>
        )}

        {!selectedTaskDef && !rejectedTask && (
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
            currentUser={user ?? null}
            workersLoaded={usersLoaded}
            workersLoadError={usersLoadError}
            shiftSchedules={shiftSchedules}
            initialData={
              rejectedTask
                ? {
                    assignedTo: rejectedTask.assigned_to_user_id,
                    location: rejectedTask.room_number,
                    remarks: rejectedTask.supervisor_remark || rejectedTask.worker_remark || "",
                  }
                : undefined
            }
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
