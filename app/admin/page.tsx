"use client"

import { ProtectedRoute } from "@/components/protected-route"
import { useAuth } from "@/lib/auth-context"
import { useTasks } from "@/lib/task-context"
import { StatsCard } from "@/components/stats-card"
import { WorkerStatusCard } from "@/components/worker-status-card"
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

function AdminDashboard() {
  const { user, logout } = useAuth()
  const { tasks, users, maintenanceTasks } = useTasks()
  const router = useRouter()
  const { isConnected } = useRealtimeTasks({ enabled: true })

  const [timeRange, setTimeRange] = useState<"week" | "month" | "all" | "custom">("all")
  const [customStartDate, setCustomStartDate] = useState("")
  const [customEndDate, setCustomEndDate] = useState("")
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false)

  const handleLogout = () => {
    logout()
    router.push("/login")
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
      t.is_custom_task ||
      t.custom_task_name ||
      t.task_type === "Other (Custom Task)" ||
      t.task_type.startsWith("[CUSTOM]"),
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
    if (rating >= 4) return "text-green-500"
    if (rating >= 3) return "text-yellow-500"
    return "text-red-500"
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground">{user?.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <ConnectionStatus isConnected={isConnected} />
            <Link href="/admin/maintenance-schedule">
              <Button variant="outline">
                <Calendar className="mr-2 h-4 w-4" />
                Maintenance Schedule
              </Button>
            </Link>
            <Link href="/admin/task-management">
              <Button variant="outline">
                <ClipboardList className="mr-2 h-4 w-4" />
                Task Management
              </Button>
            </Link>
            <Link href="/admin/add-worker">
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                Add Worker
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {recentCustomTasks.length > 0 && (
          <section>
            <Card className="border-accent">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-accent" />
                  Custom Task Requests ({customTasks.length})
                </CardTitle>
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
                        className="flex items-start justify-between p-3 bg-accent/10 rounded-lg border border-accent/20"
                      >
                        <div className="flex-1">
                          <p className="text-sm font-medium">{displayName}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {task.room_number && `Room ${task.room_number} • `}
                            {task.department} • {categoryLabel}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Priority: {displayPriority} • Created by {getUserName(task.assigned_by_user_id)}
                          </p>
                          {task.worker_remark && (
                            <p className="text-xs text-muted-foreground mt-1 italic">"{task.worker_remark}"</p>
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
                    <Link href="/admin/task-management">
                      <Button variant="link" className="w-full">
                        View all {customTasks.length} custom tasks →
                      </Button>
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        <section>
          <h2 className="text-lg font-semibold mb-4">System Overview</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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

        <section>
          <h2 className="text-lg font-semibold mb-4">Worker Status</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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

        <Tabs defaultValue="workers" className="space-y-4">
          <TabsList>
            <TabsTrigger value="workers">Staff</TabsTrigger>
            <TabsTrigger value="audit">Audit Logs</TabsTrigger>
            <TabsTrigger value="discrepancy">
              Discrepancy
              {discrepancyTasks.length > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-red-500 text-white rounded-full">
                  {discrepancyTasks.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="custom">
              Custom Tasks
              {customTasks.length > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-accent text-accent-foreground rounded-full">
                  {customTasks.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="workers" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Staff Performance Overview</CardTitle>
                  <div className="flex items-center gap-2">
                    <CalendarRange className="h-4 w-4 text-muted-foreground" />
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
                      className="px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="week">This Week</option>
                      <option value="month">This Month</option>
                      <option value="all">All Time</option>
                      <option value="custom">Custom Range</option>
                    </select>
                  </div>
                </div>
                {showCustomDatePicker && (
                  <div className="flex items-center gap-2 mt-3">
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <span className="text-sm text-muted-foreground">to</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-2 font-medium">Worker Name</th>
                        <th className="text-right py-3 px-2 font-medium">Shift Hrs</th>
                        <th className="text-right py-3 px-2 font-medium">Worked</th>
                        <th className="text-right py-3 px-2 font-medium">Idle Time</th>
                        <th className="text-right py-3 px-2 font-medium">Discrepancy</th>
                        <th className="text-right py-3 px-2 font-medium">Rating</th>
                        <th className="text-center py-3 px-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workers.map((worker) => {
                        const performance = calculateWorkerPerformance(worker.id)
                        const currentTask = getWorkerCurrentTask(worker.id)
                        const stats = getWorkerStats(worker.id)

                        if (!performance) return null

                        return (
                          <tr key={worker.id} className="border-b hover:bg-muted/50">
                            <td className="py-3 px-2">
                              <div>
                                <p className="font-medium">{worker.name}</p>
                                <p className="text-xs text-muted-foreground">{worker.department}</p>
                              </div>
                            </td>
                            <td className="text-right py-3 px-2">{performance.shiftHours}h</td>
                            <td className="text-right py-3 px-2 text-green-600 font-medium">
                              {performance.actualWorkHours}h
                            </td>
                            <td className="text-right py-3 px-2 text-orange-600">{performance.idleHours}h</td>
                            <td className="text-right py-3 px-2">
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
                            </td>
                            <td className="text-right py-3 px-2">
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
                            </td>
                            <td className="text-center py-3 px-2">
                              <Badge variant={currentTask ? "default" : "secondary"} className="text-xs">
                                {currentTask ? "Working" : "Available"}
                              </Badge>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
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
                      <WorkerStatusCard key={worker.id} worker={worker} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No workers available</p>
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
                      <WorkerStatusCard key={worker.id} worker={worker} currentTask={getWorkerCurrentTask(worker.id)} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No workers currently busy</p>
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
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <p className="text-sm font-medium">{log.action.replace(/_/g, " ")}</p>
                          <p className="text-sm text-muted-foreground">{log.details}</p>
                          <p className="text-xs text-muted-foreground">
                            {log.taskType} - by {getUserName(log.user_id)}
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
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Total Discrepancies</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{discrepancyTasks.length}</div>
                    <p className="text-xs text-muted-foreground mt-1">Tasks requiring attention</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Rework Tasks</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{reworkTasks}</div>
                    <p className="text-xs text-muted-foreground mt-1">Rejected and reassigned</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Avg Overtime</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold flex items-center gap-2">
                      <Clock className="h-5 w-5 text-orange-500" />
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
                        <TableRow>
                          <TableHead>Task Type</TableHead>
                          <TableHead>Room</TableHead>
                          <TableHead>Worker</TableHead>
                          <TableHead className="text-right">Expected</TableHead>
                          <TableHead className="text-right">Actual</TableHead>
                          <TableHead className="text-right">Overtime</TableHead>
                          <TableHead className="text-right">Rating</TableHead>
                          <TableHead>Issues</TableHead>
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
                              <TableRow key={task.id}>
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
                                            ? "text-red-500"
                                            : Number.parseInt(overtimePercent) > 20
                                              ? "text-orange-500"
                                              : "text-yellow-500"
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
                                      <Badge variant="outline" className="text-xs text-orange-500">
                                        Low Quality
                                      </Badge>
                                    )}
                                    {isOvertime && Number.parseInt(overtimePercent) > 50 && (
                                      <Badge variant="outline" className="text-xs text-red-500">
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
                            <TableCell colSpan={8} className="text-center text-muted-foreground">
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
                          <div className="flex items-start justify-between">
                            <div className="space-y-1 flex-1">
                              <p className="text-sm font-medium">{displayName}</p>
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
                            <div className="flex gap-2">
                              <Link href="/admin/task-management">
                                <Button size="sm" variant="outline">
                                  Add to Library
                                </Button>
                              </Link>
                            </div>
                          </div>
                          {index < customTasks.length - 1 && <Separator className="mt-4" />}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No custom task requests</p>
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
