"use client"

import { useState, useEffect } from "react"
import { ProtectedRoute } from "@/components/protected-route"
import { useAuth } from "@/lib/auth-context"
import { useTasks } from "@/lib/task-context"
import { TaskFilters } from "@/components/task-filters"
import { EscalationBadge } from "@/components/escalation/escalation-badge"
import { EscalationNotification } from "@/components/escalation/escalation-notification"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LogOut, Clock, MapPin, User, BarChart3, AlertTriangle } from "lucide-react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { IssueCard } from "@/components/issue-card"
import type { TaskStatus } from "@/lib/types"
import { useRealtimeTasks } from "@/lib/use-realtime-tasks"
import { ConnectionStatus } from "@/components/connection-status"
import { detectEscalationLevel, type Escalation } from "@/lib/escalation-utils"
import { createDualTimestamp } from "@/lib/mock-data"
import { TASK_TYPE_LABELS } from "@/lib/maintenance-types"
import { formatDistanceToNow } from "date-fns"

function SupervisorDashboard() {
  const { user, logout } = useAuth()
  const { tasks, issues, users, maintenanceTasks } = useTasks()
  const router = useRouter()
  const { isConnected } = useRealtimeTasks({
    enabled: true,
    filter: { department: user?.department },
  })

  const [statusFilter, setStatusFilter] = useState<TaskStatus | "ALL">("ALL")
  const [workerFilter, setWorkerFilter] = useState("ALL")
  const [escalations, setEscalations] = useState<Escalation[]>([])

  useEffect(() => {
    const interval = setInterval(() => {
      const newEscalations: Escalation[] = []

      tasks.forEach((task) => {
        if (task.status === "IN_PROGRESS" && task.started_at) {
          const level = detectEscalationLevel(
            task.started_at.client,
            task.expected_duration_minutes,
            task.pause_history,
          )

          if (level) {
            // Check if escalation already exists
            const existingEscalation = escalations.find((esc) => esc.task_id === task.id && esc.level === level)

            if (!existingEscalation) {
              newEscalations.push({
                id: `esc_${task.id}_${level}_${Date.now()}`,
                task_id: task.id,
                worker_id: task.assigned_to_user_id,
                level,
                timestamp: createDualTimestamp(),
                resolved: false,
              })
            }
          }
        }
      })

      if (newEscalations.length > 0) {
        setEscalations((prev) => [...prev, ...newEscalations])
      }
    }, 30000) // Check every 30 seconds

    return () => clearInterval(interval)
  }, [tasks, escalations])

  const handleLogout = () => {
    logout()
    router.push("/login")
  }

  const handleAcknowledgeEscalation = (escalationId: string) => {
    setEscalations((prev) =>
      prev.map((esc) =>
        esc.id === escalationId
          ? {
              ...esc,
              acknowledged_by: user?.id,
              acknowledged_at: new Date().toISOString(),
            }
          : esc,
      ),
    )
  }

  const departmentWorkers = users.filter((u) => u.role === "worker" && u.department === user?.department)

  const departmentTasks = tasks.filter((task) => {
    const worker = users.find((u) => u.id === task.assigned_to_user_id)
    const taskDepartment = task.department || worker?.department
    if (!user?.department) return true
    return taskDepartment === user.department
  })

  const filteredTasks = departmentTasks.filter((task) => {
    const statusMatch = statusFilter === "ALL" || task.status === statusFilter
    const workerMatch = workerFilter === "ALL" || task.assigned_to_user_id === workerFilter
    return statusMatch && workerMatch
  })

  const completedTasks = filteredTasks.filter((t) => {
    const isCompleted = t.status === "COMPLETED" && !t.supervisor_remark
    if (t.status === "COMPLETED") {
      console.log("[v0] Completed task found:", {
        id: t.id,
        taskType: t.task_type,
        hasRemark: !!t.supervisor_remark,
        willShowInVerification: isCompleted,
      })
    }
    return isCompleted
  })
  const otherTasks = filteredTasks.filter((t) => !(t.status === "COMPLETED" && !t.supervisor_remark))

  console.log("[v0] Supervisor dashboard - Completed tasks pending verification:", completedTasks.length)
  console.log("[v0] Supervisor dashboard - Other tasks:", otherTasks.length)
  console.log("[v0] Supervisor dashboard - Total filtered tasks:", filteredTasks.length)

  const isMaintenanceSupervisor = user?.department?.toLowerCase() === "maintenance"

  const departmentMaintenanceTasks =
    isMaintenanceSupervisor
      ? (maintenanceTasks || []).filter((task) => {
          if (!task.assigned_to) return true
          const assignedWorker = users.find((u) => u.id === task.assigned_to)
          if (!assignedWorker) return true
          return assignedWorker.department === "maintenance"
        })
      : []

  const completedMaintenanceTasks = departmentMaintenanceTasks.filter((task) => task.status === "completed")
  const activeMaintenanceTasks = departmentMaintenanceTasks.filter((task) =>
    task.status === "in_progress" || task.status === "paused",
  )
  const pendingMaintenanceTasks = departmentMaintenanceTasks.filter((task) => task.status === "pending")

  const getTaskEscalation = (taskId: string): 1 | 2 | 3 | null => {
    const taskEscalations = escalations.filter((esc) => esc.task_id === taskId && !esc.resolved)
    if (taskEscalations.length === 0) return null
    return Math.max(...taskEscalations.map((esc) => esc.level)) as 1 | 2 | 3
  }

  const getWorkerName = (userId: string) => {
    return users.find((u) => u.id === userId)?.name || "Unknown"
  }

  const getMaintenanceWorkerName = (userId?: string) => {
    if (!userId) return "Unassigned"
    return users.find((u) => u.id === userId)?.name || "Unknown"
  }

  const getMaintenanceTaskLabel = (taskType: string) =>
    TASK_TYPE_LABELS[taskType as keyof typeof TASK_TYPE_LABELS] || taskType.replace(/_/g, " ")

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

  const openIssues = issues.filter((issue) => {
    const task = tasks.find((t) => t.id === issue.task_id)
    if (!task) return false
    const worker = users.find((u) => u.id === task.assigned_to_user_id)
    return worker?.department === user?.department && issue.status === "OPEN"
  })

  return (
    <div className="min-h-screen bg-muted/30">
      <EscalationNotification escalations={escalations} tasks={tasks} onAcknowledge={handleAcknowledgeEscalation} />

      <header className="border-b bg-background">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-2xl font-bold">Supervisor Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              {user?.name} - {user?.department}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push("/supervisor/analytics")}>
              <BarChart3 className="mr-2 h-4 w-4" />
              Analytics
            </Button>
            <ConnectionStatus isConnected={isConnected} />
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <TaskFilters
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              workerFilter={workerFilter}
              onWorkerFilterChange={setWorkerFilter}
              workers={departmentWorkers}
            />
          </CardContent>
        </Card>

        {completedTasks.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-3">Pending Verification</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {completedTasks.map((task) => (
                <Link key={task.id} href={`/supervisor/verify/${task.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-lg">{task.task_type}</CardTitle>
                        <Badge className={priorityColors[task.priority_level]} variant="secondary">
                          {task.priority_level.replace(/_/g, " ")}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="h-4 w-4" />
                        <span>{getWorkerName(task.assigned_to_user_id)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span>Room {task.room_number}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>
                          {task.actual_duration_minutes} / {task.expected_duration_minutes} min
                        </span>
                      </div>
                      <div className="flex items-center gap-2 pt-2">
                        <div className={`h-2 w-2 rounded-full ${statusColors[task.status]}`} />
                        <span className="text-sm font-medium">Needs Verification</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}

        {isMaintenanceSupervisor && (
          <section>
            <h2 className="text-lg font-semibold mb-3">Scheduled Maintenance</h2>
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Team Progress</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {completedMaintenanceTasks.length} completed • {activeMaintenanceTasks.length} in progress •
                  {" "}
                  {pendingMaintenanceTasks.length} pending
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {completedMaintenanceTasks.length > 0 ? (
                  completedMaintenanceTasks.map((task) => {
                    const completedAtDate = task.completed_at ? new Date(task.completed_at) : null
                    const completedAtLabel =
                      completedAtDate && !Number.isNaN(completedAtDate.getTime())
                        ? formatDistanceToNow(completedAtDate, { addSuffix: true })
                        : "just now"

                    return (
                      <div key={task.id} className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <p className="font-medium leading-tight">
                            {getMaintenanceTaskLabel(task.task_type)} — Room {task.room_number}
                            {task.location ? ` • ${task.location}` : ""}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Completed by {getMaintenanceWorkerName(task.assigned_to)} {completedAtLabel}
                          </p>
                          {task.notes && (
                            <p className="text-xs text-muted-foreground line-clamp-2">Notes: {task.notes}</p>
                          )}
                        </div>
                        <Badge variant="outline" className="whitespace-nowrap">
                          Completed
                        </Badge>
                      </div>
                    )
                  })
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No scheduled maintenance tasks have been completed yet.
                  </p>
                )}
              </CardContent>
            </Card>
          </section>
        )}

        {openIssues.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Reported Issues ({openIssues.length})
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {openIssues.map((issue) => {
                const task = tasks.find((t) => t.id === issue.task_id)
                if (!task) return null
                return (
                  <IssueCard
                    key={issue.id}
                    issue={issue}
                    task={task}
                    onResolve={(issueId) => {
                      // Mark issue as resolved
                      console.log("[v0] Resolving issue:", issueId)
                    }}
                  />
                )
              })}
            </div>
          </section>
        )}

        <section>
          <h2 className="text-lg font-semibold mb-3">All Tasks</h2>
          {otherTasks.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {otherTasks.map((task) => {
                const escalationLevel = getTaskEscalation(task.id)
                return (
                  <Card key={task.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-lg">{task.task_type}</CardTitle>
                        <div className="flex flex-col gap-1 items-end">
                          <Badge className={priorityColors[task.priority_level]} variant="secondary">
                            {task.priority_level.replace(/_/g, " ")}
                          </Badge>
                          {escalationLevel && <EscalationBadge level={escalationLevel} />}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="h-4 w-4" />
                        <span>{getWorkerName(task.assigned_to_user_id)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span>Room {task.room_number}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>
                          {task.actual_duration_minutes || "?"} / {task.expected_duration_minutes} min
                        </span>
                      </div>
                      <div className="flex items-center gap-2 pt-2">
                        <div className={`h-2 w-2 rounded-full ${statusColors[task.status]}`} />
                        <span className="text-sm font-medium">{task.status.replace(/_/g, " ")}</span>
                      </div>
                      {task.status === "COMPLETED" && task.supervisor_remark && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full mt-2 bg-transparent"
                          onClick={() => router.push(`/supervisor/verify/${task.id}`)}
                        >
                          View Details
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          ) : (
            <div className="flex min-h-[300px] items-center justify-center border-2 border-dashed rounded-lg">
              <p className="text-muted-foreground">No tasks found</p>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

export default function SupervisorPage() {
  return (
    <ProtectedRoute allowedRoles={["supervisor"]}>
      <SupervisorDashboard />
    </ProtectedRoute>
  )
}
