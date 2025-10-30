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
import { calculateDuration, formatShiftRange, formatDistanceToNow, startOfMonth, endOfMonth } from "@/lib/date-utils"
import { useEffect } from "react"
import { getCurrentMonthAttendance } from "@/lib/shift-utils"

function ProfilePage() {
  console.log("[v0] Profile page loaded")

  const { user } = useAuth()
  const { tasks, maintenanceTasks, shiftSchedules } = useTasks()
  const router = useRouter()

  const myTasks = tasks.filter((task) => task.assigned_to_user_id === user?.id)
  const myCompletedMaintenanceTasks = (maintenanceTasks || []).filter(
    (t) => t.assigned_to === user?.id && t.status === "completed",
  )

  const completedTasks = myTasks.filter((t) => t.status === "COMPLETED")
  const rejectedTasks = myTasks.filter((t) => t.status === "REJECTED")

  const rejectedMaintenanceTasks = (maintenanceTasks || []).filter(
    (t) => t.assigned_to === user?.id && t.status === "rejected",
  )
  const totalRejectedTasks = rejectedTasks.length + rejectedMaintenanceTasks.length

  const now = new Date()
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)

  const rejectedThisMonth =
    rejectedTasks.filter((t) => {
      if (!t.completed_at) return false
      const completedDate = new Date(t.completed_at.client || t.completed_at.server)
      return completedDate >= monthStart && completedDate <= monthEnd
    }).length +
    rejectedMaintenanceTasks.filter((t) => {
      if (!t.completed_at) return false
      const completedDate = new Date(t.completed_at)
      return completedDate >= monthStart && completedDate <= monthEnd
    }).length

  const REJECTION_QUOTA = 5
  const quotaRemaining = REJECTION_QUOTA - rejectedThisMonth
  const isOverQuota = rejectedThisMonth >= REJECTION_QUOTA
  const rejectionPercentage = (rejectedThisMonth / REJECTION_QUOTA) * 100

  const getRejectionStyle = () => {
    if (isOverQuota) {
      return {
        bgColor: "bg-red-50 border-red-200",
        textColor: "text-red-700",
        barColor: "bg-red-600",
        icon: <AlertTriangle className="h-4 w-4 text-red-600" />,
        message: "Over quota - Retraining required",
        messageColor: "text-red-600",
      }
    } else if (rejectedThisMonth >= 4) {
      return {
        bgColor: "bg-orange-50 border-orange-200",
        textColor: "text-orange-700",
        barColor: "bg-orange-500",
        icon: <AlertTriangle className="h-4 w-4 text-orange-500" />,
        message: "Approaching limit",
        messageColor: "text-orange-600",
      }
    } else if (rejectedThisMonth >= 3) {
      return {
        bgColor: "bg-yellow-50 border-yellow-200",
        textColor: "text-yellow-700",
        barColor: "bg-yellow-500",
        icon: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
        message: `${quotaRemaining} remaining`,
        messageColor: "text-yellow-600",
      }
    } else {
      return {
        bgColor: "bg-muted/30 border-border",
        textColor: "text-muted-foreground",
        barColor: "bg-green-500",
        icon: <CheckCircle2 className="h-4 w-4 text-green-600" />,
        message: `${quotaRemaining} remaining`,
        messageColor: "text-muted-foreground",
      }
    }
  }

  const rejectionStyle = getRejectionStyle()

  useEffect(() => {
    console.log("[v0] Profile page loaded with data:", {
      userId: user?.id,
      userName: user?.name,
      totalTasks: tasks.length,
      totalMaintenanceTasks: maintenanceTasks?.length || 0,
      myRegularTasks: myTasks.length,
      myCompletedRegularTasks: completedTasks.length,
      myMaintenanceTasks: (maintenanceTasks || []).filter((t) => t.assigned_to === user?.id).length,
      myCompletedMaintenanceTasks: myCompletedMaintenanceTasks.length,
      completedMaintenanceTaskDetails: myCompletedMaintenanceTasks.map((t) => ({
        id: t.id,
        room: t.room_number,
        type: t.task_type,
        location: t.location,
        status: t.status,
        completedAt: t.completed_at,
        duration: t.timer_duration,
      })),
    })
  }, [
    user?.id,
    user?.name,
    tasks.length,
    maintenanceTasks,
    myTasks.length,
    completedTasks.length,
    myCompletedMaintenanceTasks,
  ])

  useEffect(() => {
    if (myCompletedMaintenanceTasks.length > 0) {
      console.log(
        "[v0] Completed maintenance tasks:",
        myCompletedMaintenanceTasks.map((t) => ({
          id: t.id,
          room: t.room_number,
          type: t.task_type,
          location: t.location,
          completedAt: t.completed_at,
          duration: t.timer_duration,
        })),
      )
    }
  }, [myCompletedMaintenanceTasks])

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
      : "0.0"

  const ratingValue = Number.parseFloat(avgRating)
  const ratingPercentage = (ratingValue / 5) * 100
  const circumference = 2 * Math.PI * 42
  const strokeDashoffset = circumference - (ratingPercentage / 100) * circumference

  useEffect(() => {
    console.log("[v0] Rating calculation:", {
      tasksWithRating: tasksWithRating.length,
      avgRating,
      ratingValue,
      ratingPercentage,
    })
  }, [tasksWithRating.length, avgRating, ratingValue, ratingPercentage])

  const totalTasks = myTasks.length + (maintenanceTasks || []).filter((t) => t.assigned_to === user?.id).length
  const totalCompletedTasks = completedTasks.length + myCompletedMaintenanceTasks.length
  const completionRate = totalTasks > 0 ? Math.round((totalCompletedTasks / totalTasks) * 100) : 0
  const onTimeRate = completedTasks.length > 0 ? Math.round((onTimeTasks.length / completedTasks.length) * 100) : 0

  const avgCompletionTime =
    completedTasks.length > 0
      ? Math.round(completedTasks.reduce((sum, t) => sum + (t.actual_duration_minutes || 0), 0) / completedTasks.length)
      : 0

  const avgMaintenanceTime =
    myCompletedMaintenanceTasks.length > 0
      ? Math.round(
          myCompletedMaintenanceTasks.reduce((sum, t) => sum + (t.timer_duration || 0) / 60, 0) /
            myCompletedMaintenanceTasks.length,
        )
      : 0

  const combinedAvgTime =
    totalCompletedTasks > 0
      ? Math.round(
          (avgCompletionTime * completedTasks.length + avgMaintenanceTime * myCompletedMaintenanceTasks.length) /
            totalCompletedTasks,
        )
      : 0

  const initials = user?.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()

  const getMaintenanceTaskLabel = (taskType: string) => {
    const labels: Record<string, string> = {
      ac_indoor: "AC Indoor Unit",
      ac_outdoor: "AC Outdoor Unit",
      fan: "Fan",
      exhaust: "Exhaust Fan",
    }
    return labels[taskType] || taskType.replace(/_/g, " ")
  }

  useEffect(() => {
    console.log("[v0] Profile statistics:", {
      totalTasks,
      totalCompletedTasks,
      completionRate,
      willShowCompletedSection: completedTasks.length > 0 || myCompletedMaintenanceTasks.length > 0,
    })
  }, [totalTasks, totalCompletedTasks, completionRate, completedTasks.length, myCompletedMaintenanceTasks.length])

  const isMaintenanceWorker = user?.department === "Maintenance"

  const attendance = getCurrentMonthAttendance(user?.id || "", shiftSchedules || [])

  return (
    <div className="min-h-screen bg-muted/30 pb-20 md:pb-0">
      <header className="border-b bg-background sticky top-0 z-40">
        <div className="container mx-auto flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3 sm:py-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="min-h-[44px] min-w-[44px] shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold">Profile</h1>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
        <Card>
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex flex-col sm:flex-row items-start gap-4">
              <div className="relative shrink-0 flex flex-col items-center gap-2">
                <div className="relative">
                  {/* Circular progress ring */}
                  <svg className="absolute inset-0 -rotate-90" width="88" height="88" viewBox="0 0 88 88">
                    <circle
                      cx="44"
                      cy="44"
                      r="42"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      className="text-muted/20"
                    />
                    <circle
                      cx="44"
                      cy="44"
                      r="42"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                      className="text-yellow-500 transition-all duration-500"
                    />
                  </svg>
                  <Avatar className="h-20 w-20 m-1">
                    <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
                  </Avatar>
                </div>
                {/* Rating badge - always visible */}
                <div className="bg-yellow-50 border-2 border-yellow-500 rounded-full px-3 py-1 flex items-center gap-1.5 shadow-sm">
                  <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                  <span className="text-sm font-bold text-foreground">{avgRating}</span>
                  <span className="text-xs text-muted-foreground">/5</span>
                </div>
                {tasksWithRating.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {tasksWithRating.length} {tasksWithRating.length === 1 ? "rating" : "ratings"}
                  </span>
                )}
              </div>

              <div className="flex-1 min-w-0 w-full sm:w-auto">
                <h2 className="text-xl sm:text-2xl font-bold truncate">{user?.name}</h2>
                <p className="text-sm sm:text-base text-muted-foreground truncate">{user?.role}</p>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <Badge variant="secondary" className="text-xs sm:text-sm">
                    {user?.department}
                  </Badge>
                  <span className="text-xs sm:text-sm text-muted-foreground truncate">{user?.phone || "Not set"}</span>
                  <span className="text-xs sm:text-sm text-muted-foreground truncate">
                    {user?.shift_start && user?.shift_end
                      ? formatShiftRange(user.shift_start, user.shift_end)
                      : "Not set"}
                  </span>
                </div>
              </div>

              <div className="w-full sm:w-auto">
                <Card className={`${rejectionStyle.bgColor} border-2 transition-all duration-300`}>
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        {rejectionStyle.icon}
                        <span className="text-xs font-medium text-muted-foreground">Quality Issues</span>
                      </div>
                      <span className={`text-sm font-bold ${rejectionStyle.textColor}`}>
                        {rejectedThisMonth}/{REJECTION_QUOTA}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-muted/30 rounded-full overflow-hidden mb-2">
                      <div
                        className={`h-full transition-all duration-500 ${rejectionStyle.barColor}`}
                        style={{ width: `${Math.min(rejectionPercentage, 100)}%` }}
                      />
                    </div>
                    <p className={`text-xs font-medium ${rejectionStyle.messageColor}`}>{rejectionStyle.message}</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Attendance Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Attendance This Month</span>
              <Badge variant="secondary">{attendance.attendance_percentage}%</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Days Worked</p>
                <p className="text-2xl font-bold text-green-600">{attendance.days_worked}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Holidays</p>
                <p className="text-2xl font-bold text-blue-600">{attendance.holidays}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Leaves</p>
                <p className="text-2xl font-bold text-orange-600">{attendance.leaves}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Sick Days</p>
                <p className="text-2xl font-bold text-red-600">{attendance.sick_days}</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Days</span>
                <span className="font-medium">{attendance.total_days}</span>
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span className="text-muted-foreground">Days Off</span>
                <span className="font-medium">{attendance.days_off}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground shrink-0" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalTasks}</div>
              <p className="text-xs text-muted-foreground">{totalCompletedTasks} completed</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground shrink-0" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{completionRate}%</div>
              <p className="text-xs text-muted-foreground">All time average</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">On-Time Delivery</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground shrink-0" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{onTimeRate}%</div>
              <p className="text-xs text-muted-foreground">{onTimeTasks.length} tasks on time</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Avg. Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{combinedAvgTime}m</div>
              <p className="text-xs text-muted-foreground">Per task completion</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Issues</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground shrink-0" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{totalRejectedTasks}</div>
              <p className="text-xs text-muted-foreground">{overdueTasks.length} overdue</p>
            </CardContent>
          </Card>
        </div>

        {(completedTasks.length > 0 || myCompletedMaintenanceTasks.length > 0) && (
          <Card>
            <CardHeader className="pb-3 sm:pb-4">
              <CardTitle className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <span className="text-base sm:text-lg">Completed Tasks</span>
                <Badge variant="secondary" className="text-xs sm:text-sm">
                  {totalCompletedTasks} total
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {isMaintenanceWorker && myCompletedMaintenanceTasks.length > 0 && (
                  <>
                    <div className="text-xs sm:text-sm font-semibold text-muted-foreground mb-2">
                      Scheduled Maintenance ({myCompletedMaintenanceTasks.length})
                    </div>
                    {myCompletedMaintenanceTasks.slice(0, 10).map((task) => (
                      <div
                        key={task.id}
                        className="flex items-start justify-between gap-3 sm:gap-4 p-3 sm:p-4 border-2 border-accent/30 rounded-lg bg-accent/10"
                      >
                        <div className="flex-1 space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-semibold text-sm sm:text-base truncate">
                              {getMaintenanceTaskLabel(task.task_type)}
                            </h4>
                            <Badge variant="default" className="text-xs font-semibold shrink-0">
                              Maintenance
                            </Badge>
                          </div>
                          <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">
                            Room {task.room_number} • {task.location}
                          </p>
                          {task.completed_at && (
                            <p className="text-xs text-muted-foreground">
                              Completed {formatDistanceToNow(new Date(task.completed_at), { addSuffix: true })}
                            </p>
                          )}
                          {task.timer_duration && (
                            <p className="text-xs text-muted-foreground">
                              Duration: {Math.round(task.timer_duration / 60)} minutes
                            </p>
                          )}
                        </div>
                        <CheckCircle2 className="h-5 w-5 text-accent shrink-0" />
                      </div>
                    ))}
                  </>
                )}

                {completedTasks.length > 0 && (
                  <>
                    {isMaintenanceWorker && myCompletedMaintenanceTasks.length > 0 && (
                      <div className="text-sm sm:text-sm font-semibold text-muted-foreground mt-4 mb-2">
                        Regular Tasks ({completedTasks.length})
                      </div>
                    )}
                    {completedTasks.slice(0, 10).map((task) => (
                      <div
                        key={task.id}
                        className="flex items-start justify-between gap-3 sm:gap-4 p-3 sm:p-4 border rounded-lg"
                      >
                        <div className="flex-1 space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{task.task_type}</h4>
                            {task.rating && (
                              <div className="flex items-center gap-1">
                                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                                <span className="text-sm font-medium">{task.rating}</span>
                              </div>
                            )}
                          </div>
                          <p className="text-sm sm:text-sm text-muted-foreground truncate">Room: {task.room_number}</p>
                          {task.completed_at && task.started_at && (
                            <p className="text-xs sm:text-sm text-muted-foreground">
                              Completed in {calculateDuration(task.started_at, task.completed_at)}
                            </p>
                          )}
                          {task.quality_comment && (
                            <p className="text-sm sm:text-sm text-muted-foreground italic truncate">
                              &quot;{task.quality_comment}&quot;
                            </p>
                          )}
                        </div>
                        <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                      </div>
                    ))}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {totalRejectedTasks > 0 && (
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-red-600 flex items-center gap-2">
                <XCircle className="h-5 w-5" />
                Rejected Tasks ({totalRejectedTasks})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {rejectedMaintenanceTasks.length > 0 && (
                  <>
                    <div className="text-sm sm:text-sm font-semibold text-muted-foreground mb-2">
                      Maintenance Tasks ({rejectedMaintenanceTasks.length})
                    </div>
                    {rejectedMaintenanceTasks.map((task) => (
                      <div key={task.id} className="p-3 border border-red-200 rounded-lg bg-red-50">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-red-900">{getMaintenanceTaskLabel(task.task_type)}</h4>
                          <Badge variant="outline" className="text-xs">
                            Maintenance
                          </Badge>
                        </div>
                        <p className="text-sm sm:text-sm text-red-700 mt-1">
                          <strong>Reason:</strong> {task.rejection_reason || "No reason provided"}
                        </p>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                          Room {task.room_number} • {task.location}
                        </p>
                      </div>
                    ))}
                  </>
                )}

                {rejectedTasks.length > 0 && (
                  <>
                    {rejectedMaintenanceTasks.length > 0 && (
                      <div className="text-sm sm:text-sm font-semibold text-muted-foreground mt-4 mb-2">
                        Regular Tasks ({rejectedTasks.length})
                      </div>
                    )}
                    {rejectedTasks.map((task) => (
                      <div key={task.id} className="p-3 border border-red-200 rounded-lg bg-red-50">
                        <h4 className="font-medium text-red-900">{task.task_type}</h4>
                        <p className="text-sm sm:text-sm text-red-700 mt-1">
                          <strong>Reason:</strong> {task.supervisor_remark || "No reason provided"}
                        </p>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-1">Room: {task.room_number}</p>
                      </div>
                    ))}
                  </>
                )}
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
                    <p className="text-sm sm:text-sm text-orange-700 mt-1">
                      Expected: {task.expected_duration_minutes} min
                    </p>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">Room: {task.room_number}</p>
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

        <Button
          variant="outline"
          className="w-full min-h-[48px] text-base bg-transparent"
          onClick={() => router.push("/worker/settings")}
        >
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
    <ProtectedRoute allowedRoles={["worker", "front_office"]}>
      <ProfilePage />
    </ProtectedRoute>
  )
}
