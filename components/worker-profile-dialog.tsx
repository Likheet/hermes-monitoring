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
          <div className="bg-white rounded-xl p-6 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)]">
            <div className="flex flex-col sm:flex-row items-start gap-6">
              <div className="relative shrink-0 flex flex-col items-center gap-3">
                <div className="relative">
                  {/* Circular progress ring */}
                  <svg className="absolute inset-0 -rotate-90" width="88" height="88" viewBox="0 0 88 88">
                    <circle
                      cx="44"
                      cy="44"
                      r="42"
                      fill="none"
                      stroke="#F3F4F6"
                      strokeWidth="3"
                    />
                    <circle
                      cx="44"
                      cy="44"
                      r="42"
                      fill="none"
                      stroke="black"
                      strokeWidth="3"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                      className="transition-all duration-500"
                    />
                  </svg>
                  <Avatar className="h-20 w-20 m-1 border-2 border-white shadow-sm">
                    <AvatarFallback className="text-2xl bg-gray-100 text-black font-bold">{initials}</AvatarFallback>
                  </Avatar>
                </div>
                {/* Rating badge */}
                <div className="bg-black text-white rounded-full px-3 py-1 flex items-center gap-1.5 shadow-sm">
                  <Star className="h-3.5 w-3.5 fill-white text-white" />
                  <span className="text-sm font-bold">{avgRating}</span>
                </div>
                {tasksWithRating.length > 0 && (
                  <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">
                    {tasksWithRating.length} {tasksWithRating.length === 1 ? "rating" : "ratings"}
                  </span>
                )}
              </div>

              <div className="flex-1 min-w-0 pt-1">
                <h2 className="text-2xl font-bold text-black mb-1">{worker.name}</h2>
                <p className="text-sm text-gray-500 font-medium uppercase tracking-wide mb-3">{worker.role}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="bg-gray-100 text-gray-600 hover:bg-gray-200 border-none rounded-lg px-3 py-1">
                    {worker.department}
                  </Badge>
                  <span className="text-sm text-gray-500 px-2 border-l border-gray-200">{worker.phone || "Not set"}</span>
                  <span className="text-sm text-gray-500 px-2 border-l border-gray-200">
                    {worker.shift_start && worker.shift_end
                      ? formatShiftRange(worker.shift_start, worker.shift_end)
                      : "Not set"}
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-start sm:items-end gap-2 min-w-[140px] bg-gray-50 p-4 rounded-xl w-full sm:w-auto">
                <div className="w-full">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Rejections</span>
                    <span className="text-xs font-bold text-black">
                      {rejectedThisMonth}/{REJECTION_QUOTA}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 rounded-full ${
                        isOverQuota ? "bg-red-600" : rejectionPercentage >= 60 ? "bg-orange-500" : "bg-black"
                      }`}
                      style={{ width: `${Math.min(rejectionPercentage, 100)}%` }}
                    />
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  <span className="font-bold text-black">{rejectedThisMonth}</span> this month{" "}
                  <span className="text-gray-400">({totalRejectedTasks} total)</span>
                </div>
                {isOverQuota && (
                  <Badge variant="destructive" className="text-[10px] uppercase tracking-wider font-bold">
                    Retraining Required
                  </Badge>
                )}
                {!isOverQuota && quotaRemaining <= 2 && quotaRemaining > 0 && (
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wider font-bold border-orange-200 text-orange-600 bg-orange-50">
                    {quotaRemaining} remaining
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Performance Stats */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
            <div className="bg-white rounded-xl p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)]">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Tasks</p>
                <CheckCircle2 className="h-4 w-4 text-gray-300" />
              </div>
              <div className="text-2xl font-bold text-black">{totalTasks}</div>
              <p className="text-xs text-gray-500 mt-1">{totalCompletedTasks} completed</p>
            </div>

            <div className="bg-white rounded-xl p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)]">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">On-Time</p>
                <Award className="h-4 w-4 text-gray-300" />
              </div>
              <div className="text-2xl font-bold text-black">{onTimeRate}%</div>
              <p className="text-xs text-gray-500 mt-1">{onTimeTasks.length} tasks</p>
            </div>

            <div className="bg-white rounded-xl p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)]">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Speed</p>
                <Clock className="h-4 w-4 text-gray-300" />
              </div>
              {hasSpeedData ? (
                <>
                  <div className="text-2xl font-bold">
                    <span className={isFaster ? "text-green-600" : "text-red-600"}>
                      {isFaster ? "+" : ""}{Math.round(avgSpeedPercent)}%
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {isFaster ? "Faster" : "Slower"} than expected
                  </p>
                </>
              ) : (
                <>
                  <div className="text-2xl font-bold text-gray-300">—</div>
                  <p className="text-xs text-gray-500 mt-1">No data yet</p>
                </>
              )}
            </div>

            <div className="bg-white rounded-xl p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)]">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Issues</p>
                <AlertTriangle className="h-4 w-4 text-gray-300" />
              </div>
              <div className="text-2xl font-bold text-red-600">{totalRejectedTasks}</div>
              <p className="text-xs text-gray-500 mt-1">Rejected tasks</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
