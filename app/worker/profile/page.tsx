"use client"

import { ProtectedRoute } from "@/components/protected-route"
import { useAuth } from "@/lib/auth-context"
import { useTasks } from "@/lib/task-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Award, Clock, CheckCircle2, TrendingUp, Star, XCircle, AlertTriangle } from "lucide-react"
import { useRouter } from "next/navigation"
import { BottomNav } from "@/components/mobile/bottom-nav"
import { calculateDuration, formatShiftRange } from "@/lib/date-utils"

function ProfilePage() {
  console.log("[v0] Profile page loaded")

  const { user } = useAuth()
  const { tasks } = useTasks()
  const router = useRouter()

  const myTasks = tasks.filter((task) => task.assigned_to_user_id === user?.id)
  const completedTasks = myTasks.filter((t) => t.status === "COMPLETED")
  const rejectedTasks = myTasks.filter((t) => t.status === "REJECTED")
  const overdueTasks = myTasks.filter((t) => {
    if (t.status !== "IN_PROGRESS" && t.status !== "PAUSED") return false
    if (!t.started_at || !t.expected_duration_minutes) return false
    const elapsed = Date.now() - new Date(t.started_at.client).getTime()
    const pausedTime = t.pause_history.reduce((total, pause) => {
      if (!pause.resumed_at) return total
      return total + (new Date(pause.resumed_at.client).getTime() - new Date(pause.paused_at.client).getTime())
    }, 0)
    const activeTime = elapsed - pausedTime
    return activeTime > t.expected_duration_minutes * 60 * 1000
  })

  const onTimeTasks = completedTasks.filter((t) => {
    if (!t.actual_duration_minutes || !t.expected_duration_minutes) return false
    return t.actual_duration_minutes <= t.expected_duration_minutes
  })

  const tasksWithRating = completedTasks.filter((t) => t.rating !== null && t.rating !== undefined)
  const avgRating =
    tasksWithRating.length > 0
      ? (tasksWithRating.reduce((sum, t) => sum + (t.rating || 0), 0) / tasksWithRating.length).toFixed(1)
      : "N/A"

  const totalTasks = myTasks.length
  const completionRate = totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 0
  const onTimeRate = completedTasks.length > 0 ? Math.round((onTimeTasks.length / completedTasks.length) * 100) : 0

  const avgCompletionTime =
    completedTasks.length > 0
      ? Math.round(completedTasks.reduce((sum, t) => sum + (t.actual_duration_minutes || 0), 0) / completedTasks.length)
      : 0

  const initials = user?.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()

  return (
    <div className="min-h-screen bg-muted/30 pb-20 md:pb-0">
      <header className="border-b bg-background sticky top-0 z-40">
        <div className="container mx-auto flex items-center gap-4 px-4 py-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="min-h-[44px] min-w-[44px]">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl md:text-2xl font-bold">Profile</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h2 className="text-2xl font-bold">{user?.name}</h2>
                <p className="text-muted-foreground">{user?.role}</p>
                <Badge variant="secondary" className="mt-2">
                  {user?.department}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalTasks}</div>
              <p className="text-xs text-muted-foreground">{completedTasks.length} completed</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{completionRate}%</div>
              <p className="text-xs text-muted-foreground">All time average</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">On-Time Delivery</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{onTimeRate}%</div>
              <p className="text-xs text-muted-foreground">{onTimeTasks.length} tasks on time</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg. Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgCompletionTime}m</div>
              <p className="text-xs text-muted-foreground">Per task completion</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgRating}</div>
              <p className="text-xs text-muted-foreground">{tasksWithRating.length} rated tasks</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Issues</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{rejectedTasks.length}</div>
              <p className="text-xs text-muted-foreground">{overdueTasks.length} overdue</p>
            </CardContent>
          </Card>
        </div>

        {completedTasks.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Completed Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {completedTasks.slice(0, 10).map((task) => (
                  <div key={task.id} className="flex items-start justify-between gap-4 p-3 border rounded-lg">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{task.task_type}</h4>
                        {task.rating && (
                          <div className="flex items-center gap-1">
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            <span className="text-sm font-medium">{task.rating}</span>
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">Room: {task.room_number}</p>
                      {task.completed_at && task.started_at && (
                        <p className="text-xs text-muted-foreground">
                          Completed in {calculateDuration(task.started_at, task.completed_at)}
                        </p>
                      )}
                      {task.quality_comment && (
                        <p className="text-sm text-muted-foreground italic">"{task.quality_comment}"</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {rejectedTasks.length > 0 && (
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-red-600 flex items-center gap-2">
                <XCircle className="h-5 w-5" />
                Rejected Tasks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {rejectedTasks.map((task) => (
                  <div key={task.id} className="p-3 border border-red-200 rounded-lg bg-red-50">
                    <h4 className="font-medium text-red-900">{task.task_type}</h4>
                    <p className="text-sm text-red-700 mt-1">
                      <strong>Reason:</strong> {task.supervisor_remark || "No reason provided"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Room: {task.room_number}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {overdueTasks.length > 0 && (
          <Card className="border-orange-200">
            <CardHeader>
              <CardTitle className="text-orange-600 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Overdue Tasks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {overdueTasks.map((task) => (
                  <div key={task.id} className="p-3 border border-orange-200 rounded-lg bg-orange-50">
                    <h4 className="font-medium text-orange-900">{task.task_type}</h4>
                    <p className="text-sm text-orange-700 mt-1">Expected: {task.expected_duration_minutes} min</p>
                    <p className="text-xs text-muted-foreground mt-1">Room: {task.room_number}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Phone</span>
              <span className="font-medium">{user?.phone || "Not set"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shift</span>
              <span className="font-medium">
                {user?.shift_start && user?.shift_end ? formatShiftRange(user.shift_start, user.shift_end) : "Not set"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Button variant="outline" className="w-full bg-transparent" onClick={() => router.push("/worker/settings")}>
          Settings
        </Button>
      </main>

      <div className="md:hidden">
        <BottomNav />
      </div>
    </div>
  )
}

export default function WorkerProfilePage() {
  return (
    <ProtectedRoute allowedRoles={["worker"]}>
      <ProfilePage />
    </ProtectedRoute>
  )
}
