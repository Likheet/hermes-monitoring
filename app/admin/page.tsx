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
  BarChart3,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useRealtimeTasks } from "@/lib/use-realtime-tasks"
import { ConnectionStatus } from "@/components/connection-status"
import Link from "next/link"

function AdminDashboard() {
  const { user, logout } = useAuth()
  const { tasks, users } = useTasks()
  const router = useRouter()
  const { isConnected } = useRealtimeTasks({ enabled: true })

  const handleLogout = () => {
    logout()
    router.push("/login")
  }

  const workers = users.filter((u) => u.role === "worker")

  // Calculate statistics
  const totalTasks = tasks.length
  const pendingTasks = tasks.filter((t) => t.status === "PENDING").length
  const inProgressTasks = tasks.filter((t) => t.status === "IN_PROGRESS").length
  const completedTasks = tasks.filter((t) => t.status === "COMPLETED").length
  const rejectedTasks = tasks.filter((t) => t.status === "REJECTED").length

  // Calculate average completion time
  const completedTasksWithDuration = tasks.filter((t) => t.status === "COMPLETED" && t.actual_duration_minutes)
  const avgCompletionTime =
    completedTasksWithDuration.length > 0
      ? Math.round(
          completedTasksWithDuration.reduce((sum, t) => sum + (t.actual_duration_minutes || 0), 0) /
            completedTasksWithDuration.length,
        )
      : 0

  // Calculate overtime tasks
  const overtimeTasks = completedTasksWithDuration.filter(
    (t) => (t.actual_duration_minutes || 0) > t.expected_duration_minutes,
  ).length

  // Worker availability
  const getWorkerCurrentTask = (workerId: string) => {
    return tasks.find(
      (t) => t.assigned_to_user_id === workerId && (t.status === "IN_PROGRESS" || t.status === "PAUSED"),
    )
  }

  const availableWorkers = workers.filter((w) => !getWorkerCurrentTask(w.id))
  const busyWorkers = workers.filter((w) => getWorkerCurrentTask(w.id))

  // Recent audit logs (last 20)
  const allAuditLogs = tasks
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
            <Link href="/admin/reports">
              <Button variant="outline">
                <BarChart3 className="mr-2 h-4 w-4" />
                Reports
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
            <TabsTrigger value="workers">Workers</TabsTrigger>
            <TabsTrigger value="audit">Audit Logs</TabsTrigger>
            <TabsTrigger value="alerts">Alerts</TabsTrigger>
          </TabsList>

          <TabsContent value="workers" className="space-y-4">
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

          <TabsContent value="alerts">
            <Card>
              <CardHeader>
                <CardTitle>Active Alerts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {tasks
                    .filter((t) => {
                      if (t.status !== "IN_PROGRESS" || !t.started_at) return false
                      const startTime = new Date(t.started_at.client).getTime()
                      const now = Date.now()
                      let pausedDuration = 0
                      t.pause_history.forEach((pause) => {
                        if (pause.resumed_at) {
                          const pauseStart = new Date(pause.paused_at.client).getTime()
                          const pauseEnd = new Date(pause.resumed_at.client).getTime()
                          pausedDuration += pauseEnd - pauseStart
                        } else {
                          const pauseStart = new Date(pause.paused_at.client).getTime()
                          pausedDuration += now - pauseStart
                        }
                      })
                      const elapsedMinutes = Math.floor((now - startTime - pausedDuration) / 60000)
                      return elapsedMinutes >= 15
                    })
                    .map((task, index) => {
                      const startTime = new Date(task.started_at!.client).getTime()
                      const now = Date.now()
                      let pausedDuration = 0
                      task.pause_history.forEach((pause) => {
                        if (pause.resumed_at) {
                          const pauseStart = new Date(pause.paused_at.client).getTime()
                          const pauseEnd = new Date(pause.resumed_at.client).getTime()
                          pausedDuration += pauseEnd - pauseStart
                        } else {
                          const pauseStart = new Date(pause.paused_at.client).getTime()
                          pausedDuration += now - pauseStart
                        }
                      })
                      const elapsedMinutes = Math.floor((now - startTime - pausedDuration) / 60000)
                      const fiftyPercentOvertime = task.expected_duration_minutes * 1.5

                      let alertLevel = "warning"
                      let alertMessage = "15+ minutes elapsed"

                      if (elapsedMinutes >= fiftyPercentOvertime) {
                        alertLevel = "critical"
                        alertMessage = "50% overtime exceeded"
                      } else if (elapsedMinutes >= 20) {
                        alertLevel = "high"
                        alertMessage = "20+ minutes elapsed"
                      }

                      return (
                        <div key={task.id}>
                          <div className="flex items-start gap-3">
                            <AlertTriangle
                              className={`h-5 w-5 mt-0.5 ${
                                alertLevel === "critical"
                                  ? "text-red-500"
                                  : alertLevel === "high"
                                    ? "text-orange-500"
                                    : "text-yellow-500"
                              }`}
                            />
                            <div className="flex-1 space-y-1">
                              <p className="text-sm font-medium">{task.task_type}</p>
                              <p className="text-sm text-muted-foreground">
                                {alertMessage} - Room {task.room_number}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Worker: {getUserName(task.assigned_to_user_id)} - {elapsedMinutes} /{" "}
                                {task.expected_duration_minutes} min
                              </p>
                            </div>
                          </div>
                          {index <
                            tasks.filter((t) => {
                              if (t.status !== "IN_PROGRESS" || !t.started_at) return false
                              const startTime = new Date(t.started_at.client).getTime()
                              const now = Date.now()
                              let pausedDuration = 0
                              t.pause_history.forEach((pause) => {
                                if (pause.resumed_at) {
                                  const pauseStart = new Date(pause.paused_at.client).getTime()
                                  const pauseEnd = new Date(pause.resumed_at.client).getTime()
                                  pausedDuration += pauseEnd - pauseStart
                                } else {
                                  const pauseStart = new Date(pause.paused_at.client).getTime()
                                  pausedDuration += now - pauseStart
                                }
                              })
                              const elapsedMinutes = Math.floor((now - startTime - pausedDuration) / 60000)
                              return elapsedMinutes >= 15
                            }).length -
                              1 && <Separator className="mt-4" />}
                        </div>
                      )
                    })}
                  {tasks.filter((t) => {
                    if (t.status !== "IN_PROGRESS" || !t.started_at) return false
                    const startTime = new Date(t.started_at.client).getTime()
                    const now = Date.now()
                    let pausedDuration = 0
                    t.pause_history.forEach((pause) => {
                      if (pause.resumed_at) {
                        const pauseStart = new Date(pause.paused_at.client).getTime()
                        const pauseEnd = new Date(pause.resumed_at.client).getTime()
                        pausedDuration += pauseEnd - pauseStart
                      } else {
                        const pauseStart = new Date(pause.paused_at.client).getTime()
                        pausedDuration += now - pauseStart
                      }
                    })
                    const elapsedMinutes = Math.floor((now - startTime - pausedDuration) / 60000)
                    return elapsedMinutes >= 15
                  }).length === 0 && <p className="text-sm text-muted-foreground">No active alerts</p>}
                </div>
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
