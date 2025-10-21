"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ProtectedRoute } from "@/components/protected-route"
import { useAuth } from "@/lib/auth-context"
import { useTasks } from "@/lib/task-context"
import { HandoverForm } from "@/components/shift/handover-form"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

function HandoverPage() {

  const router = useRouter()
  const { user } = useAuth()
  const { tasks } = useTasks()
  const { toast } = useToast()
  const [submittedTasks, setSubmittedTasks] = useState<Set<string>>(new Set())

  // Get active tasks for current worker
  const activeTasks = tasks.filter(
    (task) =>
      task.assigned_to_user_id === user?.id &&
      (task.status === "IN_PROGRESS" || task.status === "PAUSED" || task.status === "PENDING"),
  )

  const pendingHandovers = activeTasks.filter((task) => !submittedTasks.has(task.id))

  const handleHandoverSubmit = (
    taskId: string,
    data: {
      statusUpdate: string
      priorityChanged: boolean
      handoverNotes: string
    },
  ) => {
    // In real implementation, this would call an API to save handover

    setSubmittedTasks((prev) => new Set(prev).add(taskId))

    toast({
      title: "Handover Submitted",
      description: "Task handover information has been recorded",
    })

    // If all handovers are done, redirect to worker dashboard
    if (pendingHandovers.length === 1) {
      setTimeout(() => {
        router.push("/worker")
      }, 1000)
    }
  }

  if (activeTasks.length === 0) {
    return (
      <div className="min-h-screen bg-muted/30">
        <header className="border-b bg-background">
          <div className="container mx-auto flex items-center gap-4 px-4 py-4">
            <Button variant="ghost" size="icon" onClick={() => router.push("/worker")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">Shift Handover</h1>
          </div>
        </header>
        <main className="container mx-auto px-4 py-6 max-w-2xl">
          <div className="text-center py-12">
            <p className="text-muted-foreground">No active tasks to handover</p>
            <Button onClick={() => router.push("/worker")} className="mt-4">
              Back to Dashboard
            </Button>
          </div>
        </main>
      </div>
    )
  }

  if (pendingHandovers.length === 0) {
    return (
      <div className="min-h-screen bg-muted/30">
        <header className="border-b bg-background">
          <div className="container mx-auto flex items-center gap-4 px-4 py-4">
            <Button variant="ghost" size="icon" onClick={() => router.push("/worker")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">Shift Handover</h1>
          </div>
        </header>
        <main className="container mx-auto px-4 py-6 max-w-2xl">
          <div className="text-center py-12">
            <p className="text-lg font-medium text-green-600">All handovers completed!</p>
            <p className="text-muted-foreground mt-2">You can now end your shift</p>
            <Button onClick={() => router.push("/worker")} className="mt-4">
              Back to Dashboard
            </Button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="container mx-auto flex items-center gap-4 px-4 py-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/worker")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Shift Handover</h1>
            <p className="text-sm text-muted-foreground">
              {pendingHandovers.length} task{pendingHandovers.length !== 1 ? "s" : ""} pending
            </p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl space-y-6">
        {pendingHandovers.map((task) => (
          <HandoverForm key={task.id} task={task} onSubmit={(data) => handleHandoverSubmit(task.id, data)} />
        ))}
      </main>
    </div>
  )
}

export default function HandoverPageWrapper() {
  return (
    <ProtectedRoute allowedRoles={["worker", "front_office"]}>
      <HandoverPage />
    </ProtectedRoute>
  )
}
