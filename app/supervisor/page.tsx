"use client"

import { useState, useEffect, useMemo } from "react"
import { ProtectedRoute } from "@/components/protected-route"
import { useAuth } from "@/lib/auth-context"
import { useTasks } from "@/lib/task-context"
import { EscalationBadge } from "@/components/escalation/escalation-badge"
import { EscalationNotification } from "@/components/escalation/escalation-notification"
import { WorkerProfileDialog } from "@/components/worker-profile-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LogOut, Clock, MapPin, User, AlertTriangle, XCircle, Bell, Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { IssueCard } from "@/components/issue-card"
import type { User as UserType } from "@/lib/types"
import { useRealtimeTasks } from "@/lib/use-realtime-tasks"
import { detectEscalationLevel, getEscalationColor, type Escalation } from "@/lib/escalation-utils"
import { createDualTimestamp } from "@/lib/mock-data"
import { TASK_TYPE_LABELS } from "@/lib/maintenance-types"
import { formatDistanceToNow } from "@/lib/date-utils"
import { SupervisorBottomNav } from "@/components/supervisor/supervisor-bottom-nav"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

function SupervisorDashboard() {
  const { user, logout } = useAuth()
  const { tasks, issues, users, maintenanceTasks } = useTasks()
  const router = useRouter()
  useRealtimeTasks({
    enabled: true,
    filter: { role: "supervisor" },
  })

  const [taskFilter, setTaskFilter] = useState<"all" | "rejected" | "pending" | "in_progress">("all")
  const workerFilter = "ALL"
  const [escalations, setEscalations] = useState<Escalation[]>([])
  const [selectedWorker, setSelectedWorker] = useState<UserType | null>(null)
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false)
  const [isNotificationDialogOpen, setIsNotificationDialogOpen] = useState(false)
  const [recentAcknowledgedId, setRecentAcknowledgedId] = useState<string | null>(null)

  const acknowledgedEscalations = useMemo(
    () => escalations.filter((esc) => Boolean(esc.acknowledged_by)),
    [escalations],
  )

  const activeEscalations = useMemo(
    () => escalations.filter((esc) => !esc.acknowledged_by && !esc.resolved),
    [escalations],
  )

  const unacknowledgedCriticalCount = useMemo(
    () =>
      escalations.filter(
        (esc) => !esc.acknowledged_by && !esc.resolved && (esc.level === 2 || esc.level === 3),
      ).length,
    [escalations],
  )

  const sortedActiveEscalations = useMemo(
    () =>
      [...activeEscalations].sort(
        (a, b) =>
          new Date(b.timestamp?.server ?? b.timestamp?.client ?? 0).getTime() -
          new Date(a.timestamp?.server ?? a.timestamp?.client ?? 0).getTime(),
      ),
    [activeEscalations],
  )

  const sortedAcknowledgedEscalations = useMemo(
    () =>
      [...acknowledgedEscalations].sort(
        (a, b) =>
          new Date(b.acknowledged_at ?? b.timestamp?.server ?? b.timestamp?.client ?? 0).getTime() -
          new Date(a.acknowledged_at ?? a.timestamp?.server ?? a.timestamp?.client ?? 0).getTime(),
      ),
    [acknowledgedEscalations],
  )

  const describeEscalationLevel = (level: 1 | 2 | 3) => {
    switch (level) {
      case 3:
        return "Task has exceeded 50% of expected duration. Immediate action required."
      case 2:
        return "Task has exceeded 20 minutes. Worker may need assistance."
      default:
        return "Task has been in progress for 15 minutes. Please check in."
    }
  }

  useEffect(() => {
    if (!recentAcknowledgedId) {
      return
    }

    const timeout = setTimeout(() => {
      setRecentAcknowledgedId(null)
    }, 60_000)

    return () => clearTimeout(timeout)
  }, [recentAcknowledgedId])

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
    }, 30000)

    return () => clearInterval(interval)
  }, [tasks, escalations])

  const handleLogout = () => {
    logout()
    router.push("/login")
  }

  const handleAcknowledgeEscalation = (escalationId: string) => {
    const acknowledgedAt = new Date().toISOString()

    setEscalations((prev) =>
      prev.map((esc) =>
        esc.id === escalationId
          ? {
              ...esc,
              acknowledged_by: user?.id ?? "supervisor",
              acknowledged_at: acknowledgedAt,
            }
          : esc,
      ),
    )

    setRecentAcknowledgedId(escalationId)
    setIsNotificationDialogOpen(true)
  }

  const handleWorkerClick = (workerId: string) => {
    const worker = users.find((u) => u.id === workerId)
    if (worker) {
      setSelectedWorker(worker)
      setIsProfileDialogOpen(true)
    }
  }

  const departmentTasks = tasks.filter((task) => {
    const worker = users.find((u) => u.id === task.assigned_to_user_id)
    const taskDepartment = task.department || worker?.department
    // If supervisor has no department, show all tasks
    if (!user?.department) return true
    // Normalize department comparison (case-insensitive)
    const normalizedUserDept = user.department.toLowerCase()
    const normalizedTaskDept = taskDepartment?.toLowerCase()
    return normalizedTaskDept === normalizedUserDept
  })

  const rejectedTasks = departmentTasks.filter((t) => t.status === "REJECTED")

  const rejectedMaintenanceTasks =
    user?.department?.toLowerCase() === "maintenance"
      ? (maintenanceTasks || []).filter((task) => task.status === "rejected")
      : []

  const filteredTasks = departmentTasks.filter((task) => {
    let statusMatch = true
    if (taskFilter === "rejected") {
      statusMatch = task.status === "REJECTED"
    } else if (taskFilter === "pending") {
      statusMatch = task.status === "PENDING"
    } else if (taskFilter === "in_progress") {
      statusMatch = task.status === "IN_PROGRESS" || task.status === "PAUSED"
    }
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

  // DEBUG: Log task filtering for supervisor tab
  console.log("[DEBUG] Supervisor Tab - Task Filtering:", {
    userRole: user?.role,
    userDepartment: user?.department,
    totalTasks: tasks.length,
    filteredTasks: filteredTasks.length,
    completedTasks: completedTasks.length,
    completedTasksWithDetails: completedTasks.map(task => ({
      id: task.id,
      taskType: task.task_type,
      status: task.status,
      hasPhotoUrls: !!(task.photo_urls && task.photo_urls.length > 0),
      hasCategorizedPhotos: !!(task.categorized_photos && Object.keys(task.categorized_photos).length > 0)
    }))
  })
  const otherTasks = filteredTasks.filter((t) => !(t.status === "COMPLETED" && !t.supervisor_remark))

  console.log("[v0] Supervisor dashboard - Completed tasks pending verification:", completedTasks.length)
  console.log("[v0] Supervisor dashboard - Other tasks:", otherTasks.length)
  console.log("[v0] Supervisor dashboard - Total filtered tasks:", filteredTasks.length)

  const isMaintenanceSupervisor = user?.department?.toLowerCase() === "maintenance"

  const departmentMaintenanceTasks = isMaintenanceSupervisor
    ? (maintenanceTasks || []).filter((task) => {
        if (!task.assigned_to) return true
        const assignedWorker = users.find((u) => u.id === task.assigned_to)
        if (!assignedWorker) return true
        return assignedWorker.department === "maintenance"
      })
    : []

  const completedMaintenanceTasks = departmentMaintenanceTasks.filter((task) => task.status === "completed")
  const activeMaintenanceTasks = departmentMaintenanceTasks.filter(
    (task) => task.status === "in_progress" || task.status === "paused",
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
    VERIFIED: "bg-emerald-600",
  }

  const openIssues = issues.filter((issue) => {
    const task = tasks.find((t) => t.id === issue.task_id)
    if (!task) return false
    const worker = users.find((u) => u.id === task.assigned_to_user_id)
    return worker?.department === user?.department && issue.status === "OPEN"
  })

  return (
    <div className="min-h-screen bg-muted/30 pb-20 md:pb-0">
      <WorkerProfileDialog worker={selectedWorker} open={isProfileDialogOpen} onOpenChange={setIsProfileDialogOpen} />

      <EscalationNotification escalations={escalations} tasks={tasks} onAcknowledge={handleAcknowledgeEscalation} />

      <header className="border-b bg-background sticky top-0 z-40">
        <div className="container mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between px-3 sm:px-4 py-3 sm:py-4 gap-3 sm:gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-bold">Supervisor Dashboard</h1>
            <p className="text-xs sm:text-sm text-muted-foreground truncate">
              {user?.name} - {user?.department}
            </p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              asChild
              size="sm"
              className="min-h-[44px] px-3 sm:px-4 flex-1 sm:flex-none"
            >
              <Link href="/supervisor/create-task">
                <Plus className="mr-2 h-4 w-4" />
                Create Task
              </Link>
            </Button>
            <Dialog open={isNotificationDialogOpen} onOpenChange={setIsNotificationDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="relative min-h-[44px] min-w-[44px] bg-transparent"
                  aria-label="Open escalation notifications"
                >
                  <Bell className="h-4 w-4" />
                  {unacknowledgedCriticalCount > 0 && (
                    <span className="absolute -top-1 -right-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1 text-xs font-semibold text-destructive-foreground">
                      {unacknowledgedCriticalCount}
                    </span>
                  )}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                  <DialogTitle>Escalation Notifications</DialogTitle>
                  <DialogDescription>
                    Review escalations that still need attention and those you have acknowledged.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-5">
                  <section>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Active Alerts</h3>
                    {sortedActiveEscalations.length === 0 ? (
                      <p className="mt-2 text-sm text-muted-foreground">No unacknowledged escalations. You're all caught up.</p>
                    ) : (
                      <div className="mt-3 space-y-3">
                        {sortedActiveEscalations.map((escalation) => {
                          const task = tasks.find((t) => t.id === escalation.task_id)
                          const escalatedAgo = formatDistanceToNow(escalation.timestamp?.server ?? escalation.timestamp?.client ?? new Date())

                          return (
                            <div key={escalation.id} className="rounded-lg border border-border bg-background p-3">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="font-medium leading-tight">{task?.task_type ?? "Unknown task"}</p>
                                  {task?.room_number && (
                                    <p className="text-sm text-muted-foreground">Room {task.room_number}</p>
                                  )}
                                  <p className="mt-2 text-sm text-muted-foreground">{describeEscalationLevel(escalation.level)}</p>
                                </div>
                                <Badge className={getEscalationColor(escalation.level)} variant="secondary">
                                  Level {escalation.level}
                                </Badge>
                              </div>
                              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                                <span>Escalated {escalatedAgo}</span>
                                <Button size="sm" onClick={() => handleAcknowledgeEscalation(escalation.id)}>
                                  Acknowledge
                                </Button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </section>

                  <section>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Acknowledged</h3>
                    {sortedAcknowledgedEscalations.length === 0 ? (
                      <p className="mt-2 text-sm text-muted-foreground">Nothing acknowledged yet.</p>
                    ) : (
                      <div className="mt-3 space-y-3">
                        {sortedAcknowledgedEscalations.map((escalation) => {
                          const task = tasks.find((t) => t.id === escalation.task_id)
                          const acknowledgedAgo = formatDistanceToNow(
                            escalation.acknowledged_at ?? escalation.timestamp?.server ?? escalation.timestamp?.client ?? new Date(),
                          )
                          const isRecent = recentAcknowledgedId === escalation.id

                          return (
                            <div
                              key={escalation.id}
                              className={`rounded-lg border p-3 transition-colors ${
                                isRecent ? "border-primary bg-primary/10" : "border-border bg-background"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="font-medium leading-tight">{task?.task_type ?? "Unknown task"}</p>
                                  {task?.room_number && (
                                    <p className="text-sm text-muted-foreground">Room {task.room_number}</p>
                                  )}
                                  <p className="mt-2 text-sm text-muted-foreground">{describeEscalationLevel(escalation.level)}</p>
                                </div>
                                <Badge className={getEscalationColor(escalation.level)} variant="secondary">
                                  Level {escalation.level}
                                </Badge>
                              </div>
                              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                                <span>Acknowledged {acknowledgedAgo}</span>
                                <span>{escalation.acknowledged_by ? `by ${escalation.acknowledged_by}` : ""}</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </section>
                </div>
              </DialogContent>
            </Dialog>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="min-h-[44px] min-w-[44px] bg-transparent"
            >
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {(rejectedTasks.length > 0 || rejectedMaintenanceTasks.length > 0) && (
          <section>
            <h2 className="text-base sm:text-lg font-semibold mb-3 flex items-center gap-2">
              <XCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-500" />
              Rejected Tasks ({rejectedTasks.length + rejectedMaintenanceTasks.length})
            </h2>
            <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rejectedMaintenanceTasks.map((task) => (
                <Card key={task.id} className="border-red-200">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-lg">{getMaintenanceTaskLabel(task.task_type)}</CardTitle>
                      <Badge variant="destructive">Rejected</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="h-4 w-4" />
                      <span>{getMaintenanceWorkerName(task.assigned_to)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span>
                        Room {task.room_number} • {task.location}
                      </span>
                    </div>
                    {task.rejection_reason && (
                      <div className="pt-2 border-t">
                        <p className="text-xs font-medium text-red-700">Reason:</p>
                        <p className="text-xs text-muted-foreground">{task.rejection_reason}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}

              {rejectedTasks.map((task) => (
                <Card key={task.id} className="border-red-200">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-lg">{task.task_type}</CardTitle>
                      <Badge variant="destructive">Rejected</Badge>
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
                    {task.supervisor_remark && (
                      <div className="pt-2 border-t">
                        <p className="text-xs font-medium text-red-700">Reason:</p>
                        <p className="text-xs text-muted-foreground">{task.supervisor_remark}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {completedTasks.length > 0 && (
          <section>
            <h2 className="text-base sm:text-lg font-semibold mb-3">Pending Verification</h2>
            <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                  {completedMaintenanceTasks.length} completed • {activeMaintenanceTasks.length} in progress •{" "}
                  {pendingMaintenanceTasks.length} pending
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {completedMaintenanceTasks.length > 0 ? (
                  completedMaintenanceTasks.map((task) => {
                    const completedAtDate = task.completed_at ? new Date(task.completed_at) : null
                    const completedAtLabel =
                      completedAtDate && !Number.isNaN(completedAtDate.getTime())
                        ? formatDistanceToNow(completedAtDate)
                        : "just now"

                    return (
                      <Card key={task.id} className="border-l-4 border-l-green-500">
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="space-y-1 flex-1">
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
                            <div className="flex flex-col gap-2 items-end">
                              <Badge variant="outline" className="whitespace-nowrap">
                                Completed
                              </Badge>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => router.push(`/supervisor/maintenance/${task.id}`)}
                                className="whitespace-nowrap"
                              >
                                View Details
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
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
            <h2 className="text-base sm:text-lg font-semibold mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500" />
              Reported Issues ({openIssues.length})
            </h2>
            <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
              {openIssues.map((issue) => {
                const task = tasks.find((t) => t.id === issue.task_id)
                if (!task) return null
                return (
                  <IssueCard
                    key={issue.id}
                    issue={issue}
                    task={task}
                    onResolve={(issueId) => {
                      console.log("[v0] Resolving issue:", issueId)
                    }}
                  />
                )
              })}
            </div>
          </section>
        )}

        <section>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <h2 className="text-base sm:text-lg font-semibold">Tasks</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant={taskFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setTaskFilter("all")}
                className="min-h-[36px]"
              >
                All
              </Button>
              <Button
                variant={taskFilter === "rejected" ? "default" : "outline"}
                size="sm"
                onClick={() => setTaskFilter("rejected")}
                className="min-h-[36px]"
              >
                Rejected
              </Button>
              <Button
                variant={taskFilter === "pending" ? "default" : "outline"}
                size="sm"
                onClick={() => setTaskFilter("pending")}
                className="min-h-[36px]"
              >
                Pending
              </Button>
              <Button
                variant={taskFilter === "in_progress" ? "default" : "outline"}
                size="sm"
                onClick={() => setTaskFilter("in_progress")}
                className="min-h-[36px]"
              >
                In Progress
              </Button>
            </div>
          </div>
          {otherTasks.length > 0 ? (
            <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                      <div
                        className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                        onClick={() => handleWorkerClick(task.assigned_to_user_id)}
                      >
                        <User className="h-4 w-4" />
                        <span className="underline decoration-dotted">{getWorkerName(task.assigned_to_user_id)}</span>
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

      <SupervisorBottomNav />
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
