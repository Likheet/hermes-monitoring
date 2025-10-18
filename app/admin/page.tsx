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
  Home,
  UserCog,
  FileSpreadsheet,
  FileText,
  BarChart3,
  AlertCircle,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useRealtimeTasks } from "@/lib/use-realtime-tasks"
import { ConnectionStatus } from "@/components/connection-status"
import Link from "next/link"
import { CATEGORY_LABELS } from "@/lib/task-definitions"
import { useState } from "react"
import type { User } from "@/lib/types"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"

function AdminDashboard() {
  const { user, logout } = useAuth()
  const { tasks, users, maintenanceTasks } = useTasks()
  const router = useRouter()
  const { isConnected } = useRealtimeTasks({ enabled: true })

  const [activeTab, setActiveTab] = useState<"home" | "staff">("home")
  const [analyticsTab, setAnalyticsTab] = useState<"peak" | "trends">("peak")

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

  const calculateDepartmentStats = (department: "housekeeping" | "maintenance") => {
    const departmentWorkers = workers.filter((w) => w.department === department)
    const departmentTasks = filteredTasks.filter((t) => {
      const worker = users.find((u) => u.id === t.assigned_to_user_id)
      return worker?.department === department
    })
    const departmentMaintenanceTasks = (maintenanceTasks || []).filter((t) => {
      const worker = users.find((u) => u.id === t.assigned_to)
      return worker?.department === department
    })

    const totalTasks = departmentTasks.length + departmentMaintenanceTasks.length
    const completedTasks =
      departmentTasks.filter((t) => t.status === "COMPLETED").length +
      departmentMaintenanceTasks.filter((t) => t.status === "completed").length
    const completionRate = totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) : "0.0"

    const ratedTasks = departmentTasks.filter((t) => t.rating && t.rating > 0)
    const avgRating =
      ratedTasks.length > 0
        ? (ratedTasks.reduce((sum, t) => sum + (t.rating || 0), 0) / ratedTasks.length).toFixed(1)
        : "N/A"

    const completedWithDuration = departmentTasks.filter((t) => t.status === "COMPLETED" && t.actual_duration_minutes)
    const avgDuration =
      completedWithDuration.length > 0
        ? Math.round(
            completedWithDuration.reduce((sum, t) => sum + (t.actual_duration_minutes || 0), 0) /
              completedWithDuration.length,
          )
        : 0

    const availableWorkers = departmentWorkers.filter((w) => !getWorkerCurrentTask(w.id)).length

    return {
      totalWorkers: departmentWorkers.length,
      totalTasks,
      completedTasks,
      completionRate,
      avgRating,
      avgDuration,
      availableWorkers,
    }
  }

  const housekeepingStats = calculateDepartmentStats("housekeeping")
  const maintenanceStats = calculateDepartmentStats("maintenance")

  const exportToExcel = () => {
    // Dynamic import to avoid SSR issues
    import("xlsx").then((XLSX) => {
      const workersData = workers.map((worker) => {
        const performance = calculateWorkerPerformance(worker.id)
        const currentTask = getWorkerCurrentTask(worker.id)
        const stats = getWorkerStats(worker.id)

        return {
          Name: worker.name,
          Department: worker.department,
          "Shift Hours": performance?.shiftHours || "0",
          "Worked Hours": performance?.actualWorkHours || "0",
          "Idle Hours": performance?.idleHours || "0",
          "Discrepancy %": performance?.discrepancyPercent || "0",
          "Avg Rating": performance?.avgRating || "N/A",
          "Total Ratings": performance?.totalRatings || 0,
          Status: currentTask ? "Working" : "Available",
          "Total Tasks": stats.totalTasks,
          "Completed Tasks": stats.completedTasks,
          "Rejected Tasks": stats.rejectedTasks,
        }
      })

      const ws = XLSX.utils.json_to_sheet(workersData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Staff Performance")

      // Add department summary sheet
      const deptData = [
        {
          Department: "Housekeeping",
          "Total Workers": housekeepingStats.totalWorkers,
          "Total Tasks": housekeepingStats.totalTasks,
          "Completed Tasks": housekeepingStats.completedTasks,
          "Completion Rate": `${housekeepingStats.completionRate}%`,
          "Avg Rating": housekeepingStats.avgRating,
          "Avg Duration": `${housekeepingStats.avgDuration} min`,
          "Available Workers": housekeepingStats.availableWorkers,
        },
        {
          Department: "Maintenance",
          "Total Workers": maintenanceStats.totalWorkers,
          "Total Tasks": maintenanceStats.totalTasks,
          "Completed Tasks": maintenanceStats.completedTasks,
          "Completion Rate": `${maintenanceStats.completionRate}%`,
          "Avg Rating": maintenanceStats.avgRating,
          "Avg Duration": `${maintenanceStats.avgDuration} min`,
          "Available Workers": maintenanceStats.availableWorkers,
        },
      ]

      const deptWs = XLSX.utils.json_to_sheet(deptData)
      XLSX.utils.book_append_sheet(wb, deptWs, "Department Summary")

      const dateRange =
        timeRange === "custom" && customStartDate && customEndDate
          ? `${customStartDate}_to_${customEndDate}`
          : timeRange
      XLSX.writeFile(wb, `staff_performance_${dateRange}_${new Date().toISOString().split("T")[0]}.xlsx`)
    })
  }

  const exportToPDF = () => {
    import("jspdf").then((jsPDFModule) => {
      const { jsPDF } = jsPDFModule
      const doc = new jsPDF()

      // Add title
      doc.setFontSize(18)
      doc.setFont("helvetica", "bold")
      doc.text("Staff Performance Report", 14, 20)

      // Add date range
      doc.setFontSize(10)
      doc.setFont("helvetica", "normal")
      const dateRangeText =
        timeRange === "custom" && customStartDate && customEndDate
          ? `${customStartDate} to ${customEndDate}`
          : timeRange === "week"
            ? "Last 7 Days"
            : timeRange === "month"
              ? "Last 30 Days"
              : "All Time"
      doc.text(`Period: ${dateRangeText}`, 14, 28)
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 34)

      // Add department summary section
      doc.setFontSize(14)
      doc.setFont("helvetica", "bold")
      doc.text("Department Summary", 14, 45)

      // Draw department summary table
      doc.setFontSize(9)
      doc.setFont("helvetica", "normal")
      let yPos = 52

      // Table headers
      doc.setFillColor(59, 130, 246)
      doc.rect(14, yPos, 182, 8, "F")
      doc.setTextColor(255, 255, 255)
      doc.setFont("helvetica", "bold")
      doc.text("Department", 16, yPos + 5)
      doc.text("Workers", 60, yPos + 5)
      doc.text("Tasks", 85, yPos + 5)
      doc.text("Completion", 110, yPos + 5)
      doc.text("Rating", 145, yPos + 5)
      doc.text("Avg Duration", 170, yPos + 5)

      // Reset text color
      doc.setTextColor(0, 0, 0)
      doc.setFont("helvetica", "normal")
      yPos += 8

      // Housekeeping row
      doc.rect(14, yPos, 182, 7)
      doc.text("Housekeeping", 16, yPos + 5)
      doc.text(housekeepingStats.totalWorkers.toString(), 60, yPos + 5)
      doc.text(housekeepingStats.totalTasks.toString(), 85, yPos + 5)
      doc.text(`${housekeepingStats.completionRate}%`, 110, yPos + 5)
      doc.text(housekeepingStats.avgRating, 145, yPos + 5)
      doc.text(`${housekeepingStats.avgDuration} min`, 170, yPos + 5)
      yPos += 7

      // Maintenance row
      doc.rect(14, yPos, 182, 7)
      doc.text("Maintenance", 16, yPos + 5)
      doc.text(maintenanceStats.totalWorkers.toString(), 60, yPos + 5)
      doc.text(maintenanceStats.totalTasks.toString(), 85, yPos + 5)
      doc.text(`${maintenanceStats.completionRate}%`, 110, yPos + 5)
      doc.text(maintenanceStats.avgRating, 145, yPos + 5)
      doc.text(`${maintenanceStats.avgDuration} min`, 170, yPos + 5)
      yPos += 15

      // Add worker performance section
      doc.setFontSize(14)
      doc.setFont("helvetica", "bold")
      doc.text("Worker Performance", 14, yPos)
      yPos += 7

      // Worker performance table headers
      doc.setFontSize(8)
      doc.setFillColor(59, 130, 246)
      doc.rect(14, yPos, 182, 7, "F")
      doc.setTextColor(255, 255, 255)
      doc.setFont("helvetica", "bold")
      doc.text("Name", 16, yPos + 4.5)
      doc.text("Dept", 50, yPos + 4.5)
      doc.text("Shift", 75, yPos + 4.5)
      doc.text("Worked", 95, yPos + 4.5)
      doc.text("Idle", 120, yPos + 4.5)
      doc.text("Disc%", 140, yPos + 4.5)
      doc.text("Rating", 160, yPos + 4.5)
      doc.text("Status", 180, yPos + 4.5)

      doc.setTextColor(0, 0, 0)
      doc.setFont("helvetica", "normal")
      yPos += 7

      // Worker rows
      workers.forEach((worker, index) => {
        const performance = calculateWorkerPerformance(worker.id)
        const currentTask = getWorkerCurrentTask(worker.id)

        if (!performance) return

        // Check if we need a new page
        if (yPos > 270) {
          doc.addPage()
          yPos = 20
        }

        // Alternate row colors
        if (index % 2 === 0) {
          doc.setFillColor(245, 245, 245)
          doc.rect(14, yPos, 182, 6, "F")
        }

        doc.text(worker.name.substring(0, 15), 16, yPos + 4)
        doc.text(worker.department.substring(0, 8), 50, yPos + 4)
        doc.text(`${performance.shiftHours}h`, 75, yPos + 4)
        doc.text(`${performance.actualWorkHours}h`, 95, yPos + 4)
        doc.text(`${performance.idleHours}h`, 120, yPos + 4)
        doc.text(`${performance.discrepancyPercent}%`, 140, yPos + 4)
        doc.text(performance.avgRating, 160, yPos + 4)
        doc.text(currentTask ? "Working" : "Available", 180, yPos + 4)

        yPos += 6
      })

      // Save the PDF
      const filename = `staff_performance_${dateRangeText.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`
      doc.save(filename)
    })
  }

  const getHourlyDistribution = () => {
    const hourCounts = Array(24).fill(0)
    const hourCompletions = Array(24).fill(0)

    filteredTasks.forEach((task) => {
      const assignedHour = new Date(task.assigned_at.client).getHours()
      hourCounts[assignedHour]++

      if (task.status === "COMPLETED" && task.completed_at) {
        const completedHour = new Date(task.completed_at.client).getHours()
        hourCompletions[completedHour]++
      }
    })

    return Array.from({ length: 24 }, (_, i) => ({
      hour: `${i.toString().padStart(2, "0")}:00`,
      created: hourCounts[i],
      completed: hourCompletions[i],
    }))
  }

  const getMonthlyTrends = () => {
    const monthlyData: Record<
      string,
      { total: number; completed: number; rejected: number; avgDuration: number; durationCount: number }
    > = {}

    filteredTasks.forEach((task) => {
      const date = new Date(task.assigned_at.client)
      const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}`

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { total: 0, completed: 0, rejected: 0, avgDuration: 0, durationCount: 0 }
      }

      monthlyData[monthKey].total++

      if (task.status === "COMPLETED") {
        monthlyData[monthKey].completed++
        if (task.actual_duration_minutes) {
          monthlyData[monthKey].avgDuration += task.actual_duration_minutes
          monthlyData[monthKey].durationCount++
        }
      }

      if (task.status === "REJECTED") {
        monthlyData[monthKey].rejected++
      }
    })

    return Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, data]) => ({
        month: new Date(month + "-01").toLocaleDateString("en-US", { month: "short", year: "numeric" }),
        completionRate: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
        rejectionRate: data.total > 0 ? Math.round((data.rejected / data.total) * 100) : 0,
        avgDuration: data.durationCount > 0 ? Math.round(data.avgDuration / data.durationCount) : 0,
        totalTasks: data.total,
      }))
  }

  const getWorkerRejectionTrends = () => {
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()

    return workers.map((worker) => {
      const workerTasks = filteredTasks.filter((t) => t.assigned_to_user_id === worker.id)
      const currentMonthTasks = workerTasks.filter((t) => {
        const taskDate = new Date(t.assigned_at.client)
        return taskDate.getMonth() === currentMonth && taskDate.getFullYear() === currentYear
      })

      const rejections = currentMonthTasks.filter((t) => t.status === "REJECTED").length
      const completionRate =
        currentMonthTasks.length > 0
          ? Math.round(
              (currentMonthTasks.filter((t) => t.status === "COMPLETED").length / currentMonthTasks.length) * 100,
            )
          : 0

      const previousMonthTasks = workerTasks.filter((t) => {
        const taskDate = new Date(t.assigned_at.client)
        const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1
        const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear
        return taskDate.getMonth() === prevMonth && taskDate.getFullYear() === prevYear
      })

      const prevCompletionRate =
        previousMonthTasks.length > 0
          ? Math.round(
              (previousMonthTasks.filter((t) => t.status === "COMPLETED").length / previousMonthTasks.length) * 100,
            )
          : 0

      const trend = completionRate - prevCompletionRate

      return {
        name: worker.name,
        rejections,
        completionRate,
        trend,
        isAtRisk: rejections >= 4,
        isImproving: trend > 10,
        isDeclining: trend < -10,
      }
    })
  }

  const getPeakHours = () => {
    const hourlyData = getHourlyDistribution()
    const sorted = [...hourlyData].sort((a, b) => b.created - a.created)
    return sorted.slice(0, 3)
  }

  const hourlyData = getHourlyDistribution()
  const monthlyTrends = getMonthlyTrends()
  const workerRejectionData = getWorkerRejectionTrends()
  const peakHours = getPeakHours()

  return (
    <div className="min-h-screen bg-background pb-20">
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
        {activeTab === "home" && (
          <>
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

            <Tabs defaultValue="audit" className="space-y-6">
              <TabsList className="w-full justify-start overflow-x-auto bg-muted/50">
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
                                          <Badge
                                            variant="outline"
                                            className="text-xs text-orange-600 border-orange-600"
                                          >
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
          </>
        )}

        {activeTab === "staff" && (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="border-l-4 border-l-blue-500">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="h-5 w-5 text-blue-500" />
                    Housekeeping Department
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Workers</p>
                      <p className="text-2xl font-bold">{housekeepingStats.totalWorkers}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Available</p>
                      <p className="text-2xl font-bold text-green-600">{housekeepingStats.availableWorkers}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Completion Rate</p>
                      <p className="text-2xl font-bold">{housekeepingStats.completionRate}%</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Avg Rating</p>
                      <p className="text-2xl font-bold">
                        {housekeepingStats.avgRating !== "N/A" ? `${housekeepingStats.avgRating} ⭐` : "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Tasks</p>
                      <p className="text-xl font-semibold">{housekeepingStats.totalTasks}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Avg Duration</p>
                      <p className="text-xl font-semibold">{housekeepingStats.avgDuration} min</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-orange-500">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Activity className="h-5 w-5 text-orange-500" />
                    Maintenance Department
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Workers</p>
                      <p className="text-2xl font-bold">{maintenanceStats.totalWorkers}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Available</p>
                      <p className="text-2xl font-bold text-green-600">{maintenanceStats.availableWorkers}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Completion Rate</p>
                      <p className="text-2xl font-bold">{maintenanceStats.completionRate}%</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Avg Rating</p>
                      <p className="text-2xl font-bold">
                        {maintenanceStats.avgRating !== "N/A" ? `${maintenanceStats.avgRating} ⭐` : "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Tasks</p>
                      <p className="text-xl font-semibold">{maintenanceStats.totalTasks}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Avg Duration</p>
                      <p className="text-xl font-semibold">{maintenanceStats.avgDuration} min</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <CardTitle>Staff Performance Overview</CardTitle>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={exportToExcel}
                      className="min-h-[44px] whitespace-nowrap bg-transparent"
                    >
                      <FileSpreadsheet className="mr-2 h-4 w-4" />
                      Export Excel
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={exportToPDF}
                      className="min-h-[44px] whitespace-nowrap bg-transparent"
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Export PDF
                    </Button>
                    <div className="flex items-center gap-2">
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
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Analytics & Insights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs value={analyticsTab} onValueChange={(v) => setAnalyticsTab(v as any)} className="space-y-6">
                  <TabsList className="w-full justify-start overflow-x-auto bg-muted/50">
                    <TabsTrigger value="peak" className="whitespace-nowrap">
                      Peak Time Analysis
                    </TabsTrigger>
                    <TabsTrigger value="trends" className="whitespace-nowrap">
                      Trend Analysis
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="peak" className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-3">
                      {peakHours.map((hour, index) => (
                        <Card key={hour.hour}>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                              Peak Hour #{index + 1}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold">{hour.hour}</div>
                            <p className="text-sm text-muted-foreground mt-1">{hour.created} tasks created</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Hourly Task Distribution</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={hourlyData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="hour" tick={{ fontSize: 12 }} />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="created" fill="#3b82f6" name="Tasks Created" />
                            <Bar dataKey="completed" fill="#10b981" name="Tasks Completed" />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Staffing Recommendations</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {peakHours.slice(0, 2).map((hour) => (
                            <div key={hour.hour} className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                              <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                              <div>
                                <p className="font-medium text-sm">High Activity at {hour.hour}</p>
                                <p className="text-sm text-muted-foreground">
                                  Consider scheduling additional staff during this period. {hour.created} tasks
                                  typically created.
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="trends" className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Completion Rate Trends (Last 6 Months)</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <LineChart data={monthlyTrends}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Line
                              type="monotone"
                              dataKey="completionRate"
                              stroke="#10b981"
                              strokeWidth={2}
                              name="Completion Rate %"
                            />
                            <Line
                              type="monotone"
                              dataKey="rejectionRate"
                              stroke="#ef4444"
                              strokeWidth={2}
                              name="Rejection Rate %"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Average Task Duration Trends</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <AreaChart data={monthlyTrends}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Area
                              type="monotone"
                              dataKey="avgDuration"
                              stroke="#f59e0b"
                              fill="#fef3c7"
                              name="Avg Duration (min)"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Monthly Task Volume</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={monthlyTrends}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="totalTasks" fill="#8b5cf6" name="Total Tasks" />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
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
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-around h-16">
            <button
              onClick={() => setActiveTab("home")}
              className={`flex flex-col items-center justify-center gap-1 px-6 py-2 rounded-lg transition-colors min-h-[56px] flex-1 ${
                activeTab === "home"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <Home className="h-5 w-5" />
              <span className="text-xs font-medium">Home</span>
            </button>
            <button
              onClick={() => setActiveTab("staff")}
              className={`flex flex-col items-center justify-center gap-1 px-6 py-2 rounded-lg transition-colors min-h-[56px] flex-1 ${
                activeTab === "staff"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <UserCog className="h-5 w-5" />
              <span className="text-xs font-medium">Staff</span>
            </button>
          </div>
        </div>
      </nav>
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
