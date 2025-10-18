"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import type { User } from "@/lib/types"
import { useTasks } from "@/lib/task-context"
import { CheckCircle2, Clock, TrendingUp, Star, Award, AlertTriangle } from "lucide-react"
import { formatShiftRange, startOfMonth, endOfMonth } from "@/lib/date-utils"

interface WorkerProfileDialogProps {
  worker: User | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function WorkerProfileDialog({ worker, open, onOpenChange }: WorkerProfileDialogProps) {
  const { tasks, maintenanceTasks } = useTasks()

  if (!worker) return null

  const initials = worker.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()

  const myTasks = tasks.filter((task) => task.assigned_to_user_id === worker.id)
  const myMaintenanceTasks = (maintenanceTasks || []).filter((t) => t.assigned_to === worker.id)

  const completedTasks = myTasks.filter((t) => t.status === "COMPLETED")
  const completedMaintenanceTasks = myMaintenanceTasks.filter((t) => t.status === "completed")
  const rejectedTasks = myTasks.filter((t) => t.status === "REJECTED")
  const rejectedMaintenanceTasks = myMaintenanceTasks.filter((t) => t.status === "rejected")

  const totalTasks = myTasks.length + myMaintenanceTasks.length
  const totalCompletedTasks = completedTasks.length + completedMaintenanceTasks.length
  const totalRejectedTasks = rejectedTasks.length + rejectedMaintenanceTasks.length

  const completionRate = totalTasks > 0 ? Math.round((totalCompletedTasks / totalTasks) * 100) : 0

  const onTimeTasks = completedTasks.filter((t) => {
    if (!t.actual_duration_minutes || !t.expected_duration_minutes) return false
    return t.actual_duration_minutes <= t.expected_duration_minutes
  })
  const onTimeRate = completedTasks.length > 0 ? Math.round((onTimeTasks.length / completedTasks.length) * 100) : 0

  const tasksWithRating = completedTasks.filter((t) => t.rating !== null && t.rating !== undefined)
  const avgRating =
    tasksWithRating.length > 0
      ? (tasksWithRating.reduce((sum, t) => sum + (t.rating || 0), 0) / tasksWithRating.length).toFixed(1)
      : "0.0"

  const avgCompletionTime =
    completedTasks.length > 0
      ? Math.round(completedTasks.reduce((sum, t) => sum + (t.actual_duration_minutes || 0), 0) / completedTasks.length)
      : 0

  const avgMaintenanceTime =
    completedMaintenanceTasks.length > 0
      ? Math.round(
          completedMaintenanceTasks.reduce((sum, t) => sum + (t.timer_duration || 0) / 60, 0) /
            completedMaintenanceTasks.length,
        )
      : 0

  const combinedAvgTime =
    totalCompletedTasks > 0
      ? Math.round(
          (avgCompletionTime * completedTasks.length + avgMaintenanceTime * completedMaintenanceTasks.length) /
            totalCompletedTasks,
        )
      : 0

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

  const ratingValue = Number.parseFloat(avgRating)
  const ratingPercentage = (ratingValue / 5) * 100
  const circumference = 2 * Math.PI * 42
  const strokeDashoffset = circumference - (ratingPercentage / 100) * circumference

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Worker Profile</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Profile Header */}
          <Card>
            <CardContent className="pt-6">
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
                  {/* Rating badge */}
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

                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold">{worker.name}</h2>
                  <p className="text-sm text-muted-foreground">{worker.role}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <Badge variant="secondary">{worker.department}</Badge>
                    <span className="text-sm text-muted-foreground">{worker.phone || "Not set"}</span>
                    <span className="text-sm text-muted-foreground">
                      {worker.shift_start && worker.shift_end
                        ? formatShiftRange(worker.shift_start, worker.shift_end)
                        : "Not set"}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-start sm:items-end gap-2 min-w-[140px]">
                  <div className="w-full">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-muted-foreground">Rejections</span>
                      <span className="text-xs font-bold">
                        {rejectedThisMonth}/{REJECTION_QUOTA}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          isOverQuota ? "bg-red-600" : rejectionPercentage >= 60 ? "bg-orange-500" : "bg-green-500"
                        }`}
                        style={{ width: `${Math.min(rejectionPercentage, 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium">{rejectedThisMonth}</span> this month{" "}
                    <span className="text-muted-foreground/60">({totalRejectedTasks} total)</span>
                  </div>
                  {isOverQuota && (
                    <Badge variant="destructive" className="text-xs">
                      Retraining Required
                    </Badge>
                  )}
                  {!isOverQuota && quotaRemaining <= 2 && quotaRemaining > 0 && (
                    <Badge variant="outline" className="text-xs border-orange-300 text-orange-700">
                      {quotaRemaining} remaining
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Performance Stats */}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">Total Tasks</p>
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="text-2xl font-bold">{totalTasks}</div>
                <p className="text-xs text-muted-foreground">{totalCompletedTasks} completed</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">Completion Rate</p>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="text-2xl font-bold">{completionRate}%</div>
                <p className="text-xs text-muted-foreground">All time average</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">On-Time</p>
                  <Award className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="text-2xl font-bold">{onTimeRate}%</div>
                <p className="text-xs text-muted-foreground">{onTimeTasks.length} tasks</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">Avg. Time</p>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="text-2xl font-bold">{combinedAvgTime}m</div>
                <p className="text-xs text-muted-foreground">Per task</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">Issues</p>
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="text-2xl font-bold text-red-600">{totalRejectedTasks}</div>
                <p className="text-xs text-muted-foreground">Rejected tasks</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
