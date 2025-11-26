"use client"

import { ProtectedRoute } from "@/components/protected-route"
import { useAuth } from "@/lib/auth-context"
import { useTasks } from "@/lib/task-context"
import { TaskCard } from "@/components/task-card"
import { TaskImage } from "@/components/task-image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { LogOut, Bell, AlertCircle, X, Clock, CheckCircle2, XCircle, TrendingUp, ListTodo } from "lucide-react"
import { useRouter } from "next/navigation"
import { useRealtimeTasks } from "@/lib/use-realtime-tasks"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useCallback, useEffect, useMemo, useState } from "react"
import { BottomNav } from "@/components/mobile/bottom-nav"
import { MaintenanceCalendar } from "@/components/maintenance/maintenance-calendar"
import type { MaintenanceTask } from "@/lib/maintenance-types"
import type { Task } from "@/lib/types"
import { TASK_TYPE_LABELS } from "@/lib/maintenance-types"
import { formatDistanceToNow } from "@/lib/date-utils"
import { cn } from "@/lib/utils"
import { formatShiftRange } from "@/lib/date-utils"
import { initializePauseMonitoring } from "@/lib/pause-monitoring"

// Define REJECTION_QUOTA and related constants
const REJECTION_QUOTA = 5 // Updated quota from 3 to 5 per month

function WorkerDashboard() {
  const { user, logout } = useAuth()
  const { tasks, dismissRejectedTask, maintenanceTasks, users } = useTasks()
  const router = useRouter()
  useRealtimeTasks({
    enabled: true,
    filter: { userId: user?.id },
  })
  const [urgentTaskAlert, setUrgentTaskAlert] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("home")

  const [tasksFilter, setTasksFilter] = useState<"all" | "active" | "recurring" | "completed" | "rejected">("all")

  const [searchQuery, setSearchQuery] = useState("")
  const [nowTick, setNowTick] = useState(() => Date.now())

  useEffect(() => {
    console.log("[v0] Worker dashboard loaded for user:", user?.id, user?.name)
  }, [user])

  useEffect(() => {
    if (!user?.id) return

    const cleanup = initializePauseMonitoring(tasks, maintenanceTasks ?? [], users)
    return cleanup
  }, [tasks, maintenanceTasks, users, user?.id])

  useEffect(() => {
    if (typeof window === "undefined") return

    const intervalId = window.setInterval(() => {
      setNowTick(Date.now())
    }, 30_000)

    return () => window.clearInterval(intervalId)
  }, [])

  const normalizedDepartment = user?.department?.toLowerCase()
  const isMaintenanceUser = normalizedDepartment === "maintenance"
  const departmentDisplay = user?.department
    ? user.department
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ")
    : ""

  const myTasks = useMemo(() => {
    if (!user?.id) {
      return []
    }

    return tasks.filter((task) => {
      if (task.assigned_to_user_id !== user.id) {
        return false
      }

      if (task.status !== "PENDING") {
        return true
      }

      const assignedServer = task.assigned_at?.server
      if (!assignedServer) {
        return true
      }

      const assignedTime = Date.parse(assignedServer)
      if (Number.isNaN(assignedTime)) {
        return true
      }

      return assignedTime <= nowTick
    })
  }, [tasks, user?.id, nowTick])
  const isRecurringTask = useCallback(
    (task: Task) =>
      Boolean(
        task.is_recurring ||
          task.recurring_frequency ||
          task.custom_task_is_recurring ||
          task.custom_task_recurring_frequency,
      ),
    [],
  )
  const pendingTasks = myTasks.filter((t) => t.status === "PENDING")
  const inProgressTasks = myTasks.filter((t) => t.status === "IN_PROGRESS" || t.status === "PAUSED")
  const completedTasks = myTasks.filter((t) => t.status === "COMPLETED")
  const rejectedTasks = myTasks.filter((t) => t.status === "REJECTED")
  const unacknowledgedRejectedTasks = rejectedTasks.filter((t) => !t.rejection_acknowledged)
  const acknowledgedRejectedTasks = rejectedTasks.filter((t) => t.rejection_acknowledged)

  const recurringTasks = useMemo(() => myTasks.filter(isRecurringTask), [myTasks, isRecurringTask])
  const nonRecurringTasks = useMemo(
    () => myTasks.filter((task) => !isRecurringTask(task)),
    [myTasks, isRecurringTask],
  )
  const homeInProgressTasks = useMemo(
    () => inProgressTasks.filter((task) => !isRecurringTask(task)),
    [inProgressTasks, isRecurringTask],
  )
  const homePendingTasks = useMemo(
    () => pendingTasks.filter((task) => !isRecurringTask(task)),
    [pendingTasks, isRecurringTask],
  )
  const homeCompletedTasks = useMemo(
    () => completedTasks.filter((task) => !isRecurringTask(task)),
    [completedTasks, isRecurringTask],
  )

  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()

  const monthlyMaintenanceTasks = useMemo(() => {
    return (maintenanceTasks || []).filter((task) => {
      if (task.period_month && task.period_year) {
        return task.period_month === currentMonth && task.period_year === currentYear
      }

      if (!task.created_at) return true

      const createdAt = new Date(task.created_at)
      if (Number.isNaN(createdAt.getTime())) return true

      return createdAt.getMonth() + 1 === currentMonth && createdAt.getFullYear() === currentYear
    })
  }, [maintenanceTasks, currentMonth, currentYear])

  const maintenanceTasksForDisplay = useMemo(() => {
    if (monthlyMaintenanceTasks.length > 0) {
      return monthlyMaintenanceTasks
    }
    return maintenanceTasks ?? []
  }, [monthlyMaintenanceTasks, maintenanceTasks])
  const maintenanceTaskIdsForDisplay = useMemo(
    () => new Set(maintenanceTasksForDisplay.map((task) => task.id)),
    [maintenanceTasksForDisplay],
  )
  const completedMaintenanceTasksForDisplay = maintenanceTasksForDisplay.filter((task) => task.status === "completed")
  const maintenanceProgressRatio =
    maintenanceTasksForDisplay.length > 0
      ? completedMaintenanceTasksForDisplay.length / maintenanceTasksForDisplay.length
      : 0
  const maintenanceProgressPercentage = Math.round(maintenanceProgressRatio * 100)

  const myMaintenanceAssignments = (maintenanceTasks || []).filter((t) => t.assigned_to === user?.id)
  const myActiveMaintenanceTasks = myMaintenanceAssignments.filter(
    (t) => t.status === "in_progress" || t.status === "paused",
  )
  const completedMaintenanceTasks = myMaintenanceAssignments.filter((t) => t.status === "completed")
  const myCompletedMaintenanceTasks = (maintenanceTasks || []).filter(
    (t) => t.assigned_to === user?.id && t.status === "completed",
  )
  const myCompletedMaintenanceTasksForDisplay = myCompletedMaintenanceTasks.filter((task) =>
    maintenanceTaskIdsForDisplay.has(task.id),
  )
  const canAccessMaintenance = isMaintenanceUser || myMaintenanceAssignments.length > 0

  useEffect(() => {
    if (!canAccessMaintenance && activeTab === "scheduled") {
      setActiveTab("home")
    }
  }, [canAccessMaintenance, activeTab])

  const getMaintenanceTaskLabel = (task: MaintenanceTask) =>
    TASK_TYPE_LABELS[task.task_type] ?? task.task_type.replace(/_/g, " ")

  const getMaintenanceTaskTimestamp = (task: MaintenanceTask) => {
    const timestamps = [task.paused_at, task.started_at, task.completed_at, task.created_at]
      .filter(Boolean)
      .map((value) => new Date(value!).getTime())
      .filter((time) => !Number.isNaN(time))

    return timestamps.length > 0 ? Math.max(...timestamps) : 0
  }

  const getPrimaryMaintenanceTimestamp = (task: MaintenanceTask) => {
    if (task.status === "in_progress" && task.started_at) return task.started_at
    if (task.status === "paused" && task.paused_at) return task.paused_at
    if (task.started_at) return task.started_at
    return task.created_at
  }

  const currentMaintenanceTask = myActiveMaintenanceTasks.length
    ? [...myActiveMaintenanceTasks].sort((a, b) => {
        const statusPriority = (status: MaintenanceTask["status"]) => (status === "in_progress" ? 0 : 1)
        const statusDiff = statusPriority(a.status) - statusPriority(b.status)
        if (statusDiff !== 0) return statusDiff

        return getMaintenanceTaskTimestamp(b) - getMaintenanceTaskTimestamp(a)
      })[0]
    : null

  const handleNavigateToMaintenanceTask = (task: MaintenanceTask) => {
    if (!task.room_number) return

    router.push(`/worker/maintenance/${task.room_number}/${task.task_type}/${encodeURIComponent(task.location)}`)
  }

  useEffect(() => {
    console.log("[v0] Worker status check:", {
      userId: user?.id,
      regularTasks: {
        total: myTasks.length,
        inProgress: inProgressTasks.length,
        pending: pendingTasks.length,
      },
      maintenanceTasks: {
        total: maintenanceTasks?.length || 0,
        myActive: myActiveMaintenanceTasks.length,
        myCompleted: myCompletedMaintenanceTasks.length,
        details: myMaintenanceAssignments.map((t) => ({
          id: t.id,
          room: t.room_number,
          type: t.task_type,
          status: t.status,
        })),
      },
      workerStatus: inProgressTasks.length > 0 || myActiveMaintenanceTasks.length > 0 ? "BUSY" : "AVAILABLE",
    })
  }, [
    user?.id,
    myTasks,
    inProgressTasks.length,
    pendingTasks.length,
    maintenanceTasks,
    myActiveMaintenanceTasks,
    myCompletedMaintenanceTasks.length,
    myMaintenanceAssignments,
  ])

  const activeMaintenanceByRoom = myActiveMaintenanceTasks.reduce(
    (acc, task) => {
      if (!task.room_number) {
        return acc
      }
      if (!acc[task.room_number]) {
        acc[task.room_number] = []
      }
      acc[task.room_number].push(task)
      return acc
    },
    {} as Record<string, typeof myActiveMaintenanceTasks>,
  )

  const partiallyCompletedRooms = Object.entries(
    (maintenanceTasks || [])
      .filter((t) => t.assigned_to === user?.id)
      .reduce(
        (acc, task) => {
          if (!task.room_number) {
            return acc
          }
          if (!acc[task.room_number]) {
            acc[task.room_number] = []
          }
          acc[task.room_number].push(task)
          return acc
        },
        {} as Record<string, MaintenanceTask[]>,
      ),
  )
    .map(([roomNumber, tasks]) => {
      const completedCount = tasks.filter((t) => t.status === "completed").length
      const totalCount = tasks.length
      return {
        roomNumber,
        completedCount,
        totalCount,
        isPartial: completedCount > 0 && completedCount < totalCount,
        tasks,
      }
    })
    .filter((room) => room.isPartial)
    .sort((a, b) => b.completedCount - a.completedCount)

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

  const handleRoomClick = (roomNumber: string, tasks: MaintenanceTask[]) => {
    void tasks
    console.log("[v0] Navigating to room:", roomNumber)
    router.push(`/worker/maintenance/${roomNumber}`)
  }

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
        return "bg-accent/10 text-accent-foreground border-accent"
      case "REJECTED":
        return "bg-destructive/10 text-destructive border-destructive"
      case "IN_PROGRESS":
        return "bg-primary/10 text-primary border-primary"
      case "PAUSED":
        return "bg-muted text-muted-foreground border-border"
      default:
        return "bg-muted text-muted-foreground border-border"
    }
  }

  const onTimeTasks = completedTasks.filter((t) => {
    if (!t.actual_duration_minutes || !t.expected_duration_minutes) return false
    return t.actual_duration_minutes <= t.expected_duration_minutes
  })

  const tasksWithRating = completedTasks.filter((t) => t.rating !== null && t.rating !== undefined)
  const avgRating =
    tasksWithRating.length > 0
      ? (tasksWithRating.reduce((sum, t) => sum + (t.rating || 0), 0) / tasksWithRating.length).toFixed(1)
      : "N/A"

  const totalScheduledTasks = myMaintenanceAssignments.length
  const totalAssignments = myTasks.length + totalScheduledTasks
  const totalCompletedAssignments = completedTasks.length + completedMaintenanceTasks.length
  const completionRate = totalAssignments > 0 ? Math.round((totalCompletedAssignments / totalAssignments) * 100) : 0
  const onTimeRate = completedTasks.length > 0 ? Math.round((onTimeTasks.length / completedTasks.length) * 100) : 0

  const totalMaintenanceMinutes = completedMaintenanceTasks.reduce(
    (sum, task) => sum + Math.max(task.timer_duration || 0, 0) / 60,
    0,
  )
  const totalRegularMinutes = completedTasks.reduce((sum, t) => sum + (t.actual_duration_minutes || 0), 0)
  const avgCompletionTime =
    totalCompletedAssignments > 0
      ? Math.round((totalRegularMinutes + totalMaintenanceMinutes) / totalCompletedAssignments)
      : 0

  const initials = user?.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()

  // Calculate rejectedThisMonth and quotaRemaining for the profile banner
  const today = new Date()
  const rejectedThisMonth = rejectedTasks.filter((t) => {
    const referenceTimestamp = t.completed_at?.client ?? t.rejection_acknowledged_at?.client ?? t.assigned_at.client
    const referenceDate = new Date(referenceTimestamp)
    if (Number.isNaN(referenceDate.getTime())) {
      return false
    }
    return (
      referenceDate.getMonth() === today.getMonth() && referenceDate.getFullYear() === today.getFullYear()
    )
  }).length
  const quotaRemaining = REJECTION_QUOTA - rejectedThisMonth

  const renderContent = () => {
    switch (activeTab) {
      case "tasks":
        const filteredTasks = myTasks.filter((task) => {
          if (tasksFilter === "all") return true
          if (tasksFilter === "active")
            return task.status === "PENDING" || task.status === "IN_PROGRESS" || task.status === "PAUSED"
          if (tasksFilter === "recurring") return isRecurringTask(task)
          if (tasksFilter === "completed") return task.status === "COMPLETED" || task.status === "VERIFIED"
          if (tasksFilter === "rejected") return task.status === "REJECTED"
          return true
        })

        return (
          <main className="container mx-auto px-4 py-6 space-y-4">
            <div className="flex gap-2 overflow-x-auto pb-2">
              {[
                { value: "all", label: "All" },
                { value: "active", label: "Active" },
                { value: "recurring", label: "Recurring" },
                { value: "completed", label: "Completed" },
                { value: "rejected", label: "Rejected" },
              ].map((tab) => (
                <Button
                  key={tab.value}
                  variant={tasksFilter === tab.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTasksFilter(tab.value as typeof tasksFilter)}
                  className="whitespace-nowrap"
                >
                  {tab.label}
                </Button>
              ))}
            </div>

            {filteredTasks.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No tasks found</p>
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
                        {isRecurringTask(task) && (
                          <Badge
                            variant="secondary"
                            className="text-xs border-amber-200 bg-amber-50 text-amber-700"
                          >
                            Recurring
                          </Badge>
                        )}
                      </div>

                      <h3 className="font-semibold text-lg mb-1">{task.task_type}</h3>

                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Room {task.room_number}</span>
                        {task.assigned_at && <span>Assigned {formatDistanceToNow(task.assigned_at.client)}</span>}
                      </div>

                      {task.rating && (
                        <div className="mt-2 flex items-center gap-1">
                          <span className="text-sm font-medium">Rating:</span>
                          <span className="text-accent-foreground">{"★".repeat(task.rating)}</span>
                          <span className="text-muted">{"★".repeat(5 - task.rating)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))
            )}
          </main>
        )

      case "profile":
        return (
          <main className="container mx-auto px-4 py-6 space-y-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <Avatar className="h-20 w-20">
                    <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold">{user?.name}</h2>
                    <p className="text-muted-foreground">{user?.role}</p>
                    <div className="mt-2 space-y-1">
                      <Badge variant="secondary">{departmentDisplay}</Badge>
                      {user?.phone && <p className="text-sm text-muted-foreground">📞 {user.phone}</p>}
                      {user?.shift_start && user?.shift_end && (
                        <p className="text-sm text-muted-foreground">
                          🕐 {formatShiftRange(user.shift_start, user.shift_end)}
                        </p>
                      )}
                    </div>
                  </div>
                  {/* CHANGE: Replaced simple badge with sophisticated rejection display card */}
                  <div className="shrink-0">
                    <Card
                      className={cn(
                        "border-2 transition-all duration-300 min-w-[140px]",
                        rejectedThisMonth === 0 && "bg-green-50/50 border-green-200/50",
                        rejectedThisMonth >= 1 && rejectedThisMonth <= 2 && "bg-green-50 border-green-300",
                        rejectedThisMonth === 3 && "bg-yellow-50 border-yellow-300",
                        rejectedThisMonth === 4 && "bg-orange-50 border-orange-400",
                        rejectedThisMonth >= REJECTION_QUOTA && "bg-red-50 border-red-400 shadow-md",
                      )}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2 mb-2">
                          {rejectedThisMonth === 0 && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                          {rejectedThisMonth >= 1 && rejectedThisMonth <= 2 && (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          )}
                          {rejectedThisMonth === 3 && <AlertCircle className="h-4 w-4 text-yellow-600" />}
                          {rejectedThisMonth === 4 && <AlertCircle className="h-4 w-4 text-orange-600" />}
                          {rejectedThisMonth >= REJECTION_QUOTA && <XCircle className="h-4 w-4 text-red-600" />}
                          <span className="text-xs font-medium text-muted-foreground">Quality</span>
                        </div>
                        <div className="flex items-baseline gap-1 mb-2">
                          <span
                            className={cn(
                              "text-2xl font-bold",
                              rejectedThisMonth === 0 && "text-green-600",
                              rejectedThisMonth >= 1 && rejectedThisMonth <= 2 && "text-green-700",
                              rejectedThisMonth === 3 && "text-yellow-700",
                              rejectedThisMonth === 4 && "text-orange-700",
                              rejectedThisMonth >= REJECTION_QUOTA && "text-red-700",
                            )}
                          >
                            {rejectedThisMonth}
                          </span>
                          <span className="text-sm text-muted-foreground">/{REJECTION_QUOTA}</span>
                        </div>
                        <div className="w-full h-1.5 bg-muted/30 rounded-full overflow-hidden mb-2">
                          <div
                            className={cn(
                              "h-full transition-all duration-500",
                              rejectedThisMonth === 0 && "bg-green-500",
                              rejectedThisMonth >= 1 && rejectedThisMonth <= 2 && "bg-green-500",
                              rejectedThisMonth === 3 && "bg-yellow-500",
                              rejectedThisMonth === 4 && "bg-orange-500",
                              rejectedThisMonth >= REJECTION_QUOTA && "bg-red-600",
                            )}
                            style={{ width: `${Math.min((rejectedThisMonth / REJECTION_QUOTA) * 100, 100)}%` }}
                          />
                        </div>
                        <p
                          className={cn(
                            "text-xs font-medium",
                            rejectedThisMonth === 0 && "text-green-600",
                            rejectedThisMonth >= 1 && rejectedThisMonth <= 2 && "text-green-700",
                            rejectedThisMonth === 3 && "text-yellow-700",
                            rejectedThisMonth === 4 && "text-orange-700",
                            rejectedThisMonth >= REJECTION_QUOTA && "text-red-700",
                          )}
                        >
                          {rejectedThisMonth === 0 && "Perfect!"}
                          {rejectedThisMonth >= 1 && rejectedThisMonth <= 2 && `${quotaRemaining} left`}
                          {rejectedThisMonth === 3 && "Be careful"}
                          {rejectedThisMonth === 4 && "Last chance"}
                          {rejectedThisMonth >= REJECTION_QUOTA && "Retraining"}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                  {/* </CHANGE> */}
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Assignments</CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalAssignments}</div>
                  <p className="text-xs text-muted-foreground">
                    {totalCompletedAssignments} completed ({completedMaintenanceTasks.length} scheduled)
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{completionRate}%</div>
                  <p className="text-xs text-muted-foreground">Across guest & scheduled work</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg. Completion Time</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{avgCompletionTime}m</div>
                  <p className="text-xs text-muted-foreground">Per assignment (including scheduled)</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{avgRating}</div>
                  <p className="text-xs text-muted-foreground">Out of 5 stars</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">On-Time Rate</CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{onTimeRate}%</div>
                  <p className="text-xs text-muted-foreground">Tasks completed on time</p>
                </CardContent>
              </Card>
            </div>

            {canAccessMaintenance && myCompletedMaintenanceTasksForDisplay.length > 0 && (
              <section>
                <h2 className="text-base md:text-lg font-semibold mb-3">✅ Recently Completed Tasks</h2>
                <p className="text-sm text-muted-foreground mb-3">
                  Tap to view room details and complete remaining tasks
                </p>
                <div className="space-y-3">
                  {myCompletedMaintenanceTasksForDisplay
                    .sort((a, b) => {
                      const aReference = a.completed_at ?? a.started_at ?? a.created_at
                      const bReference = b.completed_at ?? b.started_at ?? b.created_at
                      const aTime = new Date(aReference ?? a.created_at).getTime()
                      const bTime = new Date(bReference ?? b.created_at).getTime()
                      return bTime - aTime
                    })
                    .slice(0, 10)
                    .map((task) => {
                      const roomTasks = maintenanceTasksForDisplay.filter((t) => t.room_number === task.room_number)
                      const completedCount = roomTasks.filter((t) => t.status === "completed").length
                      const remainingCount = Math.max(roomTasks.length - completedCount, 0)

                      return (
                        <Card
                          key={task.id}
                          className="cursor-pointer hover:shadow-md transition-shadow border-accent/30 bg-accent/5"
                          onClick={() => router.push(`/worker/maintenance/${task.room_number}`)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="font-semibold text-lg">Room {task.room_number}</h3>
                                  <Badge
                                    variant="outline"
                                    className="text-xs bg-green-50 text-green-700 border-green-300"
                                  >
                                    ✓ Completed
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground mb-2">
                                  {getMaintenanceTaskLabel(task)}
                                  {task.location && ` • ${task.location}`}
                                </p>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                  <span>
                                    {completedCount}/{roomTasks.length} tasks done
                                  </span>
                                  {remainingCount > 0 && (
                                    <span className="text-orange-600 font-medium">{remainingCount} remaining</span>
                                  )}
                                  {task.completed_at && <span>{formatDistanceToNow(task.completed_at)}</span>}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <Button size="sm" variant={remainingCount > 0 ? "default" : "outline"}>
                                  {remainingCount > 0 ? "Continue" : "View"}
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                </div>
              </section>
            )}
          </main>
        )

      case "scheduled":
        if (!canAccessMaintenance) {
          return (
            <main className="container mx-auto px-4 py-6 space-y-4">
              <Card>
                <CardContent className="p-6 text-center text-muted-foreground">
                  Scheduled maintenance is only available when you have maintenance tasks assigned.
                </CardContent>
              </Card>
            </main>
          )
        }
        return (
          <main className="container mx-auto px-4 py-6">
            <MaintenanceCalendar
              onRoomClick={handleRoomClick}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              tasks={maintenanceTasksForDisplay}
            />
          </main>
        )

      case "home":
      default:
        return (
          <main className="container mx-auto px-4 py-6 space-y-6">
            {urgentTaskAlert && (
              <Alert className="border-destructive/50 bg-destructive/10">
                <Bell className="h-4 w-4 text-destructive" />
                <AlertDescription className="text-destructive">
                  <strong>Urgent Guest Request!</strong> A new high-priority task has been assigned to you.
                </AlertDescription>
              </Alert>
            )}

            {recurringTasks.length > 0 && (
              <Alert className="border-primary/40 bg-primary/10">
                <ListTodo className="h-4 w-4 text-primary" />
                <AlertDescription className="text-primary">
                  Recurring tasks are waiting in the Tasks tab. Tap "Tasks" below to review, start, or complete them.
                </AlertDescription>
              </Alert>
            )}

            {canAccessMaintenance && currentMaintenanceTask && currentMaintenanceTask.room_number && (
              <Card
                className="cursor-pointer border-2 border-accent bg-accent/20 shadow-lg transition-all hover:shadow-xl hover:border-accent/80"
                onClick={() => handleNavigateToMaintenanceTask(currentMaintenanceTask)}
              >
                <CardContent className="p-6 flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge
                          variant={currentMaintenanceTask.status === "in_progress" ? "default" : "secondary"}
                          className="text-sm font-semibold"
                        >
                          {currentMaintenanceTask.status === "in_progress" ? "● WORKING NOW" : "⏸ PAUSED"}
                        </Badge>
                      </div>
                      <h2 className="text-2xl font-bold text-foreground mb-1">
                        {getMaintenanceTaskLabel(currentMaintenanceTask)}
                      </h2>
                      <p className="text-base font-medium text-muted-foreground">
                        Room {currentMaintenanceTask.room_number}
                        {currentMaintenanceTask.location && ` • ${currentMaintenanceTask.location}`}
                      </p>
                      {(() => {
                        const timestamp = getPrimaryMaintenanceTimestamp(currentMaintenanceTask)
                        if (!timestamp) return null

                        const date = new Date(timestamp)
                        if (Number.isNaN(date.getTime())) return null

                        return (
                          <p className="text-sm text-muted-foreground mt-2">
                            {currentMaintenanceTask.status === "paused" ? "Paused" : "Started"}{" "}
                            {formatDistanceToNow(date)}
                          </p>
                        )
                      })()}
                    </div>
                  </div>

                  <p className="text-base font-medium text-foreground">
                    {currentMaintenanceTask.status === "in_progress"
                      ? "👉 Tap to continue your active maintenance task"
                      : "👉 Tap to resume this paused task"}
                  </p>

                  <Button size="lg" className="w-full sm:w-auto font-semibold">
                    {currentMaintenanceTask.status === "in_progress" ? "Continue Task →" : "Resume Task →"}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Progress card showing task completion */}
            {canAccessMaintenance && maintenanceTasksForDisplay.length > 0 && (
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-semibold text-foreground">
                      {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })} Progress
                    </h2>
                    <div className="text-2xl font-bold text-primary">
                      {completedMaintenanceTasksForDisplay.length}/{maintenanceTasksForDisplay.length}
                    </div>
                  </div>
                  <div className="w-full bg-muted rounded-full h-3">
                    <div
                      className="bg-primary h-3 rounded-full transition-all"
                      style={{ width: `${maintenanceProgressRatio * 100}%` }}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {maintenanceProgressPercentage}% of tasks completed this month
                  </p>
                </CardContent>
              </Card>
            )}

            {canAccessMaintenance && Object.keys(activeMaintenanceByRoom).length > 0 && (
              <section>
                <h2 className="text-base md:text-lg font-semibold mb-3 text-black">🔧 Active Maintenance Tasks</h2>
                <div className="space-y-3">
                  {Object.entries(activeMaintenanceByRoom).map(([roomNumber, tasks]) => {
                    const inProgressCount = tasks.filter((t) => t.status === "in_progress").length
                    const pausedCount = tasks.filter((t) => t.status === "paused").length

                    return (
                      <Card
                        key={roomNumber}
                        className="cursor-pointer hover:shadow-md transition-shadow border-accent/50 bg-accent/5"
                        onClick={() => router.push(`/worker/maintenance/${roomNumber}`)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <h3 className="font-semibold text-lg mb-1">Room {roomNumber}</h3>
                              <p className="text-sm text-muted-foreground mb-2">
                                {inProgressCount > 0 && (
                                  <span className="text-accent font-medium">● {inProgressCount} in progress</span>
                                )}
                                {inProgressCount > 0 && pausedCount > 0 && <span className="mx-2">•</span>}
                                {pausedCount > 0 && (
                                  <span className="text-muted-foreground">⏸ {pausedCount} paused</span>
                                )}
                              </p>
                              <div className="flex gap-2 flex-wrap">
                                {tasks.map((task) => (
                                  <Badge
                                    key={task.id}
                                    variant={task.status === "in_progress" ? "default" : "outline"}
                                    className="text-xs"
                                  >
                                    {task.task_type === "ac_indoor"
                                      ? "AC Indoor"
                                      : task.task_type === "ac_outdoor"
                                        ? "AC Outdoor"
                                        : task.task_type === "fan"
                                          ? "Fan"
                                          : "Exhaust"}
                                    {task.status === "in_progress" && " ●"}
                                    {task.status === "paused" && " ⏸"}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-2xl font-bold text-accent">{tasks.length}</div>
                              <p className="text-xs text-muted-foreground bg-background">Active</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </section>
            )}

            {unacknowledgedRejectedTasks.length > 0 && (
              <section>
                <h2 className="text-base md:text-lg font-semibold mb-3 text-destructive">
                  ⚠️ Rejected Tasks - Action Required
                </h2>
                <div className="space-y-4">
                  {unacknowledgedRejectedTasks.map((task) => (
                    <Card key={task.id} className="border-destructive/50 bg-destructive/10">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 flex-1">
                            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                            <CardTitle className="text-lg">{task.task_type}</CardTitle>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDismissRejection(task.id)}
                            className="h-8 w-8 text-destructive hover:bg-destructive/20"
                            title="Acknowledge rejection"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <p className="text-sm font-medium text-destructive">
                          <strong>Rejection Reason:</strong> {task.supervisor_remark || "No reason provided"}
                        </p>
                        {task.rejection_proof_photo_url && (
                          <div className="mt-2">
                            <p className="text-sm font-medium text-destructive mb-2">Proof Photo:</p>
                            <TaskImage
                              src={task.rejection_proof_photo_url}
                              alt="Rejection proof"
                              width={640}
                              height={480}
                              className="w-full max-w-sm rounded-lg border-2 border-destructive/50 object-cover"
                            />
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground">Room: {task.room_number}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Click X to acknowledge this rejection. The task will remain in your history for
                          record-keeping.
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {acknowledgedRejectedTasks.length > 0 && (
              <section>
                <h2 className="text-base md:text-lg font-semibold mb-3 text-muted-foreground">
                  📋 Acknowledged Rejections (Record)
                </h2>
                <p className="text-sm text-muted-foreground mb-3">
                  These tasks are kept for audit and training purposes
                </p>
                <div className="space-y-3">
                  {acknowledgedRejectedTasks.map((task) => (
                    <Card key={task.id} className="border-muted bg-muted/30 opacity-75">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
                            REJECTED
                          </Badge>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm mb-1">{task.task_type}</h3>
                            <p className="text-xs text-muted-foreground mb-1">
                              Room {task.room_number} • {task.supervisor_remark || "No reason provided"}
                            </p>
                            {task.rejection_acknowledged_at && (
                              <p className="text-xs text-muted-foreground">
                                Acknowledged{" "}
                                {formatDistanceToNow(task.rejection_acknowledged_at.client)}
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {homeInProgressTasks.length > 0 && (
              <section>
                <h2 className="text-base md:text-lg font-semibold mb-3">In Progress</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {homeInProgressTasks.map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                </div>
              </section>
            )}

            {homePendingTasks.length > 0 && (
              <section>
                <h2 className="text-base md:text-lg font-semibold mb-3">Pending Tasks</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {homePendingTasks.map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                </div>
              </section>
            )}

            {homeCompletedTasks.length > 0 && (
              <section>
                <h2 className="text-base md:text-lg font-semibold mb-3">Completed</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {homeCompletedTasks.map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                </div>
              </section>
            )}

            {nonRecurringTasks.length === 0 &&
              myActiveMaintenanceTasks.length === 0 &&
              partiallyCompletedRooms.length === 0 && (
              <div className="flex min-h-[400px] items-center justify-center">
                <div className="text-center space-y-2">
                  {recurringTasks.length > 0 ? (
                    <>
                      <p className="text-muted-foreground">Recurring tasks are ready in the Tasks tab.</p>
                      <p className="text-sm text-muted-foreground">
                        Tap "Tasks" below to start, pause, or complete your recurring work.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-muted-foreground">No tasks assigned</p>
                      {(completedTasks.length > 0 || myCompletedMaintenanceTasksForDisplay.length > 0) && (
                        <p className="text-sm text-muted-foreground">
                          You&apos;ve completed {completedTasks.length + myCompletedMaintenanceTasksForDisplay.length} task(s)
                          today
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </main>
        )
    }
  }

  return (
    <div className="flex flex-col h-screen bg-muted/30">
      <header className="border-b bg-background sticky top-0 z-40 shrink-0">
        <div className="container mx-auto flex items-center justify-between px-3 sm:px-4 py-3 sm:py-4 gap-2 sm:gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold truncate">
              {activeTab === "home"
                ? "My Tasks"
                : activeTab === "tasks"
                  ? "All Tasks"
                  : activeTab === "profile"
                    ? "Profile"
                    : "Schedule"}
            </h1>
            {activeTab !== "scheduled" && (
              <p className="text-xs sm:text-sm text-muted-foreground truncate">
                {user?.name}
                {departmentDisplay && (
                  <span className="ml-1 text-muted-foreground hidden sm:inline">- {departmentDisplay}</span>
                )}
                {(inProgressTasks.length > 0 || myActiveMaintenanceTasks.length > 0) && (
                  <span className="ml-2 text-accent font-medium">● Busy</span>
                )}
                {inProgressTasks.length === 0 && myActiveMaintenanceTasks.length === 0 && (
                  <span className="ml-2 text-muted-foreground">○ Available</span>
                )}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="min-h-[44px] min-w-[44px] px-2 sm:px-3 bg-transparent"
            >
              <LogOut className="h-4 w-4 sm:h-5 sm:w-5 sm:mr-2" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto pb-20">{renderContent()}</div>

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  )
}

export default function WorkerPage() {
  return (
    <ProtectedRoute allowedRoles={["worker", "front_office"]}>
      <WorkerDashboard />
    </ProtectedRoute>
  )
}
