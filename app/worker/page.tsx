"use client"

import { ProtectedRoute } from "@/components/protected-route"
import { useAuth } from "@/lib/auth-context"
import { useTasks } from "@/lib/task-context"
import { TaskCard } from "@/components/task-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LogOut, Bell, AlertCircle, X, User } from "lucide-react"
import { useRouter } from "next/navigation"
import { useRealtimeTasks } from "@/lib/use-realtime-tasks"
import { ConnectionStatus } from "@/components/connection-status"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useEffect, useState } from "react"
import { BottomNav } from "@/components/mobile/bottom-nav"

function WorkerDashboard() {
  const { user, logout } = useAuth()
  const { tasks, dismissRejectedTask } = useTasks()
  const router = useRouter()
  const { isConnected } = useRealtimeTasks({
    enabled: true,
    filter: { userId: user?.id },
  })
  const [urgentTaskAlert, setUrgentTaskAlert] = useState<string | null>(null)

  useEffect(() => {
    console.log("[v0] Worker dashboard loaded for user:", user?.id, user?.name)
  }, [user])

  const myTasks = tasks.filter((task) => task.assigned_to_user_id === user?.id)
  const pendingTasks = myTasks.filter((t) => t.status === "PENDING")
  const inProgressTasks = myTasks.filter((t) => t.status === "IN_PROGRESS" || t.status === "PAUSED")
  const completedTasks = myTasks.filter((t) => t.status === "COMPLETED")
  const rejectedTasks = myTasks.filter((t) => t.status === "REJECTED")

  useEffect(() => {
    const urgentTask = pendingTasks.find((t) => t.priority_level === "GUEST_REQUEST")
    if (urgentTask) {
      setUrgentTaskAlert(urgentTask.id)
      setTimeout(() => setUrgentTaskAlert(null), 10000)
    }
  }, [pendingTasks])

  const handleLogout = () => {
    logout()
    router.push("/login")
  }

  const handleDismissRejection = (taskId: string) => {
    if (user) {
      dismissRejectedTask(taskId, user.id)
    }
  }

  return (
    <div className="min-h-screen bg-muted/30 pb-20 md:pb-0">
      <header className="border-b bg-background sticky top-0 z-40">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold">My Tasks</h1>
            <p className="text-xs md:text-sm text-muted-foreground">
              {user?.name} - {user?.department}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ConnectionStatus isConnected={isConnected} />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                console.log("[v0] Profile button clicked, navigating to /worker/profile")
                router.push("/worker/profile")
              }}
              className="hidden md:flex min-h-[44px] min-w-[44px] bg-transparent"
            >
              <User className="h-5 w-5 md:mr-2" />
              <span className="hidden md:inline">Profile</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="min-h-[44px] min-w-[44px] bg-transparent"
            >
              <LogOut className="h-5 w-5 md:mr-2" />
              <span className="hidden md:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {urgentTaskAlert && (
          <Alert className="border-red-500 bg-red-50">
            <Bell className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-900">
              <strong>Urgent Guest Request!</strong> A new high-priority task has been assigned to you.
            </AlertDescription>
          </Alert>
        )}

        {rejectedTasks.length > 0 && (
          <section>
            <h2 className="text-base md:text-lg font-semibold mb-3 text-red-600">Rejected Tasks</h2>
            <div className="space-y-4">
              {rejectedTasks.map((task) => (
                <Card key={task.id} className="border-red-200 bg-red-50">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 flex-1">
                        <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                        <CardTitle className="text-lg">{task.task_type}</CardTitle>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDismissRejection(task.id)}
                        className="h-8 w-8 text-red-600 hover:bg-red-100"
                        title="Dismiss rejection"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm font-medium text-red-900">
                      <strong>Rejection Reason:</strong> {task.supervisor_remark || "No reason provided"}
                    </p>
                    {task.rejection_proof_photo_url && (
                      <div className="mt-2">
                        <p className="text-sm font-medium text-red-900 mb-2">Proof Photo:</p>
                        <img
                          src={task.rejection_proof_photo_url || "/placeholder.svg"}
                          alt="Rejection proof"
                          className="w-full max-w-sm rounded-lg border-2 border-red-300"
                        />
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">Room: {task.room_number}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {inProgressTasks.length > 0 && (
          <section>
            <h2 className="text-base md:text-lg font-semibold mb-3">In Progress</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {inProgressTasks.map((task) => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>
          </section>
        )}

        {pendingTasks.length > 0 && (
          <section>
            <h2 className="text-base md:text-lg font-semibold mb-3">Pending Tasks</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {pendingTasks.map((task) => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>
          </section>
        )}

        {completedTasks.length > 0 && (
          <section>
            <h2 className="text-base md:text-lg font-semibold mb-3">Completed</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {completedTasks.map((task) => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>
          </section>
        )}

        {myTasks.length === 0 && (
          <div className="flex min-h-[400px] items-center justify-center">
            <p className="text-muted-foreground">No tasks assigned</p>
          </div>
        )}
      </main>

      <div className="md:hidden">
        <BottomNav />
      </div>
    </div>
  )
}

export default function WorkerPage() {
  return (
    <ProtectedRoute allowedRoles={["worker"]}>
      <WorkerDashboard />
    </ProtectedRoute>
  )
}
