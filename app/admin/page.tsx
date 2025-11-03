"use client"

import { ProtectedRoute } from "@/components/protected-route"
import { WorkerStatusCard } from "@/components/worker-status-card"
import { WorkerProfileDialog } from "@/components/worker-profile-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  LogOut,
  ClipboardList,
  Clock,
  CheckCircle,
  AlertTriangle,
  Users,
  Activity,
  UserPlus,
  Calendar,
  Star,
  Home,
  UserCog,
  FileText,
  BarChart3,
  AlertCircle,
  UserIcon,
  MapPin,
  X,
  ChevronDown,
  ChevronUp,
  Save,
  Edit,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { useTasks } from "@/lib/task-context"
import { useRealtimeTasks } from "@/lib/use-realtime-tasks-optimized"
import { CATEGORY_LABELS } from "@/lib/task-definitions"
import { useMemo, useState } from "react"
import type { User, PriorityLevel, Priority, Department, Task } from "@/lib/types"
import type { MaintenanceTask } from "@/lib/maintenance-types"
import { TaskSearch } from "@/components/task-search"
import { TaskAssignmentForm, type TaskAssignmentData } from "@/components/task-assignment-form"
import type { TaskDefinition, TaskCategory } from "@/lib/task-definitions"
import { createDualTimestamp } from "@/lib/mock-data"
import { useToast } from "@/hooks/use-toast"
import { formatShiftRange } from "@/lib/date-utils"
import { getWorkerShiftForDate, isWorkerOnShiftFromUser } from "@/lib/shift-utils"
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
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { WeeklyScheduleView } from "@/components/shift/weekly-schedule-view"

function mapPriorityToPriorityLevel(priority: Priority, category: TaskCategory): PriorityLevel {
  if (category === "GUEST_REQUEST") return "GUEST_REQUEST"
  if (category === "TIME_SENSITIVE") return "TIME_SENSITIVE"
  if (category === "PREVENTIVE_MAINTENANCE") return "PREVENTIVE_MAINTENANCE"
  return "DAILY_TASK"
}

const DEPARTMENT_SORT_ORDER = ["housekeeping", "maintenance", "front_office"] as const

type ShiftSortOption = "status" | "department" | "name"

function AdminDashboard() {
  const { user, logout } = useAuth()
  const {
    tasks,
    users,
    maintenanceTasks,
    createTask,
    shiftSchedules,
    updateShiftSchedule,
    usersLoaded,
    usersLoadError,
  } = useTasks()
  const router = useRouter()
  useRealtimeTasks({ enabled: true })
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState<"home" | "staff" | "tasks" | "operations">("home")
  const [analyticsTab, setAnalyticsTab] = useState<"peak" | "trends">("peak")

  const [taskFilterStatus, setTaskFilterStatus] = useState<string | null>(null)

  const [selectedTaskDef, setSelectedTaskDef] = useState<TaskDefinition | null>(null)

  const timeRange: "week" | "month" | "all" | "custom" = "all"
  const customStartDate = ""
  const customEndDate = ""
  const [selectedWorker, setSelectedWorker] = useState<User | null>(null)
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false)

  const [showTasksModal, setShowTasksModal] = useState(false)
  const [showWorkersModal, setShowWorkersModal] = useState(false)
  const [selectedWorkerDetail, setSelectedWorkerDetail] = useState<User | null>(null)

  const [showShiftManagement, setShowShiftManagement] = useState(false)
  const [editingShift, setEditingShift] = useState<{
    workerId: string
    start_time: string
    end_time: string
  } | null>(null)
  const [shiftSortOption, setShiftSortOption] = useState<ShiftSortOption>("status")

  const [showPendingModal, setShowPendingModal] = useState(false)
  const [pendingModalTab, setPendingModalTab] = useState<"tasks" | "verifications">("tasks")

  const handleLogout = () => {
    logout()
    router.push("/login")
  }

  const handleWorkerClick = (worker: User) => {
    setSelectedWorker(worker)
    setIsProfileDialogOpen(true)
  }

  // Modified handleSaveShift to use the new editingShift state and updateShiftSchedule
  const handleSaveShift = async () => {
    if (!editingShift) return

    try {
      const today = new Date()
      await updateShiftSchedule(editingShift.workerId, today, {
        shift_start: editingShift.start_time,
        shift_end: editingShift.end_time,
      })

      toast({
        title: "Success",
        description: "Shift schedule updated successfully",
      })
      setEditingShift(null)
  } catch {
      toast({
        title: "Error",
        description: "Failed to update shift schedule",
        variant: "destructive",
      })
    }
  }

  const isManagedStaff = (user: User) => user.role === "worker" || user.role === "front_office"

  const workersList = useMemo(() => users.filter(isManagedStaff), [users]) // Renamed to workersList for clarity

  const today = useMemo(() => new Date(), [])

  const sortedManagedStaff = useMemo(() => {
    const getStatusRank = (worker: User) => {
      const todayShift = getWorkerShiftForDate(worker, today, shiftSchedules)
      if (todayShift.is_override) return 2
      const availability = isWorkerOnShiftFromUser(worker)
      if (availability.status === "OFF_DUTY") return 2
      if (availability.status === "SHIFT_BREAK") return 1
      if (!todayShift.shift_start || !todayShift.shift_end) return 1
      return 0
    }

    return [...workersList].sort((a, b) => {
      switch (shiftSortOption) {
        case "name":
          return a.name.localeCompare(b.name)
        case "department": {
          const deptRank = (dept: string) => {
            const index = DEPARTMENT_SORT_ORDER.indexOf(dept as (typeof DEPARTMENT_SORT_ORDER)[number])
            return index === -1 ? DEPARTMENT_SORT_ORDER.length : index
          }
          const compare = deptRank(a.department) - deptRank(b.department)
          if (compare !== 0) return compare
          return a.name.localeCompare(b.name)
        }
        case "status":
        default: {
          const statusCompare = getStatusRank(a) - getStatusRank(b)
          if (statusCompare !== 0) return statusCompare
          return a.name.localeCompare(b.name)
        }
      }
    })
  }, [workersList, shiftSortOption, shiftSchedules, today])

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
  const completedTasks = filteredTasks.filter((t) => t.status === "COMPLETED").length

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

  type StaffStatusEntry = {
    worker: User
    currentTask: Task | MaintenanceTask | undefined
    isOffDuty: boolean
    isAvailable: boolean
  }

  const staffStatus: StaffStatusEntry[] = workersList.map((worker) => {
    const currentTask = getWorkerCurrentTask(worker.id)
    const todayShift = getWorkerShiftForDate(worker, today, shiftSchedules)
    const availability = isWorkerOnShiftFromUser(worker)
    const isOffDuty = Boolean(todayShift.is_override) || availability.status === "OFF_DUTY"
    const isAvailable = !currentTask && !isOffDuty

    return {
      worker,
      currentTask,
      isOffDuty,
      isAvailable,
    }
  })

  const availableWorkers = staffStatus.filter((entry) => entry.isAvailable).map((entry) => entry.worker)

  const availableStaffEntries = staffStatus
    .filter((entry) => !entry.currentTask)
    .sort((a, b) => Number(a.isOffDuty) - Number(b.isOffDuty))

  const busyStaffEntries = staffStatus.filter(
    (entry): entry is StaffStatusEntry & { currentTask: Task | MaintenanceTask } =>
      Boolean(entry.currentTask) && !entry.isOffDuty,
  )

  const busyWorkers = busyStaffEntries.map((entry) => entry.worker)

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

  const recentCustomTasks = customTasks.slice(0, 10)

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

  const calculateDepartmentStats = (department: Department) => {
    const departmentStaffEntries = staffStatus.filter((entry) => entry.worker.department === department)
    const departmentWorkers = departmentStaffEntries.map((entry) => entry.worker)
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

    const departmentCompletedTasksWithDuration = departmentTasks.filter(
      (t) => t.status === "COMPLETED" && t.actual_duration_minutes,
    )

    const avgDuration =
      departmentCompletedTasksWithDuration.length > 0
        ? Math.round(
            departmentCompletedTasksWithDuration.reduce((sum, t) => sum + (t.actual_duration_minutes || 0), 0) /
              departmentCompletedTasksWithDuration.length,
          )
        : 0

    const availableWorkers = departmentStaffEntries.filter((entry) => entry.isAvailable).length

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
  const frontDeskStats = calculateDepartmentStats("front_office")

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

  const getPeakHours = () => {
    const hourlyData = getHourlyDistribution()
    const sorted = [...hourlyData].sort((a, b) => b.created - a.created)
    return sorted.slice(0, 3)
  }

  const hourlyData = getHourlyDistribution()
  const monthlyTrends = getMonthlyTrends()
  const peakHours = getPeakHours()

  // Renamed pendingVerificationTasks to pendingVerificationsList for consistency
  const pendingVerificationsList = tasks.filter((t) => t.status === "COMPLETED")
  // Renamed allPendingTasks to pendingTasksList for consistency
  const pendingTasksList = tasks.filter((t) => t.status === "PENDING")
  const allInProgressTasks = tasks.filter((t) => t.status === "IN_PROGRESS" || t.status === "PAUSED")

  const handleTaskSelect = (task: TaskDefinition) => {
    setSelectedTaskDef(task)
  }

  const handleCancelTaskCreation = () => {
    setSelectedTaskDef(null)
  }

  const handleSubmitTask = async (data: TaskAssignmentData) => {
    if (!user) {
      toast({
        title: "Error",
        description: "User not authenticated",
        variant: "destructive",
      })
      return
    }

    const priorityLevel = mapPriorityToPriorityLevel(data.priority, data.category)

    const trimmedCustomName = data.customTaskName?.trim()
    const isCustomTask = data.isCustomTask && !!trimmedCustomName
    const taskName = isCustomTask ? trimmedCustomName! : data.taskName

    const success = await createTask({
      task_type: taskName,
      priority_level: priorityLevel,
      status: "PENDING",
      department: data.department as Department,
      assigned_to_user_id: data.assignedTo,
      assigned_by_user_id: user.id,
      assigned_at: createDualTimestamp(),
      started_at: null,
      completed_at: null,
      expected_duration_minutes: data.duration,
      actual_duration_minutes: null,
      photo_urls: [],
      categorized_photos: null,
      photo_required: data.photoRequired,
      photo_count: data.photoCount,
      photo_documentation_required: data.photoDocumentationRequired,
      photo_categories: data.photoDocumentationRequired ? data.photoCategories : null,
      worker_remark: data.remarks || "",
      supervisor_remark: "",
      rating: null,
      quality_comment: null,
      rating_proof_photo_url: null,
      rejection_proof_photo_url: null,
      room_number: data.location || "",
      is_custom_task: isCustomTask,
      custom_task_name: isCustomTask ? trimmedCustomName! : null,
      custom_task_category: isCustomTask ? data.category : null,
      custom_task_priority: isCustomTask ? data.priority : null,
      custom_task_photo_required: isCustomTask ? data.photoRequired : null,
      custom_task_photo_count: isCustomTask ? data.photoCount : null,
      custom_task_is_recurring: isCustomTask ? data.isRecurring : null,
      custom_task_recurring_frequency: isCustomTask ? data.recurringFrequency ?? null : null,
      custom_task_requires_specific_time: isCustomTask ? data.requiresSpecificTime ?? null : null,
      custom_task_recurring_time: isCustomTask ? data.recurringTime ?? null : null,
      is_recurring: data.isRecurring,
      recurring_frequency: data.recurringFrequency ?? null,
      requires_specific_time: data.requiresSpecificTime ?? false,
      recurring_time: data.recurringTime ?? null,
    })

    if (!success) {
      toast({
        title: "Failed to Create Task",
        description: "Could not assign the task. Please confirm the worker is on duty and try again.",
        variant: "destructive",
      })
      return
    }

    toast({
      title: "Task Created",
      description: isCustomTask ? "Custom task created successfully" : "Task has been assigned successfully",
    })

    setSelectedTaskDef(null)
  }

  const handleAnalyticsTabChange = (value: "peak" | "trends") => {
    setAnalyticsTab(value)
  }

  const handlePendingModalTabChange = (value: "tasks" | "verifications") => {
    setPendingModalTab(value)
  }

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
        {/* Home Tab */}
        {activeTab === "home" && (
          <div className="p-6 space-y-6">
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
                              <p className="text-xs text-muted-foreground italic mt-1">
                                &ldquo;{task.worker_remark}&rdquo;
                              </p>
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

            {/* System Overview */}
            <section>
              <h2 className="text-2xl font-bold mb-4">System Overview</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card
                  className="cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => setShowTasksModal(true)}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active Tasks</CardTitle>
                    <ClipboardList className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{totalTasks}</div>
                    <p className="text-xs text-muted-foreground">{pendingTasks} pending</p>
                  </CardContent>
                </Card>

                <Card
                  className="cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => setShowWorkersModal(true)}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active Staff</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{availableWorkers.length}</div>
                    <p className="text-xs text-muted-foreground">{busyWorkers.length} busy</p>
                  </CardContent>
                </Card>

                <Card
                  className="cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => {
                    setShowPendingModal(true)
                    setPendingModalTab("tasks")
                  }}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Pending Items</CardTitle>
                    <AlertCircle className="h-4 w-4 text-orange-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {pendingTasksList.length + pendingVerificationsList.length}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {pendingTasksList.length} tasks, {pendingVerificationsList.length} verifications
                    </p>
                  </CardContent>
                </Card>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold">Staff Status</h2>
              <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                {workersList.map((worker) => {
                    const currentTask = tasks.find(
                      (t) =>
                        t.assigned_to_user_id === worker.id && (t.status === "IN_PROGRESS" || t.status === "PAUSED"),
                    )
                    const isWorking = !!currentTask

                    return (
                      <Card
                        key={worker.id}
                        className="cursor-pointer hover:bg-accent/50 transition-colors"
                        onClick={() => setSelectedWorkerDetail(worker)}
                      >
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-medium flex items-center justify-between">
                            <span>{worker.name}</span>
                            <Badge variant={isWorking ? "default" : "secondary"} className="text-xs">
                              {isWorking ? "Busy" : "Available"}
                            </Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-xs text-muted-foreground capitalize">{worker.department}</div>
                          {currentTask && (
                            <div className="mt-2 text-xs">
                              <div className="font-medium">{currentTask.task_type}</div>
                              <div className="text-muted-foreground">{currentTask.room_number || "N/A"}</div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )
                  })}
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
                                <div className="flex-1 space-y-1">
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
                                      Details: &ldquo;{task.worker_remark}&rdquo;
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
          </div>
        )}

        {/* Tasks Tab */}
        {activeTab === "tasks" && (
          <div className="p-6 space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <Card
                className={`cursor-pointer transition-all hover:shadow-md ${taskFilterStatus === "pending_verification" ? "ring-2 ring-primary" : ""}`}
                onClick={() =>
                  setTaskFilterStatus(taskFilterStatus === "pending_verification" ? "all" : "pending_verification")
                }
              >
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Pending Verification</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{pendingVerificationsList.length}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {taskFilterStatus === "pending_verification" ? "Click to show all" : "Click to filter"}
                  </p>
                </CardContent>
              </Card>

              <Card
                className={`cursor-pointer transition-all hover:shadow-md ${taskFilterStatus === "pending" ? "ring-2 ring-primary" : ""}`}
                onClick={() => setTaskFilterStatus(taskFilterStatus === "pending" ? "all" : "pending")}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Pending Tasks</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{pendingTasksList.length}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {taskFilterStatus === "pending" ? "Click to show all" : "Click to filter"}
                  </p>
                </CardContent>
              </Card>

              <Card
                className={`cursor-pointer transition-all hover:shadow-md ${taskFilterStatus === "in_progress" ? "ring-2 ring-primary" : ""}`}
                onClick={() => setTaskFilterStatus(taskFilterStatus === "in_progress" ? "all" : "in_progress")}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">In Progress</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{allInProgressTasks.length}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {taskFilterStatus === "in_progress" ? "Click to show all" : "Click to filter"}
                  </p>
                </CardContent>
              </Card>
            </div>

            {taskFilterStatus !== "all" && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>
                      {taskFilterStatus === "pending_verification" && "Pending Verification"}
                      {taskFilterStatus === "pending" && "Pending Tasks"}
                      {taskFilterStatus === "in_progress" && "In Progress Tasks"}
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => setTaskFilterStatus("all")}>
                      <X className="h-4 w-4 mr-2" />
                      Clear Filter
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {taskFilterStatus === "pending_verification" &&
                      pendingVerificationsList.map((task) => (
                        <Link key={task.id} href={`/supervisor/verify/${task.id}`}>
                          <Card className="hover:shadow-md transition-shadow cursor-pointer">
                            <CardHeader className="pb-3">
                              <div className="flex items-start justify-between gap-2">
                                <CardTitle className="text-base">{task.task_type}</CardTitle>
                                <Badge variant="secondary">Verify</Badge>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-2">
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <UserIcon className="h-4 w-4" />
                                <span>{getUserName(task.assigned_to_user_id)}</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <MapPin className="h-4 w-4" />
                                <span>Room {task.room_number}</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Clock className="h-4 w-4" />
                                <span>
                                  {task.actual_duration_minutes} / {task.expected_duration_minutes} min
                                </span>
                              </div>
                            </CardContent>
                          </Card>
                        </Link>
                      ))}

                    {taskFilterStatus === "pending" &&
                      pendingTasksList.map((task) => (
                        <Card key={task.id}>
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between gap-2">
                              <CardTitle className="text-base">{task.task_type}</CardTitle>
                              <Badge variant="outline">Pending</Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <UserIcon className="h-4 w-4" />
                              <span>{getUserName(task.assigned_to_user_id)}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <MapPin className="h-4 w-4" />
                              <span>Room {task.room_number}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Clock className="h-4 w-4" />
                              <span>{task.expected_duration_minutes} min</span>
                            </div>
                          </CardContent>
                        </Card>
                      ))}

                    {taskFilterStatus === "in_progress" &&
                      allInProgressTasks.map((task) => (
                        <Card key={task.id}>
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between gap-2">
                              <CardTitle className="text-base">{task.task_type}</CardTitle>
                              <Badge variant="default">{task.status === "PAUSED" ? "Paused" : "In Progress"}</Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <UserIcon className="h-4 w-4" />
                              <span>{getUserName(task.assigned_to_user_id)}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <MapPin className="h-4 w-4" />
                              <span>Room {task.room_number}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Clock className="h-4 w-4" />
                              <span>
                                {task.actual_duration_minutes || 0} / {task.expected_duration_minutes} min
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Operations Tab */}
        {activeTab === "operations" && (
          <div className="p-6 space-y-6">
            {!selectedTaskDef ? (
              <Card>
                <CardHeader>
                  <CardTitle>Create New Task</CardTitle>
                </CardHeader>
                <CardContent>
                  <TaskSearch onSelectTask={handleTaskSelect} />
                </CardContent>
              </Card>
            ) : (
              <TaskAssignmentForm
                task={selectedTaskDef}
                onCancel={handleCancelTaskCreation}
                onSubmit={handleSubmitTask}
                workers={workersList}
                currentUser={user ?? null}
                workersLoaded={usersLoaded}
                workersLoadError={usersLoadError}
                shiftSchedules={shiftSchedules}
              />
            )}

            <Card>
              <CardHeader>
                <CardTitle>Recent Assignments</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {tasks
                    .sort((a, b) => new Date(b.assigned_at.client).getTime() - new Date(a.assigned_at.client).getTime())
                    .slice(0, 10)
                    .map((task) => (
                      <div key={task.id} className="flex items-start justify-between p-4 bg-muted/50 rounded-lg">
                        <div className="flex-1 space-y-1">
                          <p className="font-medium">{task.task_type}</p>
                          <p className="text-sm text-muted-foreground">
                            Room {task.room_number} • {getUserName(task.assigned_to_user_id)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(task.assigned_at.client).toLocaleString()}
                          </p>
                        </div>
                        <Badge variant={task.status === "COMPLETED" ? "default" : "secondary"}>
                          {task.status.replace(/_/g, " ")}
                        </Badge>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Staff Tab */}
        {activeTab === "staff" && (
          <div className="p-6 space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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

              <Card className="border-l-4 border-l-purple-500">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <UserCog className="h-5 w-5 text-purple-500" />
                    Front Desk Team
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Staff</p>
                      <p className="text-2xl font-bold">{frontDeskStats.totalWorkers}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Available</p>
                      <p className="text-2xl font-bold text-green-600">{frontDeskStats.availableWorkers}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Completion Rate</p>
                      <p className="text-2xl font-bold">{frontDeskStats.completionRate}%</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Avg Rating</p>
                      <p className="text-2xl font-bold">
                        {frontDeskStats.avgRating !== "N/A" ? `${frontDeskStats.avgRating} ?` : "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Tasks</p>
                      <p className="text-xl font-semibold">{frontDeskStats.totalTasks}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Avg Duration</p>
                      <p className="text-xl font-semibold">{frontDeskStats.avgDuration} min</p>
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
              <CardHeader className="bg-purple-50/50 dark:bg-purple-950/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                      <Clock className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Shift Management</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">Manage worker shift timings for today</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Dialog>
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-h-[44px] whitespace-nowrap bg-transparent"
                        asChild
                      >
                        <DialogTrigger>
                          <Calendar className="mr-2 h-4 w-4" />
                          Weekly Schedule
                        </DialogTrigger>
                      </Button>
                      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Weekly Shift Schedule</DialogTitle>
                          <DialogDescription>
                            View and manage the weekly shift schedule for all staff
                          </DialogDescription>
                        </DialogHeader>
                        <WeeklyScheduleView workers={sortedManagedStaff} />
                      </DialogContent>
                    </Dialog>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowShiftManagement(!showShiftManagement)}
                      className="min-h-[44px]"
                    >
                      {showShiftManagement ? (
                        <>
                          <ChevronUp className="h-4 w-4 mr-2" />
                          Hide
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4 mr-2" />
                          Show
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <Collapsible open={showShiftManagement} onOpenChange={setShowShiftManagement}>
                <CollapsibleContent>
                  <CardContent className="pt-6 space-y-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm text-muted-foreground">
                        Showing {sortedManagedStaff.length} staff members scheduled for today.
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Sort by</span>
                        <select
                          value={shiftSortOption}
                          onChange={(event) => setShiftSortOption(event.target.value as ShiftSortOption)}
                          className="min-h-[44px] rounded-md border border-border bg-background px-3 py-2 text-sm"
                        >
                          <option value="status">Status (On duty first)</option>
                          <option value="department">Department</option>
                          <option value="name">Name</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {sortedManagedStaff.map((worker) => {
                        const today = new Date()
                        const todayShift = getWorkerShiftForDate(worker, today, shiftSchedules)
                        const isEditing = editingShift?.workerId === worker.id

                        return (
                          <div
                            key={worker.id}
                            className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/30 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-primary/10 rounded-full">
                                <UserIcon className="h-4 w-4 text-primary" />
                              </div>
                              <div>
                                <p className="font-medium">{worker.name}</p>
                                <p className="text-sm text-muted-foreground capitalize">{worker.department}</p>
                              </div>
                            </div>

                            {isEditing ? (
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                  <div>
                                    <Label htmlFor={`start-${worker.id}`} className="text-xs">
                                      Start
                                    </Label>
                                    <Input
                                      id={`start-${worker.id}`}
                                      type="time"
                                      value={editingShift.start_time}
                                      onChange={(e) => setEditingShift({ ...editingShift, start_time: e.target.value })}
                                      className="w-32 min-h-[44px]"
                                    />
                                  </div>
                                  <div>
                                    <Label htmlFor={`end-${worker.id}`} className="text-xs">
                                      End
                                    </Label>
                                    <Input
                                      id={`end-${worker.id}`}
                                      type="time"
                                      value={editingShift.end_time}
                                      onChange={(e) => setEditingShift({ ...editingShift, end_time: e.target.value })}
                                      className="w-32 min-h-[44px]"
                                    />
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={handleSaveShift}
                                    className="min-h-[44px] bg-green-600 hover:bg-green-700"
                                  >
                                    <Save className="h-4 w-4 mr-1" />
                                    Save
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setEditingShift(null)}
                                    className="min-h-[44px]"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-3">
                                <div className="text-right">
                                  <p className="text-sm font-medium">
                                    {formatShiftRange(todayShift.shift_start, todayShift.shift_end)}
                                  </p>
                                  {todayShift.is_override && (
                                    <Badge variant="secondary" className="text-xs mt-1">
                                      Override
                                    </Badge>
                                  )}
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    setEditingShift({
                                      workerId: worker.id,
                                      start_time: todayShift.shift_start,
                                      end_time: todayShift.shift_end,
                                    })
                                  }
                                  className="min-h-[44px]"
                                >
                                  <Edit className="h-4 w-4 mr-1" />
                                  Edit
                                </Button>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Analytics & Insights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs value={analyticsTab} onValueChange={handleAnalyticsTabChange} className="space-y-6">
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
                <CardTitle>Available Staff</CardTitle>
              </CardHeader>
              <CardContent>
                {availableStaffEntries.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {availableStaffEntries.map(({ worker, isOffDuty }) => (
                      <div
                        key={worker.id}
                        className={isOffDuty ? "opacity-60 grayscale transition-opacity" : "transition-opacity"}
                      >
                        <WorkerStatusCard
                          worker={worker}
                          onClick={() => handleWorkerClick(worker)}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">No staff available</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Busy Staff</CardTitle>
              </CardHeader>
              <CardContent>
                {busyStaffEntries.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {busyStaffEntries.map(({ worker, currentTask }) => (
                      <WorkerStatusCard
                        key={worker.id}
                        worker={worker}
                        currentTask={currentTask}
                        onClick={() => handleWorkerClick(worker)}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">No staff currently busy</p>
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
              className={`flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-lg transition-colors min-h-[56px] flex-1 ${
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
              className={`flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-lg transition-colors min-h-[56px] flex-1 ${
                activeTab === "staff"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <UserCog className="h-5 w-5" />
              <span className="text-xs font-medium">Staff</span>
            </button>
            <button
              onClick={() => setActiveTab("tasks")}
              className={`flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-lg transition-colors min-h-[56px] flex-1 relative ${
                activeTab === "tasks"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <ClipboardList className="h-5 w-5" />
              <span className="text-xs font-medium">Tasks</span>
              {pendingTasksList.length > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
                >
                  {pendingTasksList.length}
                </Badge>
              )}
            </button>
            <button
              onClick={() => setActiveTab("operations")}
              className={`flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-lg transition-colors min-h-[56px] flex-1 ${
                activeTab === "operations"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <Activity className="h-5 w-5" />
              <span className="text-xs font-medium">Operations</span>
            </button>
          </div>
        </div>
      </nav>

      <Dialog open={showTasksModal} onOpenChange={setShowTasksModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>All Active Tasks</DialogTitle>
            <DialogDescription>Complete list of all tasks in the system</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="all" className="mt-4">
            <TabsList>
              <TabsTrigger value="all">All ({tasks.length})</TabsTrigger>
              <TabsTrigger value="pending">Pending ({pendingTasksList.length})</TabsTrigger>
              <TabsTrigger value="in-progress">
                In Progress ({tasks.filter((t) => t.status === "IN_PROGRESS").length})
              </TabsTrigger>
              <TabsTrigger value="completed">Completed ({completedTasks})</TabsTrigger>
            </TabsList>
            <TabsContent value="all" className="space-y-3 mt-4">
              {tasks.map((task) => (
                <Card key={task.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="font-medium">{task.title}</div>
                        <div className="text-sm text-muted-foreground">
                          {task.room_number && `Room ${task.room_number} • `}
                          {task.assigned_to && users.find((u) => u.id === task.assigned_to)?.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(task.created_at).toLocaleString()}
                        </div>
                      </div>
                      <Badge>{task.status.replace("_", " ")}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
            <TabsContent value="pending" className="space-y-3 mt-4">
              {pendingTasksList.map((task) => (
                <Card key={task.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="font-medium">{task.title}</div>
                        <div className="text-sm text-muted-foreground">
                          {task.room_number && `Room ${task.room_number} • `}
                          {task.assigned_to && users.find((u) => u.id === task.assigned_to)?.name}
                        </div>
                      </div>
                      <Badge variant="secondary">PENDING</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
            <TabsContent value="in-progress" className="space-y-3 mt-4">
              {tasks
                .filter((t) => t.status === "IN_PROGRESS")
                .map((task) => (
                  <Card key={task.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="font-medium">{task.title}</div>
                          <div className="text-sm text-muted-foreground">
                            {task.room_number && `Room ${task.room_number} • `}
                            {task.assigned_to && users.find((u) => u.id === task.assigned_to)?.name}
                          </div>
                        </div>
                        <Badge>IN PROGRESS</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </TabsContent>
            <TabsContent value="completed" className="space-y-3 mt-4">
              {tasks
                .filter((t) => t.status === "COMPLETED" || t.status === "VERIFIED")
                .map((task) => (
                  <Card key={task.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="font-medium">{task.title}</div>
                          <div className="text-sm text-muted-foreground">
                            {task.room_number && `Room ${task.room_number} • `}
                            {task.assigned_to && users.find((u) => u.id === task.assigned_to)?.name}
                          </div>
                        </div>
                        <Badge variant="outline">{task.status}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <Dialog open={showWorkersModal} onOpenChange={setShowWorkersModal}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>All Staff</DialogTitle>
            <DialogDescription>Complete list of all staff members and their current status</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-4">
            {workersList.map((worker) => {
                const currentTask = tasks.find(
                  (t) => t.assigned_to === worker.id && (t.status === "IN_PROGRESS" || t.status === "PAUSED"),
                )
                const completedCount = tasks.filter(
                  (t) => t.assigned_to === worker.id && (t.status === "COMPLETED" || t.status === "VERIFIED"),
                ).length
                const today = new Date()
                const todayShift = getWorkerShiftForDate(worker, today, shiftSchedules)

                return (
                  <Card
                    key={worker.id}
                    className="cursor-pointer hover:bg-accent/50"
                    onClick={() => setSelectedWorkerDetail(worker)}
                  >
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2">
                            <div className="font-medium">{worker.name}</div>
                            <Badge variant={currentTask ? "default" : "secondary"}>
                              {currentTask ? "Busy" : "Available"}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground capitalize">
                            {worker.department} • {todayShift.shift_start} - {todayShift.shift_end}
                          </div>
                          {currentTask && (
                            <div className="text-sm">
                              <span className="font-medium">Current Task:</span> {currentTask.title}
                              {currentTask.room_number && ` (Room ${currentTask.room_number})`}
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground">Completed today: {completedCount} tasks</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedWorkerDetail} onOpenChange={(open) => !open && setSelectedWorkerDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedWorkerDetail && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedWorkerDetail.name}</DialogTitle>
                <DialogDescription className="capitalize">
                  {selectedWorkerDetail.department} Department
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Shift Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Today&rsquo;s Shift:</span>
                      <span className="font-medium">
                        {(() => {
                          const today = new Date()
                          const todayShift = getWorkerShiftForDate(selectedWorkerDetail, today, shiftSchedules)
                          return `${todayShift.shift_start} - ${todayShift.shift_end}`
                        })()}
                      </span>
                    </div>
                    {selectedWorkerDetail.has_break && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Break Time:</span>
                        <span className="font-medium">
                          {selectedWorkerDetail.break_start} - {selectedWorkerDetail.break_end}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Current Task</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const currentTask = tasks.find(
                        (t) =>
                          t.assigned_to === selectedWorkerDetail.id &&
                          (t.status === "IN_PROGRESS" || t.status === "PAUSED"),
                      )
                      if (currentTask) {
                        return (
                          <div className="space-y-2">
                            <div className="font-medium">{currentTask.title}</div>
                            <div className="text-sm text-muted-foreground">
                              {currentTask.room_number && `Room ${currentTask.room_number}`}
                            </div>
                            <Badge>{currentTask.status.replace("_", " ")}</Badge>
                          </div>
                        )
                      }
                      return <p className="text-sm text-muted-foreground">No active task</p>
                    })()}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Task History (Today)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {tasks
                        .filter((t) => t.assigned_to === selectedWorkerDetail.id)
                        .slice(0, 5)
                        .map((task) => (
                          <div key={task.id} className="flex items-center justify-between text-sm">
                            <div>
                              <div className="font-medium">{task.title}</div>
                              <div className="text-xs text-muted-foreground">
                                {task.room_number && `Room ${task.room_number}`}
                              </div>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {task.status.replace("_", " ")}
                            </Badge>
                          </div>
                        ))}
                      {tasks.filter((t) => t.assigned_to === selectedWorkerDetail.id).length === 0 && (
                        <p className="text-sm text-muted-foreground">No tasks assigned yet</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Performance Metrics</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Tasks:</span>
                      <span className="font-medium">
                        {tasks.filter((t) => t.assigned_to === selectedWorkerDetail.id).length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Completed:</span>
                      <span className="font-medium text-green-600">
                        {
                          tasks.filter(
                            (t) =>
                              t.assigned_to === selectedWorkerDetail.id &&
                              (t.status === "COMPLETED" || t.status === "VERIFIED"),
                          ).length
                        }
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">In Progress:</span>
                      <span className="font-medium text-blue-600">
                        {
                          tasks.filter((t) => t.assigned_to === selectedWorkerDetail.id && t.status === "IN_PROGRESS")
                            .length
                        }
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Pending:</span>
                      <span className="font-medium text-orange-600">
                        {
                          tasks.filter((t) => t.assigned_to === selectedWorkerDetail.id && t.status === "PENDING")
                            .length
                        }
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showPendingModal} onOpenChange={setShowPendingModal}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              Pending Items
            </DialogTitle>
            <DialogDescription>View all pending tasks and verifications that require attention</DialogDescription>
          </DialogHeader>

          <Tabs
            value={pendingModalTab}
            onValueChange={handlePendingModalTabChange}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="tasks" className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                Pending Tasks ({pendingTasksList.length})
              </TabsTrigger>
              <TabsTrigger value="verifications" className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Pending Verifications ({pendingVerificationsList.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="tasks" className="flex-1 overflow-y-auto mt-4 space-y-3">
              {pendingTasksList.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No pending tasks</p>
                </div>
              ) : (
                pendingTasksList.map((task) => (
                  // Assuming task structure for rendering in the modal
                  // Adjust task properties based on your actual Task type definition
                  <Link key={task.id} href={`/supervisor/verify/${task.id}`}>
                    <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                                PENDING
                              </Badge>
                              <Badge variant="secondary" className="capitalize">
                                {task.department || "General"}
                              </Badge>
                            </div>
                            <h4 className="font-semibold mb-1">{task.task_type || task.title}</h4>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <UserIcon className="h-3 w-3" />
                                {getUserName(task.assigned_to_user_id) || "Unassigned"}
                              </span>
                              {task.room_number && (
                                <span className="flex items-center gap-1">
                                  <FileText className="h-3 w-3" />
                                  Room {task.room_number}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))
              )}
            </TabsContent>

            <TabsContent value="verifications" className="flex-1 overflow-y-auto mt-4 space-y-3">
              {pendingVerificationsList.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No pending verifications</p>
                </div>
              ) : (
                pendingVerificationsList.map((task) => (
                  <Link key={task.id} href={`/supervisor/verify/${task.id}`}>
                    <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge className="bg-blue-50 text-blue-700 border-blue-200">AWAITING VERIFICATION</Badge>
                              <Badge variant="secondary" className="capitalize">
                                {task.department || "General"}
                              </Badge>
                            </div>
                            <h4 className="font-semibold mb-1">{task.task_type || task.title}</h4>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <UserIcon className="h-3 w-3" />
                                {getUserName(task.assigned_to_user_id) || "Unknown"}
                              </span>
                              {task.room_number && (
                                <span className="flex items-center gap-1">
                                  <FileText className="h-3 w-3" />
                                  Room {task.room_number}
                                </span>
                              )}
                              {task.completed_at && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  Completed {new Date(task.completed_at).toLocaleTimeString()}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
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
