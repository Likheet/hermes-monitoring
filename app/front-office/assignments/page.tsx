"use client"

import { ProtectedRoute } from "@/components/protected-route"
import { useAuth } from "@/lib/auth-context"
import { useTasks } from "@/lib/task-context"
import { mockUsers } from "@/lib/mock-data"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Clock, MapPin, User, CalendarClock, Edit, Edit2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { formatFullTimestamp } from "@/lib/date-utils"
import { ReassignTaskModal } from "@/components/reassign-task-modal"
import { EditTaskModal } from "@/components/edit-task-modal"
import { useState } from "react"
import type { Task } from "@/lib/types"

const priorityColors = {
  GUEST_REQUEST: "bg-red-500 text-white",
  TIME_SENSITIVE: "bg-orange-500 text-white",
  DAILY_TASK: "bg-blue-500 text-white",
  PREVENTIVE_MAINTENANCE: "bg-green-500 text-white",
}

const statusColors = {
  PENDING: "bg-yellow-500",
  IN_PROGRESS: "bg-blue-500",
  PAUSED: "bg-orange-500",
  COMPLETED: "bg-green-500",
  REJECTED: "bg-red-500",
}

function AssignmentsHistory() {
  const { user } = useAuth()
  const { tasks } = useTasks()
  const router = useRouter()
  const [reassignTask, setReassignTask] = useState<Task | null>(null)
  const [editTask, setEditTask] = useState<Task | null>(null)

  const myAssignments = tasks
    .filter((t) => t.assigned_by_user_id === user?.id)
    .sort((a, b) => {
      const dateA = new Date(a.assigned_at.client).getTime()
      const dateB = new Date(b.assigned_at.client).getTime()
      return dateB - dateA // Most recent first
    })

  const getWorkerName = (workerId: string) => {
    const worker = mockUsers.find((u) => u.id === workerId)
    return worker?.name || "Unknown"
  }

  const stats = {
    total: myAssignments.length,
    pending: myAssignments.filter((t) => t.status === "PENDING").length,
    inProgress: myAssignments.filter((t) => t.status === "IN_PROGRESS" || t.status === "PAUSED").length,
    completed: myAssignments.filter((t) => t.status === "COMPLETED").length,
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="container mx-auto flex items-center gap-4 px-4 py-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/front-office")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">My Assignments</h1>
            <p className="text-sm text-muted-foreground">Tasks you have assigned</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Assigned</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">In Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
            </CardContent>
          </Card>
        </div>

        {/* Assignments List */}
        <Card>
          <CardHeader>
            <CardTitle>Assignment History</CardTitle>
          </CardHeader>
          <CardContent>
            {myAssignments.length > 0 ? (
              <div className="space-y-3">
                {myAssignments.map((task) => {
                  const isOtherTask = task.task_type === "Other (Custom Task)" || task.custom_task_name

                  return (
                    <div
                      key={task.id}
                      className="flex items-start justify-between gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold">{task.custom_task_name || task.task_type}</h3>
                          <Badge className={`${priorityColors[task.priority_level]} text-xs`} variant="secondary">
                            {task.priority_level.replace(/_/g, " ")}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            <span>{task.room_number}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            <span>{getWorkerName(task.assigned_to_user_id)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            <span>{task.expected_duration_minutes} min</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CalendarClock className="h-4 w-4" />
                            <span>{formatFullTimestamp(task.assigned_at)}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className={`h-2 w-2 rounded-full ${statusColors[task.status]}`} />
                          <span className="text-sm font-medium">{task.status.replace(/_/g, " ")}</span>
                        </div>
                      </div>
                      {task.status === "PENDING" && (
                        <div className="flex gap-2 shrink-0">
                          {isOtherTask && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditTask(task)}
                              className="min-h-[44px]"
                            >
                              <Edit2 className="h-4 w-4 mr-2" />
                              Edit
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setReassignTask(task)}
                            className="min-h-[44px]"
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Re-assign
                          </Button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex min-h-[200px] items-center justify-center">
                <p className="text-muted-foreground">No assignments yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {reassignTask && (
        <ReassignTaskModal task={reassignTask} open={!!reassignTask} onOpenChange={() => setReassignTask(null)} />
      )}

      {editTask && <EditTaskModal task={editTask} open={!!editTask} onOpenChange={() => setEditTask(null)} />}
    </div>
  )
}

export default function AssignmentsPage() {
  return (
    <ProtectedRoute allowedRoles={["front_office"]}>
      <AssignmentsHistory />
    </ProtectedRoute>
  )
}
