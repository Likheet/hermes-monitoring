"use client"

import { ProtectedRoute } from "@/components/protected-route"
import { useAuth } from "@/lib/auth-context"
import { useTasks } from "@/lib/task-context"
import { StatsCard } from "@/components/stats-card"
import { WorkerStatusCard } from "@/components/worker-status-card"
import { WorkerProfileDialog } from "@/components/worker-profile-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  LogOut,
  ClipboardList,
  Clock,
  CheckCircle,
  AlertTriangle,
  Users,
  TrendingUp,
  Activity,
  UserPlus,
  Calendar,
  CalendarRange,
  Star,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useRealtimeTasks } from "@/lib/use-realtime-tasks"
import { ConnectionStatus } from "@/components/connection-status"
import Link from "next/link"
import { CATEGORY_LABELS } from "@/lib/task-definitions"
import { useState } from "react"
import type { User } from "@/lib/types"

function AdminDashboard() {
  const { user, logout } = useAuth()
  const { tasks, users, maintenanceTasks } = useTasks()
  const router = useRouter()
  const { isConnected } = useRealtimeTasks({ enabled: true })

  const [timeRange, setTimeRange] = useState<"week" | "month" | "all" | "custom">("all")
  const [customStartDate, setCustomStartDate] = useState("")
  const [customEndDate, setCustomEndDate] = useState("")
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false)
  const [selectedWorker, setSelectedWorker] = useState<User | null>(null)
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false)

  const handleLogout = () => {
    logout()
    router.push("/login")
  }

  const handleWorkerClick = (worker: User) => {
    setSelectedWorker(worker)
    setIsProfileDialogOpen(true)
  }

  const workers = users.filter((u) => u.role === "worker")

  const getFilteredTasks = () => {
    const now = new Date()
    let startDate: Date

    switch (timeRange) {
      case "week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case "month":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case "custom":
        if (customStartDate && customEndDate) {
          const start = new Date(customStartDate)
          const end = new Date(customEndDate)
          return tasks.filter((t) => {
            const taskDate = new Date(t.assigned_at.client)
            return taskDate >= start && taskDate <= end
          })
        }
        return tasks
      case "all":
      default:
        return tasks
    }

    return tasks.filter((t) => {
      const taskDate = new Date(t.assigned_at.client)
      return taskDate >= startDate
    })
  }

  const filteredTasks = getFilteredTasks()

  const totalTasks = filteredTasks.length
  const pendingTasks = filteredTasks.filter((t) => t.status === "PENDING").length
  const inProgressTasks = filteredTasks.filter((t) => t.status === "IN_PROGRESS").length
  const completedTasks = filteredTasks.filter((t) => t.status === "COMPLETED").length
  const rejectedTasks = filteredTasks.filter((t) => t.status === "REJECTED").length

  const completedTasksWithDuration = filteredTasks.filter((t) => t.status === "COMPLETED" && t.actual_duration_minutes)
  const avgCompletionTime =
    completedTasksWithDuration.length > 0
      ? Math.round(
          completedTasksWithDuration.reduce((sum, t) => sum + (t.actual_duration_minutes || 0), 0) /
            completedTasksWithDuration.length,
        )
      : 0

  const overtimeTasks = completedTasksWithDuration.filter(
    (t) => (t.actual_duration_minutes || 0) > t.expected_duration_minutes,
  ).length

  const getWorkerCurrentTask = (workerId: string) => {
    const regularTask = tasks.find(
      (t) => t.assigned_to_user_id === workerId && (t.status === "IN_PROGRESS" || t.status === "PAUSED"),
    )
    if (regularTask) return regularTask

    const maintenanceTask = (maintenanceTasks || []).find(
      (t) => t.assigned_to === workerId && (t.status === "in_progress" || t.status === "paused"),
    )
    return maintenanceTask
  }

  const getWorkerStats = (workerId: string) => {
    const workerTasks = filteredTasks.filter((t) => t.assigned_to_user_id === workerId)
    const workerMaintenanceTasks = (maintenanceTasks || []).filter((t) => t.assigned_to === workerId)

    return {
      totalTasks: workerTasks.length + workerMaintenanceTasks.length,
      completedTasks:
        workerTasks.filter((t) => t.status === "COMPLETED").length +
        workerMaintenanceTasks.filter((t) => t.status === "completed").length,
      rejectedTasks:
        workerTasks.filter((t) => t.status === "REJECTED").length +
        workerMaintenanceTasks.filter((t) => t.status === "rejected").length,
      inProgressTasks:
        workerTasks.filter((t) => t.status === "IN_PROGRESS").length +
        workerMaintenanceTasks.filter((t) => t.status === "in_progress").length,
    }
  }

  const availableWorkers = workers.filter((w) => !getWorkerCurrentTask(w.id))
  const busyWorkers = workers.filter((w) => getWorkerCurrentTask(w.id))

  const allAuditLogs = filteredTasks
    .flatMap((task) =>
      task.audit_log.map((log) => ({
        ...log,
        taskId: task.id,
        taskType: task.task_type,
      })),
    )
    .sort((a, b) => new Date(b.timestamp.client).getTime() - new Date(a.timestamp.client).getTime())
    .slice(0, 20)

  const getUserName = (userId: string) => {
    return users.find((u) => u.id === userId)?.name || "Unknown"
  }

  const customTasks = filteredTasks.filter(
    (t) =>
      !t.custom_task_processed &&
      (t.is_custom_task ||
        t.custom_task_name ||
        t.task_type === "Other (Custom Task)" ||
        t.task_type.startsWith("[CUSTOM]")),
  )

  console.log("[v0] Admin dashboard - Custom tasks found:", {
    total: customTasks.length,
    taskTypes: customTasks.map((t) => t.task_type),
    allTaskTypes: filteredTasks.map((t) => t.task_type),
  })

  const recentCustomTasks = customTasks.slice(0, 10)

  const calculateWorkerPerformance = (workerId: string) => {
    const worker = users.find((u) => u.id === workerId)
    if (!worker) return null

    const [startHour, startMin] = worker.shift_start.split(":").map(Number)
    const [endHour, endMin] = worker.shift_end.split(":").map(Number)
    const shiftMinutes = endHour * 60 + endMin - (startHour * 60 + startMin)
    const shiftHours = (shiftMinutes / 60).toFixed(1)

    const workerCompletedTasks = filteredTasks.filter(
      (t) => t.assigned_to_user_id === workerId && t.status === "COMPLETED",
    )
    const workerCompletedMaintenanceTasks = (maintenanceTasks || []).filter(
      (t) => t.assigned_to === workerId && t.status === "completed",
    )

    const totalWorkMinutes =
      workerCompletedTasks.reduce((sum, t) => sum + (t.actual_duration_minutes || 0), 0) +
      workerCompletedMaintenanceTasks.reduce((sum, t) => sum + (t.duration || 0), 0)
    const actualWorkHours = (totalWorkMinutes / 60).toFixed(1)

    const idleMinutes = shiftMinutes - totalWorkMinutes
    const idleHours = (idleMinutes / 60).toFixed(1)

    const discrepancyPercent = shiftMinutes > 0 ? ((idleMinutes / shiftMinutes) * 100).toFixed(1) : "0.0"

    const ratedTasks = workerCompletedTasks.filter((t) => t.rating && t.rating > 0)
    const avgRating =
      ratedTasks.length > 0
        ? (ratedTasks.reduce((sum, t) => sum + (t.rating || 0), 0) / ratedTasks.length).toFixed(1)
        : "N/A"
    const totalRatings = ratedTasks.length

    return {
      shiftHours,
      actualWorkHours,
      idleHours,
      discrepancyPercent,
      avgRating,
      totalRatings,
    }
  }

  const discrepancyTasks = filteredTasks.filter((t) => {
    const isOvertime =
      t.status === "COMPLETED" && t.actual_duration_minutes && t.actual_duration_minutes > t.expected_duration_minutes

    const isRejected = t.status === "REJECTED"

    const isLowRated = t.status === "COMPLETED" && t.rating && t.rating < 3

    return isOvertime || isRejected || isLowRated
  })

  const reworkTasks = discrepancyTasks.filter((t) => t.status === "REJECTED").length
  const avgOvertime =
    discrepancyTasks.length > 0
      ? discrepancyTasks
          .filter((t) => t.actual_duration_minutes && t.actual_duration_minutes > t.expected_duration_minutes)
          .reduce((sum, t) => {
            const overtime =
              ((t.actual_duration_minutes! - t.expected_duration_minutes) / t.expected_duration_minutes) * 100
            return sum + overtime
          }, 0) /
        discrepancyTasks.filter(
          (t) => t.actual_duration_minutes && t.actual_duration_minutes > t.expected_duration_minutes,
        ).length
      : 0

  const getRatingColor = (rating: number) => {
    if (rating >= 4) return "text-green-600"
    if (rating >= 3) return "text-yellow-600"
    return "text-red-600"
  }

  return (
    <div className="min-h-screen bg-background">
      <WorkerProfileDialog worker={selectedWorker} open={isProfileDialogOpen} onOpenChange={setIsProfileDialogOpen} />

      <header className="border-b bg-card sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
              <p className="text-sm text-muted-foreground mt-0.5">{user?.name}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <ConnectionStatus isConnected={isConnected} />
              <Button variant="ghost" size="sm" onClick={handleLogout} className="min-h-[44px]">
                <LogOut className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            <Link href="/admin/add-worker">
              <Button size="sm" className="min-h-[44px] whitespace-nowrap">
                <UserPlus className="mr-2 h-4 w-4" />
                Add Worker
              </Button>
            </Link>
            <Link href="/admin/task-management">
              <Button variant="outline" size="sm" className="min-h-[44px] whitespace-nowrap bg-transparent">
                <ClipboardList className="mr-2 h-4 w-4" />
                Task Management
              </Button>
            </Link>
            <Link href="/admin/maintenance-schedule">
              <Button variant="outline" size="sm" className="min-h-[44px] whitespace-nowrap bg-transparent">
                <Calendar className="mr-2 h-4 w-4" />
                Maintenance
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-8">
        {recentCustomTasks.length > 0 && (
          <Card className="border-l-4 border-l-accent">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-accent" />
                <CardTitle className="text-lg">Custom Task Requests ({customTasks.length})</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentCustomTasks.map((task) => {
                  const displayName = task.custom_task_name || task.task_type
                  const categoryLabel =
                    task.custom_task_category && CATEGORY_LABELS[task.custom_task_category]
                      ? CATEGORY_LABELS[task.custom_task_category]
                      : "Custom Request"
                  const displayPriority = task.custom_task_priority
                    ? task.custom_task_priority.toUpperCase()
                    : task.priority_level.replace(/_/g, " ")

                  return (
                    <div
                      key={task.id}
                      className="flex items-start justify-between p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                    >
                      <div className="flex-1 space-y-1">
                        <p className="font-medium">{displayName}</p>
                        <p className="text-sm text-muted-foreground">
                          {task.room_number && `Room ${task.room_number} • `}
                          {task.department} • {categoryLabel}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Priority: {displayPriority} • Created by {getUserName(task.assigned_by_user_id)}
                        </p>
                        {task.worker_remark && (
                          <p className="text-xs text-muted-foreground italic mt-1">"{task.worker_remark}"</p>
                        )}
                      </div>
                      <Link href="/admin/task-management">
                        <Button size="sm" variant="outline">
                          Review
                        </Button>
                      </Link>
                    </div>
                  )
                })}
                {customTasks.length > 10 && (
                  <Link href="/admin/task-management" className="block">
                    <Button variant="link" className="w-full">
                      View all {customTasks.length} custom tasks →
                    </Button>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">System Overview</h2>
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <StatsCard title="Total Tasks" value={totalTasks} icon={ClipboardList} />
            <StatsCard
              title="In Progress"
              value={inProgressTasks}
              icon={Activity}
              description={`${pendingTasks} pending`}
            />
            <StatsCard
              title="Completed"
              value={completedTasks}
              icon={CheckCircle}
              description={`${rejectedTasks} rejected`}
            />
            <StatsCard
              title="Avg Completion"
              value={`${avgCompletionTime} min`}
              icon={Clock}
              description={`${overtimeTasks} overtime`}
            />
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Worker Status</h2>
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <StatsCard
              title="Available Workers"
              value={availableWorkers.length}
              icon={Users}
              description={`${busyWorkers.length} busy`}
            />
            <StatsCard
              title="Housekeeping"
              value={workers.filter((w) => w.department === "housekeeping").length}
              icon={Users}
            />
            <StatsCard
              title="Maintenance"
              value={workers.filter((w) => w.department === "maintenance").length}
              icon={Users}
            />
            <StatsCard
              title="Efficiency"
              value={`${Math.round((completedTasks / totalTasks) * 100)}%`}
              icon={TrendingUp}
            />
          </div>
        </section>

        <Tabs defaultValue="workers" className="space-y-6">
          <TabsList className="w-full justify-start overflow-x-auto bg-muted/50">
            <TabsTrigger value="workers" className="whitespace-nowrap">
              Staff
            </TabsTrigger>
            <TabsTrigger value="audit" className="whitespace-nowrap">
              Audit Logs
            </TabsTrigger>
            <TabsTrigger value="discrepancy" className="whitespace-nowrap">
              Discrepancy
              {discrepancyTasks.length > 0 && (
                <Badge variant="destructive" className="ml-2 text-xs">
                  {discrepancyTasks.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="custom" className="whitespace-nowrap">
              Custom Tasks
              {customTasks.length > 0 && <Badge className="ml-2 text-xs">{customTasks.length}</Badge>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="workers" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <CardTitle>Staff Performance Overview</CardTitle>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <CalendarRange className="h-4 w-4 text-muted-foreground shrink-0" />
                    <select
                      value={timeRange}
                      onChange={(e) => {
                        const value = e.target.value as "week" | "month" | "all" | "custom"
                        setTimeRange(value)
                        if (value === "custom") {
                          setShowCustomDatePicker(true)
                        } else {
                          setShowCustomDatePicker(false)
                        }
                      }}
                      className="flex-1 sm:flex-none px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring min-h-[44px]"
                    >
                      <option value="week">This Week</option>
                      <option value="month">This Month</option>
                      <option value="all">All Time</option>
                      <option value="custom">Custom Range</option>
                    </select>
                  </div>
                </div>
                {showCustomDatePicker && (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-3">
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="flex-1 px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring min-h-[44px]"
                    />
                    <span className="text-sm text-muted-foreground text-center sm:text-left">to</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="flex-1 px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring min-h-[44px]"
                    />
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="font-semibold">Worker Name</TableHead>
                        <TableHead className="text-right font-semibold">Shift Hrs</TableHead>
                        <TableHead className="text-right font-semibold">Worked</TableHead>
                        <TableHead className="text-right font-semibold">Idle Time</TableHead>
                        <TableHead className="text-right font-semibold">Discrepancy</TableHead>
                        <TableHead className="text-right font-semibold">Rating</TableHead>
                        <TableHead className="text-center font-semibold">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {workers.map((worker) => {
                        const performance = calculateWorkerPerformance(worker.id)
                        const currentTask = getWorkerCurrentTask(worker.id)
                        const stats = getWorkerStats(worker.id)

                        if (!performance) return null

                        return (
                          <TableRow key={worker.id} className="hover:bg-muted/50">
                            <TableCell>
                              <div>
                                <p className="font-medium">{worker.name}</p>
                                <p className="text-xs text-muted-foreground capitalize">{worker.department}</p>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">{performance.shiftHours}h</TableCell>
                            <TableCell className="text-right text-green-600 font-medium">
                              {performance.actualWorkHours}h
                            </TableCell>
                            <TableCell className="text-right text-orange-600">{performance.idleHours}h</TableCell>
                            <TableCell className="text-right">
                              <span
                                className={`font-medium ${
                                  Number.parseFloat(performance.discrepancyPercent) > 50
                                    ? "text-red-600"
                                    : Number.parseFloat(performance.discrepancyPercent) > 30
                                      ? "text-orange-600"
                                      : "text-green-600"
                                }`}
                              >
                                {performance.discrepancyPercent}%
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              {performance.avgRating !== "N/A" ? (
                                <span className="font-medium">
                                  {performance.avgRating} ⭐
                                  <span className="text-xs text-muted-foreground ml-1">
                                    ({performance.totalRatings})
                                  </span>
                                </span>
                              ) : (
                                <span className="text-muted-foreground">N/A</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant={currentTask ? "default" : "secondary"} className="text-xs">
                                {currentTask ? "Working" : "Available"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Available Workers</CardTitle>
              </CardHeader>
              <CardContent>
                {availableWorkers.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {availableWorkers.map((worker) => (
                      <WorkerStatusCard key={worker.id} worker={worker} onClick={() => handleWorkerClick(worker)} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">No workers available</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Busy Workers</CardTitle>
              </CardHeader>
              <CardContent>
                {busyWorkers.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {busyWorkers.map((worker) => (
                      <WorkerStatusCard
                        key={worker.id}
                        worker={worker}
                        currentTask={getWorkerCurrentTask(worker.id)}
                        onClick={() => handleWorkerClick(worker)}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">No workers currently busy</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit">
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {allAuditLogs.map((log, index) => (
                    <div key={index}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1 flex-1">
                          <p className="font-medium">{log.action.replace(/_/g, " ")}</p>
                          <p className="text-sm text-muted-foreground">{log.details}</p>
                          <p className="text-xs text-muted-foreground">
                            {log.taskType} • by {getUserName(log.user_id)}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(log.timestamp.client).toLocaleString()}
                        </span>
                      </div>
                      {index < allAuditLogs.length - 1 && <Separator className="mt-4" />}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="discrepancy">
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Discrepancies</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{discrepancyTasks.length}</div>
                    <p className="text-xs text-muted-foreground mt-1">Tasks requiring attention</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Rework Tasks</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{reworkTasks}</div>
                    <p className="text-xs text-muted-foreground mt-1">Rejected and reassigned</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Avg Overtime</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold flex items-center gap-2">
                      <Clock className="h-6 w-6 text-orange-500" />
                      {avgOvertime.toFixed(1)}%
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Above expected time</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Discrepancy Jobs Report</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="font-semibold">Task Type</TableHead>
                          <TableHead className="font-semibold">Room</TableHead>
                          <TableHead className="font-semibold">Worker</TableHead>
                          <TableHead className="text-right font-semibold">Expected</TableHead>
                          <TableHead className="text-right font-semibold">Actual</TableHead>
                          <TableHead className="text-right font-semibold">Overtime</TableHead>
                          <TableHead className="text-right font-semibold">Rating</TableHead>
                          <TableHead className="font-semibold">Issues</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {discrepancyTasks.length > 0 ? (
                          discrepancyTasks.map((task) => {
                            const isOvertime =
                              task.status === "COMPLETED" &&
                              task.actual_duration_minutes &&
                              task.actual_duration_minutes > task.expected_duration_minutes
                            const isRejected = task.status === "REJECTED"
                            const isLowRated = task.status === "COMPLETED" && task.rating && task.rating < 3

                            const overtimePercent = isOvertime
                              ? (
                                  ((task.actual_duration_minutes! - task.expected_duration_minutes) /
                                    task.expected_duration_minutes) *
                                  100
                                ).toFixed(0)
                              : "0"

                            return (
                              <TableRow key={task.id} className="hover:bg-muted/50">
                                <TableCell className="font-medium">{task.task_type}</TableCell>
                                <TableCell>{task.room_number}</TableCell>
                                <TableCell>{getUserName(task.assigned_to_user_id)}</TableCell>
                                <TableCell className="text-right">{task.expected_duration_minutes}m</TableCell>
                                <TableCell className="text-right">
                                  {task.actual_duration_minutes ? `${task.actual_duration_minutes}m` : "-"}
                                </TableCell>
                                <TableCell className="text-right">
                                  {isOvertime ? (
                                    <div className="flex items-center justify-end gap-2">
                                      {Number.parseInt(overtimePercent) > 50 && (
                                        <AlertTriangle className="h-4 w-4 text-red-500" />
                                      )}
                                      <span
                                        className={
                                          Number.parseInt(overtimePercent) > 50
                                            ? "text-red-600 font-medium"
                                            : Number.parseInt(overtimePercent) > 20
                                              ? "text-orange-600 font-medium"
                                              : "text-yellow-600"
                                        }
                                      >
                                        +{overtimePercent}%
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  {task.rating ? (
                                    <div className="flex items-center justify-end gap-1">
                                      <Star className={`h-4 w-4 ${getRatingColor(task.rating)}`} />
                                      <span className={getRatingColor(task.rating)}>{task.rating}</span>
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-1 flex-wrap">
                                    {isRejected && (
                                      <Badge variant="destructive" className="text-xs">
                                        Rework
                                      </Badge>
                                    )}
                                    {isLowRated && (
                                      <Badge variant="outline" className="text-xs text-orange-600 border-orange-600">
                                        Low Quality
                                      </Badge>
                                    )}
                                    {isOvertime && Number.parseInt(overtimePercent) > 50 && (
                                      <Badge variant="outline" className="text-xs text-red-600 border-red-600">
                                        Excessive Time
                                      </Badge>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            )
                          })
                        ) : (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                              No discrepancy jobs found for the selected period
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="custom">
            <Card>
              <CardHeader>
                <CardTitle>Custom Task Requests</CardTitle>
              </CardHeader>
              <CardContent>
                {customTasks.length > 0 ? (
                  <div className="space-y-4">
                    {customTasks.map((task, index) => {
                      const displayName = task.custom_task_name || task.task_type
                      const categoryLabel =
                        task.custom_task_category && CATEGORY_LABELS[task.custom_task_category]
                          ? CATEGORY_LABELS[task.custom_task_category]
                          : "Custom Request"
                      const displayPriority = task.custom_task_priority
                        ? task.custom_task_priority.toUpperCase()
                        : task.priority_level.replace(/_/g, " ")

                      return (
                        <div key={task.id}>
                          <div className="flex items-start justify-between gap-4">
                            <div className="space-y-1 flex-1">
                              <p className="font-medium">{displayName}</p>
                              <p className="text-sm text-muted-foreground">
                                {task.room_number && `Room ${task.room_number} • `}
                                Department: {task.department} • Category: {categoryLabel}
                              </p>
                              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                                Priority: {displayPriority}
                              </p>
                              {task.worker_remark && (
                                <p className="text-xs text-muted-foreground italic mt-1">
                                  Details: "{task.worker_remark}"
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground">
                                Created by {getUserName(task.assigned_by_user_id)} on{" "}
                                {new Date(task.assigned_at.client).toLocaleString()}
                              </p>
                            </div>
                            <Link href="/admin/task-management">
                              <Button size="sm" variant="outline">
                                Add to Library
                              </Button>
                            </Link>
                          </div>
                          {index < customTasks.length - 1 && <Separator className="mt-4" />}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">No custom task requests</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}

export default function AdminPage() {
  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <AdminDashboard />
    </ProtectedRoute>
  )
}
