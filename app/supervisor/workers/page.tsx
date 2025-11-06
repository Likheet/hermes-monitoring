"use client"

import { ProtectedRoute } from "@/components/protected-route"
import { useAuth } from "@/lib/auth-context"
import { useTasks } from "@/lib/task-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Star, CheckCircle2, XCircle, Clock, Calendar } from "lucide-react"
import { useRouter } from "next/navigation"
import { SupervisorBottomNav } from "@/components/supervisor/supervisor-bottom-nav"
import { getCurrentMonthAttendance } from "@/lib/shift-utils"
import { formatShiftRange } from "@/lib/date-utils"

function WorkersOverviewPage() {
  const { user } = useAuth()
  const { users, tasks, maintenanceTasks, shiftSchedules } = useTasks()
  const router = useRouter()

  const departmentWorkers = users.filter((u) => {
    if (u.role !== "worker") return false
    if (!user?.department) return true
    // Normalize department comparison (case-insensitive)
    return u.department?.toLowerCase() === user.department.toLowerCase()
  })

  const getWorkerStats = (workerId: string) => {
    const workerTasks = tasks.filter((t) => t.assigned_to_user_id === workerId)
    const workerMaintenanceTasks = (maintenanceTasks || []).filter((t) => t.assigned_to === workerId)

    const completedTasks = workerTasks.filter((t) => t.status === "COMPLETED")
    const rejectedTasks = workerTasks.filter((t) => t.status === "REJECTED")
    const inProgressTasks = workerTasks.filter((t) => t.status === "IN_PROGRESS")

    const completedMaintenanceTasks = workerMaintenanceTasks.filter((t) => t.status === "completed")
    const rejectedMaintenanceTasks = workerMaintenanceTasks.filter((t) => t.status === "rejected")

    const totalTasks = workerTasks.length + workerMaintenanceTasks.length
    const totalCompleted = completedTasks.length + completedMaintenanceTasks.length
    const totalRejected = rejectedTasks.length + rejectedMaintenanceTasks.length

    const completionRate = totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0

    const tasksWithRating = completedTasks.filter((t) => t.rating !== null && t.rating !== undefined)
    const avgRating =
      tasksWithRating.length > 0
        ? (tasksWithRating.reduce((sum, t) => sum + (t.rating || 0), 0) / tasksWithRating.length).toFixed(1)
        : "0.0"

    const attendance = getCurrentMonthAttendance(workerId, shiftSchedules || [])

    return {
      totalTasks,
      totalCompleted,
      totalRejected,
      inProgressTasks: inProgressTasks.length,
      completionRate,
      avgRating,
      attendance,
    }
  }

  return (
    <div className="min-h-screen bg-muted/30 pb-20 md:pb-0">
      <header className="border-b bg-background sticky top-0 z-40">
        <div className="container mx-auto flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3 sm:py-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="min-h-[44px] min-w-[44px] shrink-0 md:hidden"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold">Worker Overview</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">{user?.department} Department</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {departmentWorkers.map((worker) => {
            const stats = getWorkerStats(worker.id)
            const initials = worker.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()

            return (
              <Card key={worker.id}>
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base truncate">{worker.name}</CardTitle>
                      <p className="text-sm text-muted-foreground truncate">{worker.department}</p>
                      <p className="text-xs text-muted-foreground">
                        {worker.shift_start && worker.shift_end
                          ? formatShiftRange(worker.shift_start, worker.shift_end)
                          : "No shift set"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm font-bold">{stats.avgRating}</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>Completed</span>
                      </div>
                      <p className="text-lg font-bold text-green-600">{stats.totalCompleted}</p>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <XCircle className="h-3 w-3" />
                        <span>Rejected</span>
                      </div>
                      <p className="text-lg font-bold text-red-600">{stats.totalRejected}</p>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>In Progress</span>
                      </div>
                      <p className="text-lg font-bold text-blue-600">{stats.inProgressTasks}</p>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>Attendance</span>
                      </div>
                      <p className="text-lg font-bold text-purple-600">{stats.attendance.attendance_percentage}%</p>
                    </div>
                  </div>

                  <div className="pt-3 border-t space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Completion Rate</span>
                      <Badge variant="secondary">{stats.completionRate}%</Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Days Worked</span>
                      <span className="font-medium">
                        {stats.attendance.days_worked}/{stats.attendance.total_days}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Days Off</span>
                      <span className="font-medium">
                        {stats.attendance.holidays + stats.attendance.leaves + stats.attendance.sick_days}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {departmentWorkers.length === 0 && (
          <div className="flex min-h-[300px] items-center justify-center border-2 border-dashed rounded-lg">
            <p className="text-muted-foreground">No workers found in your department</p>
          </div>
        )}
      </main>

      <SupervisorBottomNav />
    </div>
  )
}

export default function SupervisorWorkersPage() {
  return (
    <ProtectedRoute allowedRoles={["supervisor"]}>
      <WorkersOverviewPage />
    </ProtectedRoute>
  )
}
