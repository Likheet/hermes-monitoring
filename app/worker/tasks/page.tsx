"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ProtectedRoute } from "@/components/protected-route"
import { useAuth } from "@/lib/auth-context"
import { useTasks } from "@/lib/task-context"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Clock, CheckCircle2, XCircle, AlertCircle } from "lucide-react"
import { formatDistanceToNow } from "@/lib/date-utils"
import { cn } from "@/lib/utils"

function TasksPage() {
  console.log("[v0] Tasks page loaded")

  const router = useRouter()
  const { user } = useAuth()
  const { tasks } = useTasks()
  const [filter, setFilter] = useState<"all" | "active" | "completed" | "rejected">("all")

  // Get all tasks for current worker
  const myTasks = tasks.filter((task) => task.assigned_to_user_id === user?.id)

  // Filter tasks based on selected filter
  const filteredTasks = myTasks.filter((task) => {
    if (filter === "all") return true
    if (filter === "active")
      return task.status === "PENDING" || task.status === "IN_PROGRESS" || task.status === "PAUSED"
    if (filter === "completed") return task.status === "COMPLETED" || task.status === "VERIFIED"
    if (filter === "rejected") return task.status === "REJECTED"
    return true
  })

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "COMPLETED":
      case "VERIFIED":
        return <CheckCircle2 className="h-4 w-4" />
      case "REJECTED":
        return <XCircle className="h-4 w-4" />
      case "IN_PROGRESS":
        return <Clock className="h-4 w-4" />
      case "PAUSED":
        return <AlertCircle className="h-4 w-4" />
      default:
        return null
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETED":
      case "VERIFIED":
        return "bg-green-500/10 text-green-700 border-green-200"
      case "REJECTED":
        return "bg-red-500/10 text-red-700 border-red-200"
      case "IN_PROGRESS":
        return "bg-blue-500/10 text-blue-700 border-blue-200"
      case "PAUSED":
        return "bg-yellow-500/10 text-yellow-700 border-yellow-200"
      default:
        return "bg-gray-500/10 text-gray-700 border-gray-200"
    }
  }

  return (
    <div className="min-h-screen bg-muted/30 pb-20">
      <header className="border-b bg-background sticky top-0 z-10">
        <div className="container mx-auto flex items-center gap-4 px-4 py-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/worker")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">My Tasks</h1>
            <p className="text-sm text-muted-foreground">{myTasks.length} total tasks</p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="container mx-auto px-4 pb-3">
          <div className="flex gap-2 overflow-x-auto">
            {[
              { value: "all", label: "All" },
              { value: "active", label: "Active" },
              { value: "completed", label: "Completed" },
              { value: "rejected", label: "Rejected" },
            ].map((tab) => (
              <Button
                key={tab.value}
                variant={filter === tab.value ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(tab.value as any)}
                className="whitespace-nowrap"
              >
                {tab.label}
              </Button>
            ))}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-4">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No tasks found</p>
            <Button onClick={() => router.push("/worker")} className="mt-4">
              Back to Dashboard
            </Button>
          </div>
        ) : (
          filteredTasks.map((task) => (
            <Card
              key={task.id}
              className="p-4 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => router.push(`/worker/${task.id}`)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className={cn("gap-1", getStatusColor(task.status))}>
                      {getStatusIcon(task.status)}
                      {task.status.replace("_", " ")}
                    </Badge>
                    {task.priority_level === "GUEST_REQUEST" && (
                      <Badge variant="destructive" className="text-xs">
                        High Priority
                      </Badge>
                    )}
                  </div>

                  <h3 className="font-semibold text-lg mb-1">{task.task_type}</h3>
                  <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{task.description}</p>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Room {task.room_number}</span>
                    {task.assigned_at && (
                      <span>
                        Assigned {formatDistanceToNow(new Date(task.assigned_at.client), { addSuffix: true })}
                      </span>
                    )}
                  </div>

                  {task.rating && (
                    <div className="mt-2 flex items-center gap-1">
                      <span className="text-sm font-medium">Rating:</span>
                      <span className="text-yellow-600">{"★".repeat(task.rating)}</span>
                      <span className="text-gray-300">{"★".repeat(5 - task.rating)}</span>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </main>
    </div>
  )
}

export default function TasksPageWrapper() {
  return (
    <ProtectedRoute allowedRoles={["worker"]}>
      <TasksPage />
    </ProtectedRoute>
  )
}
