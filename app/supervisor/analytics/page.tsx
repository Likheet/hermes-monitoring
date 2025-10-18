"use client"

import { ProtectedRoute } from "@/components/protected-route"
import { useAuth } from "@/lib/auth-context"
import { useTasks } from "@/lib/task-context"
import { PerformanceCard } from "@/components/analytics/performance-card"
import { WorkerPerformanceTable } from "@/components/analytics/worker-performance-table"
import { calculateDepartmentStats, calculateWorkerPerformance, getTasksByPriority } from "@/lib/analytics-utils"
import { SupervisorBottomNav } from "@/components/supervisor/supervisor-bottom-nav"

function AnalyticsDashboard() {
  const { user } = useAuth()
  const { tasks, users } = useTasks()

  // Filter tasks by department
  const departmentTasks = tasks.filter((task) => {
    const worker = users.find((u) => u.id === task.assigned_to_user_id)
    const taskDepartment = task.department || worker?.department
    if (!user?.department) return true
    return taskDepartment === user.department
  })

  const departmentStats = calculateDepartmentStats(departmentTasks)
  const priorityBreakdown = getTasksByPriority(departmentTasks)

  // Get worker performance
  const departmentWorkers = users.filter((u) => u.role === "worker" && u.department === user?.department)
  const workerPerformance = departmentWorkers.map((worker) =>
    calculateWorkerPerformance(departmentTasks, worker.id, worker.name),
  )

  // Sort by on-time rate
  const sortedWorkers = [...workerPerformance].sort((a, b) => b.onTimeRate - a.onTimeRate)

  return (
    <div className="min-h-screen bg-muted/30 pb-20">
      <header className="border-b bg-background sticky top-0 z-40">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <h1 className="text-xl sm:text-2xl font-bold">Analytics Dashboard</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">{user?.department} Department</p>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
        <section>
          <h2 className="text-base sm:text-lg font-semibold mb-3">Department Overview</h2>
          <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <PerformanceCard title="Total Tasks" value={departmentStats.totalTasks} subtitle="All time" />
            <PerformanceCard
              title="Completed"
              value={departmentStats.completedTasks}
              subtitle={`${Math.round((departmentStats.completedTasks / departmentStats.totalTasks) * 100)}% completion rate`}
            />
            <PerformanceCard
              title="Avg Completion Time"
              value={`${departmentStats.avgCompletionTime}m`}
              subtitle="Per task"
            />
            <PerformanceCard
              title="On-Time Rate"
              value={`${departmentStats.onTimeRate}%`}
              trend={departmentStats.onTimeRate >= 75 ? "up" : "down"}
            />
          </div>
        </section>

        <section>
          <h2 className="text-base sm:text-lg font-semibold mb-3">Current Status</h2>
          <div className="grid gap-3 sm:gap-4 sm:grid-cols-3">
            <PerformanceCard title="Pending Tasks" value={departmentStats.pendingTasks} />
            <PerformanceCard title="In Progress" value={departmentStats.inProgressTasks} />
            <PerformanceCard
              title="Escalation Rate"
              value={`${departmentStats.escalationRate}%`}
              trend={departmentStats.escalationRate < 10 ? "up" : "down"}
            />
          </div>
        </section>

        <section>
          <h2 className="text-base sm:text-lg font-semibold mb-3">Priority Breakdown</h2>
          <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <PerformanceCard title="Guest Requests" value={priorityBreakdown.guestRequest} subtitle="Urgent" />
            <PerformanceCard title="Time Sensitive" value={priorityBreakdown.timeSensitive} subtitle="High priority" />
            <PerformanceCard title="Daily Tasks" value={priorityBreakdown.dailyTask} subtitle="Regular" />
            <PerformanceCard
              title="Preventive Maintenance"
              value={priorityBreakdown.preventiveMaintenance}
              subtitle="Scheduled"
            />
          </div>
        </section>

        <section>
          <WorkerPerformanceTable workers={sortedWorkers} />
        </section>
      </main>

      <SupervisorBottomNav />
    </div>
  )
}

export default function AnalyticsPage() {
  return (
    <ProtectedRoute allowedRoles={["supervisor"]}>
      <AnalyticsDashboard />
    </ProtectedRoute>
  )
}
