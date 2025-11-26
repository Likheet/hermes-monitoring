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
import { LogOut, Bell, AlertCircle, X, Clock, CheckCircle2, XCircle, TrendingUp, ListTodo, Sparkles, Target, Calendar } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useRealtimeTasks } from "@/lib/use-realtime-tasks"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useCallback, useEffect, useMemo, useState, Suspense } from "react"
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
  const { tasks, dismissRejectedTask, maintenanceTasks, users, schedules } = useTasks()
  const router = useRouter()
  const searchParams = useSearchParams()
  useRealtimeTasks({
    enabled: true,
    filter: { userId: user?.id },
  })
  const [urgentTaskAlert, setUrgentTaskAlert] = useState<string | null>(null)
  
  // Get active tab from URL, default to "home"
  const activeTab = searchParams.get("tab") || "home"
  
  // Function to change tab via URL
  const setActiveTab = useCallback((tab: string) => {
    router.replace(`/worker?tab=${tab}`, { scroll: false })
  }, [router])

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

  const speedMetrics = completedTasks.reduce((acc, t) => {
    if (!t.actual_duration_minutes || !t.expected_duration_minutes || t.expected_duration_minutes === 0) return acc
    // Skip obvious bad data (actual < 1 minute or more than 10x expected)
    if (t.actual_duration_minutes < 1 || t.actual_duration_minutes > t.expected_duration_minutes * 10) return acc
    // Calculate percentage: (expected - actual) / expected * 100
    // Positive = faster, Negative = slower
    const percentDiff = ((t.expected_duration_minutes - t.actual_duration_minutes) / t.expected_duration_minutes) * 100
    return {
      totalPercent: acc.totalPercent + percentDiff,
      count: acc.count + 1
    }
  }, { totalPercent: 0, count: 0 })

  const rawSpeedPercent = speedMetrics.count > 0 ? speedMetrics.totalPercent / speedMetrics.count : 0
  // Cap the percentage between -100% and +100% for display
  const avgSpeedPercent = Math.max(-100, Math.min(100, rawSpeedPercent))
  const isFaster = avgSpeedPercent >= 0
  const hasSpeedData = speedMetrics.count > 0

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
          <main className="container mx-auto px-5 py-5 space-y-4 animate-in fade-in duration-500">
            <div className="flex gap-5 overflow-x-auto pb-2 -mx-5 px-5 scrollbar-hide border-b border-gray-100">
              {[
                { value: "all", label: "All" },
                { value: "active", label: "Active", count: myTasks.filter(t => ["PENDING", "IN_PROGRESS", "PAUSED"].includes(t.status)).length },
                { value: "recurring", label: "Recurring" },
                { value: "completed", label: "Past" },
                { value: "rejected", label: "Issues" },
              ].map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setTasksFilter(tab.value as typeof tasksFilter)}
                  className={cn(
                    "whitespace-nowrap pb-3 text-sm font-semibold transition-all relative flex items-center gap-1.5",
                    tasksFilter === tab.value
                      ? "text-black"
                      : "text-gray-400 hover:text-gray-600"
                  )}
                >
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className={cn(
                      "text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center",
                      tasksFilter === tab.value ? "bg-black text-white" : "bg-gray-200 text-gray-500"
                    )}>
                      {tab.count}
                    </span>
                  )}
                  {tasksFilter === tab.value && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-black rounded-full" />
                  )}
                </button>
              ))}
            </div>

            {filteredTasks.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                  <ListTodo className="w-5 h-5 text-gray-400" />
                </div>
                <p className="text-base font-semibold text-black mb-1">No tasks</p>
                <p className="text-sm text-gray-400">You don't have any tasks in this view.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTasks.map((task) => (
                <Card
                  key={task.id}
                  className="group relative overflow-hidden rounded-xl border-none shadow-sm bg-white hover:shadow-md transition-all duration-200 cursor-pointer active:scale-[0.99]"
                  onClick={() => router.push(`/worker/${task.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          {task.status === "IN_PROGRESS" && (
                            <Badge className="rounded-md px-2 py-0.5 bg-black text-white border-none font-medium text-[10px] tracking-wide uppercase">
                              In Progress
                            </Badge>
                          )}
                          {task.status === "PENDING" && (
                            <Badge variant="secondary" className="rounded-md px-2 py-0.5 bg-gray-100 text-gray-600 border-none font-medium text-[10px] tracking-wide uppercase">
                              Pending
                            </Badge>
                          )}
                          {task.status === "PAUSED" && (
                            <Badge variant="secondary" className="rounded-md px-2 py-0.5 bg-amber-100 text-amber-800 border-none font-medium text-[10px] tracking-wide uppercase">
                              Paused
                            </Badge>
                          )}
                          {task.status === "COMPLETED" && (
                            <Badge variant="secondary" className="rounded-md px-2 py-0.5 bg-gray-100 text-gray-500 border-none font-medium text-[10px] tracking-wide uppercase">
                              Completed
                            </Badge>
                          )}
                          {task.status === "REJECTED" && (
                            <Badge className="rounded-md px-2 py-0.5 bg-red-50 text-red-600 border-none font-medium text-[10px] tracking-wide uppercase">
                              Rejected
                            </Badge>
                          )}

                          {task.priority_level === "GUEST_REQUEST" && (
                            <Badge className="rounded-md px-2 py-0.5 bg-red-600 text-white border-none font-medium text-[10px] tracking-wide uppercase">
                              Urgent
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-baseline gap-2 mb-1">
                          <h3 className="text-xl font-bold text-black tracking-tight">
                            {task.room_number}
                          </h3>
                          <p className="text-sm text-gray-500 truncate">
                            {task.task_type}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                          <Clock className="h-3 w-3" />
                          <span>
                            {task.assigned_at
                              ? formatDistanceToNow(task.assigned_at.client)
                              : "Just now"}
                          </span>
                        </div>
                      </div>

                      <div className="h-9 w-9 rounded-full bg-gray-50 flex items-center justify-center shrink-0">
                        <TrendingUp className="h-4 w-4 text-gray-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
                ))}
              </div>
            )}
          </main>
        )

      case "profile":
        return (
          <main className="container mx-auto px-5 py-6 space-y-5 animate-in fade-in duration-500">
            {/* Profile Header */}
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 ring-2 ring-white shadow-md shrink-0">
                <AvatarFallback className="text-lg font-bold bg-black text-white">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-black truncate">{user?.name}</h2>
                <p className="text-sm text-gray-500 capitalize">{departmentDisplay} • {user?.role}</p>
                {user?.phone && (
                  <p className="text-xs text-gray-400 mt-0.5">{user.phone}</p>
                )}
              </div>
            </div>

            {/* Stats Grid - 2x2 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Tasks</p>
                <p className="text-2xl font-bold text-black tabular-nums mt-1">{totalAssignments}</p>
                <p className="text-[10px] text-gray-400">{totalCompletedAssignments} done</p>
              </div>

              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">On Time</p>
                <p className="text-2xl font-bold text-black tabular-nums mt-1">{onTimeRate}%</p>
                <p className="text-[10px] text-gray-400">completion</p>
              </div>

              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Speed</p>
                {hasSpeedData ? (
                  <>
                    <p className={cn("text-2xl font-bold tabular-nums mt-1", isFaster ? "text-green-600" : "text-red-600")}>
                      {isFaster ? "+" : ""}{Math.round(avgSpeedPercent)}%
                    </p>
                    <p className="text-[10px] text-gray-400">{isFaster ? "faster" : "slower"}</p>
                  </>
                ) : (
                  <>
                    <p className="text-2xl font-bold text-gray-300 mt-1">—</p>
                    <p className="text-[10px] text-gray-400">no data</p>
                  </>
                )}
              </div>

              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Rating</p>
                <p className="text-2xl font-bold text-black tabular-nums mt-1">{avgRating}</p>
                <p className="text-[10px] text-gray-400">average</p>
              </div>
            </div>

            {/* Quality Score */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-black">Quality Score</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {rejectedThisMonth === 0 ? "No issues this month" : `${quotaRemaining} remaining`}
                  </p>
                </div>
                <div className="flex items-baseline gap-0.5">
                  <span className={cn(
                    "text-2xl font-bold tabular-nums",
                    rejectedThisMonth === 0 ? "text-green-600" : 
                    rejectedThisMonth >= REJECTION_QUOTA ? "text-red-600" : "text-black"
                  )}>
                    {rejectedThisMonth}
                  </span>
                  <span className="text-sm text-gray-400">/{REJECTION_QUOTA}</span>
                </div>
              </div>
              <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden mt-3">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    rejectedThisMonth === 0 ? "bg-green-500" : 
                    rejectedThisMonth >= REJECTION_QUOTA ? "bg-red-500" : "bg-black"
                  )}
                  style={{ width: `${Math.max(Math.min((rejectedThisMonth / REJECTION_QUOTA) * 100, 100), rejectedThisMonth === 0 ? 0 : 8)}%` }}
                />
              </div>
            </div>

            {/* Recent Activity */}
            {canAccessMaintenance && myCompletedMaintenanceTasksForDisplay.length > 0 && (
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-1">Recent Activity</p>
                <div className="space-y-2">
                  {myCompletedMaintenanceTasksForDisplay
                    .sort((a, b) => {
                      const aReference = a.completed_at ?? a.started_at ?? a.created_at
                      const bReference = b.completed_at ?? b.started_at ?? b.created_at
                      const aTime = new Date(aReference ?? a.created_at).getTime()
                      const bTime = new Date(bReference ?? b.created_at).getTime()
                      return bTime - aTime
                    })
                    .slice(0, 5)
                    .map((task) => {
                      const roomTasks = maintenanceTasksForDisplay.filter((t) => t.room_number === task.room_number)
                      const completedCount = roomTasks.filter((t) => t.status === "completed").length

                      return (
                        <div
                          key={task.id}
                          className="flex items-center gap-4 p-4 bg-white rounded-xl cursor-pointer hover:bg-gray-50 transition-colors"
                          onClick={() => router.push(`/worker/maintenance/${task.room_number}`)}
                        >
                          <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                            <CheckCircle2 className="h-5 w-5 text-black" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-black truncate">Room {task.room_number}</p>
                            <p className="text-xs text-gray-400 truncate">{getMaintenanceTaskLabel(task)}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs font-medium text-gray-500">{completedCount}/{roomTasks.length}</p>
                            {task.completed_at && (
                              <p className="text-[10px] text-gray-400">{formatDistanceToNow(task.completed_at)}</p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                </div>
              </div>
            )}
          </main>
        )

      case "scheduled":
        if (!canAccessMaintenance) {
          return (
            <main className="container mx-auto px-4 py-6 space-y-4 animate-in fade-in duration-300">
              <Card className="rounded-3xl border-2 border-dashed border-border">
                <CardContent className="p-10 text-center">
                  <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                    <Calendar className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <p className="text-lg font-medium text-foreground mb-2">No Scheduled Tasks</p>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                    Scheduled maintenance is only available when you have maintenance tasks assigned.
                  </p>
                </CardContent>
              </Card>
            </main>
          )
        }
        return (
          <main className="container mx-auto px-4 py-6 animate-in fade-in duration-300">
            <MaintenanceCalendar
              onRoomClick={handleRoomClick}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              tasks={maintenanceTasksForDisplay}
              schedules={schedules}
            />
          </main>
        )

      case "home":
      default:
        return (
          <main className="container mx-auto px-6 py-6 space-y-6 animate-in fade-in duration-500">
            {recurringTasks.length > 0 && (
              <Alert className="border-l-4 border-black bg-white shadow-sm rounded-r-xl rounded-l-none">
                <ListTodo className="h-5 w-5 text-black" />
                <AlertDescription className="text-black font-medium">
                  You have {recurringTasks.length} recurring {recurringTasks.length === 1 ? 'task' : 'tasks'} waiting.
                </AlertDescription>
              </Alert>
            )}

            {canAccessMaintenance && currentMaintenanceTask && currentMaintenanceTask.room_number && (
              <Card
                className="cursor-pointer border-none shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] bg-black text-white transition-all hover:scale-[1.01] active:scale-[0.99] rounded-xl overflow-hidden"
                onClick={() => handleNavigateToMaintenanceTask(currentMaintenanceTask)}
              >
                <CardContent className="p-6 flex flex-col gap-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-4">
                        <Badge
                          className={cn(
                            "text-xs font-bold px-2 py-1 rounded-md uppercase tracking-wider",
                            currentMaintenanceTask.status === "in_progress" 
                              ? "bg-white text-black" 
                              : "bg-gray-800 text-gray-300"
                          )}
                        >
                          {currentMaintenanceTask.status === "in_progress" ? "In Progress" : "Paused"}
                        </Badge>
                      </div>
                      <h2 className="text-3xl font-bold text-white mb-1">
                        {getMaintenanceTaskLabel(currentMaintenanceTask)}
                      </h2>
                      <p className="text-lg font-medium text-gray-400">
                        Room {currentMaintenanceTask.room_number}
                        {currentMaintenanceTask.location && ` • ${currentMaintenanceTask.location}`}
                      </p>
                      {(() => {
                        const timestamp = getPrimaryMaintenanceTimestamp(currentMaintenanceTask)
                        if (!timestamp) return null

                        const date = new Date(timestamp)
                        if (Number.isNaN(date.getTime())) return null

                        return (
                          <p className="text-sm text-gray-500 mt-3 flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            {currentMaintenanceTask.status === "paused" ? "Paused" : "Started"}{" "}
                            {formatDistanceToNow(date)}
                          </p>
                        )
                      })()}
                    </div>
                  </div>

                  <Button size="lg" className="w-full font-bold text-base h-12 rounded-lg bg-white text-black hover:bg-gray-200 border-none">
                    {currentMaintenanceTask.status === "in_progress" ? "Continue Task" : "Resume Task"}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Progress card showing task completion */}
            {canAccessMaintenance && maintenanceTasksForDisplay.length > 0 && (
              <Card className="rounded-xl border-none shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] bg-white overflow-hidden">
                <CardContent className="p-6 flex items-center justify-between gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h2 className="text-sm font-bold text-black uppercase tracking-wider">
                        Monthly Goal
                      </h2>
                    </div>
                    <div className="mb-4">
                      <div className="flex items-baseline gap-1 mb-1">
                        <span className="text-4xl font-bold text-black tabular-nums">
                          {completedMaintenanceTasksForDisplay.length}
                        </span>
                        <span className="text-lg text-gray-400">
                          / {maintenanceTasksForDisplay.length}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 font-medium">
                        tasks completed
                      </p>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-black rounded-full transition-all duration-700 ease-out"
                        style={{ width: `${maintenanceProgressPercentage}%` }}
                      />
                    </div>
                  </div>

                  <div className="relative h-20 w-20 shrink-0">
                    <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                      <path
                        className="text-gray-100"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                      <path
                        className="text-black transition-all duration-1000 ease-out"
                        strokeDasharray={`${maintenanceProgressPercentage}, 100`}
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-sm font-bold text-black">{maintenanceProgressPercentage}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {canAccessMaintenance && Object.keys(activeMaintenanceByRoom).length > 0 && (
              <section>
                <h2 className="text-lg font-bold mb-4 px-1 flex items-center gap-2 text-black">
                  Active Rooms
                </h2>
                <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 -mx-6 px-6 scrollbar-hide">
                  {Object.entries(activeMaintenanceByRoom).map(([roomNumber, tasks]) => {
                    const inProgressCount = tasks.filter((t) => t.status === "in_progress").length
                    const pausedCount = tasks.filter((t) => t.status === "paused").length

                    return (
                      <Card
                        key={roomNumber}
                        className="snap-center shrink-0 w-[85vw] max-w-[320px] rounded-xl border-none shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] bg-white cursor-pointer active:scale-[0.98] transition-all hover:shadow-md"
                        onClick={() => router.push(`/worker/maintenance/${roomNumber}`)}
                      >
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between mb-6">
                            <div>
                              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Room</p>
                              <h3 className="text-3xl font-bold text-black">
                                {roomNumber}
                              </h3>
                            </div>
                            <div className="h-10 w-10 rounded-full bg-gray-50 flex items-center justify-center">
                              <Clock className="h-5 w-5 text-black" />
                            </div>
                          </div>

                          <div className="space-y-3 mb-6">
                            {tasks.slice(0, 3).map((task) => (
                              <div key={task.id} className="flex items-center gap-3 text-sm">
                                {task.status === "in_progress" ? (
                                  <div className="h-2 w-2 rounded-full bg-black animate-pulse" />
                                ) : (
                                  <div className="h-2 w-2 rounded-full bg-gray-300" />
                                )}
                                <span className="truncate font-medium text-gray-700">
                                  {task.task_type === "ac_indoor"
                                    ? "AC Indoor"
                                    : task.task_type === "ac_outdoor"
                                      ? "AC Outdoor"
                                      : task.task_type === "fan"
                                        ? "Fan"
                                        : "Exhaust"}
                                </span>
                              </div>
                            ))}
                            {tasks.length > 3 && (
                              <p className="text-xs text-gray-400 pl-5 font-medium">
                                +{tasks.length - 3} more tasks
                              </p>
                            )}
                          </div>

                          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                            <div className="flex gap-2">
                              <span className="text-xs font-medium text-gray-500">
                                {tasks.length} tasks total
                              </span>
                            </div>
                            <span className="text-black font-bold text-sm">
                              View
                            </span>
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
                <h2 className="text-base md:text-lg font-semibold mb-3 text-red-600">
                  Action Required
                </h2>
                <div className="space-y-4">
                  {unacknowledgedRejectedTasks.map((task) => (
                    <Card key={task.id} className="border-l-4 border-red-500 bg-white shadow-sm rounded-r-xl rounded-l-none">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 flex-1">
                            <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                            <CardTitle className="text-lg text-black">{task.task_type}</CardTitle>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDismissRejection(task.id)}
                            className="h-8 w-8 text-gray-400 hover:text-black"
                            title="Acknowledge rejection"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <p className="text-sm font-medium text-red-600">
                          {task.supervisor_remark || "No reason provided"}
                        </p>
                        {task.rejection_proof_photo_url && (
                          <div className="mt-2">
                            <TaskImage
                              src={task.rejection_proof_photo_url}
                              alt="Rejection proof"
                              width={640}
                              height={480}
                              className="w-full max-w-sm rounded-lg border border-gray-200 object-cover"
                            />
                          </div>
                        )}
                        <p className="text-xs text-gray-400">Room: {task.room_number}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {acknowledgedRejectedTasks.length > 0 && (
              <section>
                <h2 className="text-base md:text-lg font-semibold mb-3 text-gray-400">
                  History
                </h2>
                <div className="space-y-3">
                  {acknowledgedRejectedTasks.map((task) => (
                    <Card key={task.id} className="border-none bg-gray-50 opacity-75 rounded-xl">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <Badge variant="outline" className="bg-white text-gray-500 border-gray-200 text-[10px]">
                            REJECTED
                          </Badge>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm mb-1 text-gray-700">{task.task_type}</h3>
                            <p className="text-xs text-gray-400 mb-1">
                              Room {task.room_number}
                            </p>
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
                <h2 className="text-lg font-bold mb-3 text-black">In Progress</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {homeInProgressTasks.map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                </div>
              </section>
            )}

            {homePendingTasks.length > 0 && (
              <section>
                <h2 className="text-lg font-bold mb-3 text-black">Pending</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {homePendingTasks.map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                </div>
              </section>
            )}

            {homeCompletedTasks.length > 0 && (
              <section>
                <h2 className="text-lg font-bold mb-3 text-black">Completed</h2>
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
                  <div className="text-center space-y-4 max-w-sm mx-auto">
                    <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-2">
                      {recurringTasks.length > 0 ? (
                        <ListTodo className="w-8 h-8 text-gray-400" />
                      ) : (
                        <CheckCircle2 className="w-8 h-8 text-black" />
                      )}
                    </div>
                    {recurringTasks.length > 0 ? (
                      <>
                        <p className="text-lg font-bold text-black">Recurring tasks ready</p>
                        <p className="text-sm text-gray-500">
                          Check the Tasks tab to continue.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-lg font-bold text-black">All caught up</p>
                        {(completedTasks.length > 0 || myCompletedMaintenanceTasksForDisplay.length > 0) && (
                          <p className="text-sm text-gray-500">
                            You've completed <span className="font-bold text-black">{completedTasks.length + myCompletedMaintenanceTasksForDisplay.length}</span> tasks today.
                          </p>
                        )}
                        {completedTasks.length === 0 && myCompletedMaintenanceTasksForDisplay.length === 0 && (
                          <p className="text-sm text-gray-500">
                            No tasks assigned yet.
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
    <div className="flex flex-col h-screen bg-[#F6F6F6]">
      {activeTab === "home" && (
        <header className="bg-white sticky top-0 z-40 shrink-0 border-b border-gray-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)]">
          <div className="container mx-auto flex items-center justify-between px-6 py-5">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-black">
                Hi, {user?.name?.split(" ")[0]}
              </h1>
              <p className="text-sm text-gray-500 mt-1 font-medium">
                {inProgressTasks.length > 0 || myActiveMaintenanceTasks.length > 0 
                  ? "You have active tasks" 
                  : "You are online"}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="rounded-full h-10 w-10 hover:bg-gray-50 text-gray-400 hover:text-gray-600 transition-all duration-200"
              title="Logout"
            >
              <LogOut className="h-[18px] w-[18px]" />
            </Button>
          </div>
        </header>
      )}

      <div className={`flex-1 overflow-y-auto pb-24 ${activeTab !== "home" ? "pt-6" : ""}`}>{renderContent()}</div>

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  )
}

export default function WorkerPage() {
  return (
    <ProtectedRoute allowedRoles={["worker", "front_office"]}>
      <Suspense fallback={<div className="flex h-screen items-center justify-center bg-[#F6F6F6]"><div className="animate-pulse text-gray-400">Loading...</div></div>}>
        <WorkerDashboard />
      </Suspense>
    </ProtectedRoute>
  )
}
