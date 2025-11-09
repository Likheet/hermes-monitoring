"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { ProtectedRoute } from "@/components/protected-route"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TaskSearch } from "@/components/task-search"
import { TaskAssignmentForm, type TaskAssignmentData } from "@/components/task-assignment-form"
import { useAuth } from "@/lib/auth-context"
import { useTasks } from "@/lib/task-context"
import { useToast } from "@/hooks/use-toast"
import { createDualTimestamp } from "@/lib/mock-data"
import type { Department, Priority, PriorityLevel } from "@/lib/types"
import type { TaskCategory, TaskDefinition } from "@/lib/task-definitions"

function mapPriorityToPriorityLevel(priority: Priority, category: TaskCategory): PriorityLevel {
  if (category === "GUEST_REQUEST") return "GUEST_REQUEST"
  if (category === "TIME_SENSITIVE") return "TIME_SENSITIVE"
  if (category === "PREVENTIVE_MAINTENANCE") return "PREVENTIVE_MAINTENANCE"
  return "DAILY_TASK"
}

function ManagerCreateTaskForm() {
  const router = useRouter()
  const { user } = useAuth()
  const { createTask, tasks, users, usersLoaded, usersLoadError, shiftSchedules } = useTasks()
  const { toast } = useToast()

  const [selectedTaskDef, setSelectedTaskDef] = useState<TaskDefinition | null>(null)

  const assignableStaff = useMemo(() => {
    const base = users.filter((member) => member.role !== "admin")

    if (user && !base.some((member) => member.id === user.id)) {
      base.push(user)
    }

    return base.sort((a, b) => a.name.localeCompare(b.name))
  }, [users, user])

  const handleTaskSelect = (task: TaskDefinition) => {
    setSelectedTaskDef(task)
  }

  const handleCancel = () => {
    setSelectedTaskDef(null)
    router.push("/manager/create-task")
  }

  const handleSubmit = async (data: TaskAssignmentData) => {
    if (!user) {
      toast({
        title: "Unable to assign",
        description: "You must be signed in to create a task.",
        variant: "destructive",
      })
      return
    }

    const priorityLevel = mapPriorityToPriorityLevel(data.priority, data.category)
    const trimmedCustomName = data.customTaskName?.trim() ?? ""
    const isCustomTask = data.isCustomTask
    const taskName = isCustomTask ? (trimmedCustomName || data.taskName) : data.taskName

    if (isCustomTask && !taskName.trim()) {
      toast({
        title: "Task name required",
        description: "Provide a name for the custom task before assigning it.",
        variant: "destructive",
      })
      return
    }

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
      custom_task_name: isCustomTask ? taskName : null,
      custom_task_category: isCustomTask ? data.category : null,
      custom_task_priority: isCustomTask ? data.priority : null,
      custom_task_photo_required: isCustomTask ? data.photoRequired : null,
      custom_task_photo_count: isCustomTask ? data.photoCount : null,
      custom_task_is_recurring: isCustomTask ? data.isRecurring : null,
      custom_task_recurring_frequency: isCustomTask ? data.recurringFrequency ?? null : null,
      custom_task_requires_specific_time: isCustomTask
        ? data.requiresSpecificTime ?? false
        : null,
      custom_task_recurring_time:
        isCustomTask && data.requiresSpecificTime ? data.recurringTime ?? null : null,
      custom_task_recurring_days: isCustomTask
        ? data.recurringCustomDays?.map((day) => day) ?? null
        : null,
      is_recurring: data.isRecurring,
      recurring_frequency: data.recurringFrequency ?? null,
      requires_specific_time: data.requiresSpecificTime ?? false,
      recurring_time: data.recurringTime ?? null,
    })

    if (!success) {
      toast({
        title: "Task not created",
        description: "We could not create the task. Double-check the assignee and try again.",
        variant: "destructive",
      })
      return
    }

    toast({
      title: "Task ready",
      description: "Your task is live and visible to the assigned staff member.",
    })

    router.push("/manager")
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => router.push("/manager")}
              className="inline-flex h-11 w-11 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:h-4 [&_svg:not([class*='size-'])]:w-4 [&_svg]:shrink-0 focus-visible:outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px] active:scale-[0.98] hover:bg-accent hover:text-accent-foreground active:bg-accent/80 min-h-[44px]"
              aria-label="Back to manager dashboard"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="sr-only">Back</span>
            </button>
            <div>
              <h1 className="text-xl font-bold">Create a Task</h1>
              <p className="text-sm text-muted-foreground">
                Assign work to any staff member — including yourself — in just a few steps.
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-4xl space-y-4 px-4 py-6">
        {!selectedTaskDef && (
          <Card>
            <CardHeader>
              <CardTitle>Choose a task template</CardTitle>
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
            workers={assignableStaff}
            currentUser={user ?? null}
            workersLoaded={usersLoaded}
            workersLoadError={usersLoadError}
            shiftSchedules={shiftSchedules}
            currentTasks={tasks}
          />
        )}
      </main>
    </div>
  )
}

export default function ManagerCreateTaskPage() {
  return (
    <ProtectedRoute allowedRoles={["manager", "admin"]}>
      <ManagerCreateTaskForm />
    </ProtectedRoute>
  )
}
