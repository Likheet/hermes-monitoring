"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { BarChart3, TrendingUp, Clock, CheckCircle, AlertTriangle, Users, Activity } from "lucide-react"
import type { Task, Department, PriorityLevel } from "@/lib/types"

interface LazyAdminReportsProps {
  tasks: Task[]
}

// Performance metrics calculation
interface PerformanceMetrics {
  totalTasks: number
  completedTasks: number
  pendingTasks: number
  inProgressTasks: number
  rejectedTasks: number
  completionRate: number
  averageCompletionTime: number
  departmentStats: DepartmentStatsMap
  priorityStats: Record<PriorityLevel, number>
  qualityStats: {
    averageRating: number
    ratedTasks: number
    rejectedTasks: number
  }
}

interface DepartmentPerformance {
  total: number
  completed: number
  pending: number
  inProgress: number
  completionRate: number
}

type DepartmentStatsMap = Record<Department, DepartmentPerformance>

const createDepartmentPerformance = (): DepartmentPerformance => ({
  total: 0,
  completed: 0,
  pending: 0,
  inProgress: 0,
  completionRate: 0,
})

const createDepartmentStatsMap = (): DepartmentStatsMap => ({
  housekeeping: createDepartmentPerformance(),
  maintenance: createDepartmentPerformance(),
  front_office: createDepartmentPerformance(),
  admin: createDepartmentPerformance(),
  "housekeeping-dept": createDepartmentPerformance(),
  "maintenance-dept": createDepartmentPerformance(),
})

function calculatePerformanceMetrics(tasks: Task[]): PerformanceMetrics {
  const totalTasks = tasks.length
  const completedTasks = tasks.filter(t => t.status === "COMPLETED").length
  const pendingTasks = tasks.filter(t => t.status === "PENDING").length
  const inProgressTasks = tasks.filter(t => t.status === "IN_PROGRESS").length
  const rejectedTasks = tasks.filter(t => t.status === "REJECTED").length
  const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0

  // Calculate average completion time
  const completedTasksWithTime = tasks.filter(t =>
    t.status === "COMPLETED" && t.started_at && t.completed_at
  )
  const averageCompletionTime = completedTasksWithTime.length > 0
    ? completedTasksWithTime.reduce((sum, task) => {
        const start = new Date(task.started_at!.server).getTime()
        const end = new Date(task.completed_at!.server).getTime()
        return sum + (end - start) / (1000 * 60) // minutes
      }, 0) / completedTasksWithTime.length
    : 0

  // Department stats
  const departmentStats = createDepartmentStatsMap()

  for (const task of tasks) {
    const dept = task.department as keyof DepartmentStatsMap
    const stats = departmentStats[dept]
    stats.total += 1
    if (task.status === "COMPLETED") stats.completed += 1
    if (task.status === "PENDING") stats.pending += 1
    if (task.status === "IN_PROGRESS") stats.inProgress += 1
  }

  // Calculate completion rates per department
  for (const dept of Object.keys(departmentStats) as Array<keyof DepartmentStatsMap>) {
    const stats = departmentStats[dept]
    stats.completionRate = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0
  }

  // Priority stats
  const priorityStats: Record<PriorityLevel, number> = {
    GUEST_REQUEST: 0,
    TIME_SENSITIVE: 0,
    DAILY_TASK: 0,
    PREVENTIVE_MAINTENANCE: 0
  }

  tasks.forEach(task => {
    if (priorityStats[task.priority_level] !== undefined) {
      priorityStats[task.priority_level]++
    }
  })

  // Quality stats
  const ratedTasks = tasks.filter(t => t.rating !== null && t.rating !== undefined)
  const averageRating = ratedTasks.length > 0
    ? ratedTasks.reduce((sum, task) => sum + (task.rating || 0), 0) / ratedTasks.length
    : 0

  const qualityStats = {
    averageRating,
    ratedTasks: ratedTasks.length,
    rejectedTasks
  }

  return {
    totalTasks,
    completedTasks,
    pendingTasks,
    inProgressTasks,
    rejectedTasks,
    completionRate,
    averageCompletionTime,
    departmentStats,
    priorityStats,
    qualityStats
  }
}

export function LazyAdminReports({ tasks }: LazyAdminReportsProps) {
  const metrics = useMemo(() => calculatePerformanceMetrics(tasks), [tasks])

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalTasks}</div>
            <p className="text-xs text-muted-foreground">
              All time tasks
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.completionRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {metrics.completedTasks} of {metrics.totalTasks} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Completion Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(metrics.averageCompletionTime)}m</div>
            <p className="text-xs text-muted-foreground">
              Average time to complete
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quality Rating</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.qualityStats.averageRating.toFixed(1)}/5</div>
            <p className="text-xs text-muted-foreground">
              {metrics.qualityStats.ratedTasks} rated tasks
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Department Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Department Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Department</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Completed</TableHead>
                <TableHead>In Progress</TableHead>
                <TableHead>Pending</TableHead>
                <TableHead>Completion Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(metrics.departmentStats).map(([dept, stats]) => (
                <TableRow key={dept}>
                  <TableCell className="font-medium capitalize">
                    {dept.replace('_', ' ')}
                  </TableCell>
                  <TableCell>{stats.total}</TableCell>
                  <TableCell>{stats.completed}</TableCell>
                  <TableCell>{stats.inProgress}</TableCell>
                  <TableCell>{stats.pending}</TableCell>
                  <TableCell>
                    <Badge variant={stats.completionRate > 80 ? "default" : stats.completionRate > 50 ? "secondary" : "destructive"}>
                      {stats.completionRate.toFixed(1)}%
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Priority Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Priority Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(metrics.priorityStats).map(([priority, count]) => (
              <div key={priority} className="text-center">
                <div className="text-2xl font-bold">{count}</div>
                <div className="text-sm text-muted-foreground capitalize">
                  {priority.replace('_', ' ')}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quality Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Quality Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{metrics.qualityStats.ratedTasks}</div>
              <div className="text-sm text-muted-foreground">Rated Tasks</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{metrics.rejectedTasks}</div>
              <div className="text-sm text-muted-foreground">Rejected Tasks</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{metrics.qualityStats.averageRating.toFixed(1)}/5</div>
              <div className="text-sm text-muted-foreground">Average Rating</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}