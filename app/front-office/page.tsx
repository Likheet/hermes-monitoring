"use client"

import { useEffect, useMemo, useState } from "react"

export const dynamic = "force-dynamic"

import { ProtectedRoute } from "@/components/protected-route"
import { useAuth } from "@/lib/auth-context"
import { useTasks } from "@/lib/task-context"
import { WorkerStatusCard } from "@/components/worker-status-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  LogOut,
  Plus,
  AlertTriangle,
  Clock,
  Save,
  Coffee,
  Calendar,
  MapPin,
  User,
  CalendarClock,
  Edit,
  Edit2,
  Filter,
  ChevronDown,
} from "lucide-react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useRealtimeTasks } from "@/lib/use-realtime-tasks"
import { RejectedTaskCard } from "@/components/rejected-task-card"
import { IssueCard } from "@/components/issue-card"
import { FrontOfficeBottomNav } from "@/components/mobile/front-office-bottom-nav"
import { useToast } from "@/hooks/use-toast"
import { formatShiftRange, formatFullTimestamp, calculateWorkingHours } from "@/lib/date-utils"
import { validateBreakTimes, getWorkerShiftForDate } from "@/lib/shift-utils"
import { WeeklyScheduleView } from "@/components/shift/weekly-schedule-view"
import { ReassignTaskModal } from "@/components/reassign-task-modal"
import { EditTaskModal } from "@/components/edit-task-modal"
import { FrontDeskActiveTaskModal } from "@/components/front-desk-active-task-modal"
import type { Task, User } from "@/lib/types"

type ShiftDraft = {
  start: string
  end: string
  hasBreak: boolean
  breakStart: string
  breakEnd: string
}

const priorityColors = {
  GUEST_REQUEST: "bg-red-500 text-white",
  TIME_SENSITIVE: "bg-orange-500 text-white",
  DAILY_TASK: "bg-blue-500 text-white",
  PREVENTIVE_MAINTENANCE: "bg-green-500 text-white",
}

const statusColors = {
  PENDING: "bg-yellow-500",
  IN_PROGRESS: "bg-blue-500",
  PAUSED: "bg-orange-500",
  COMPLETED: "bg-green-500",
  REJECTED: "bg-red-500",
}

const DEPARTMENT_SORT_ORDER = ["housekeeping", "maintenance", "front_desk"] as const

type ShiftSortOption = "status" | "department" | "name"

function FrontOfficeDashboard() {
  const { user, logout } = useAuth()
  const { tasks, issues, users, maintenanceTasks, updateWorkerShift, shiftSchedules, saveShiftSchedule } = useTasks()
  const router = useRouter()
  const { toast } = useToast()
  const { isConnected } = useRealtimeTasks({ enabled: true })

  const [activeTab, setActiveTab] = useState("home")
  const [assignmentFilter, setAssignmentFilter] = useState<"mine" | "all">("mine")
  const [reassignTask, setReassignTask] = useState<Task | null>(null)
  const [editTask, setEditTask] = useState<Task | null>(null)
  const [selfTaskModal, setSelfTaskModal] = useState<Task | null>(null)
  const [isStaffStatusOpen, setStaffStatusOpen] = useState(true)
  const [shiftSortOption, setShiftSortOption] = useState<ShiftSortOption>("status")

  const workers = users.filter((u) => u.role === "worker" || u.role === "front_office")
  const [today] = useState(() => new Date())

  const [editingShifts, setEditingShifts] = useState<Record<string, ShiftDraft>>(
    Object.fromEntries(
      workers.map((w) => {
        const todayShift = getWorkerShiftForDate(w, today, shiftSchedules)
        return [
          w.id,
          {
            start: todayShift.shift_start || "09:00",
            end: todayShift.shift_end || "18:00",
            hasBreak: todayShift.has_break || false,
            breakStart: todayShift.break_start || "12:00",
            breakEnd: todayShift.break_end || "13:00",
          },
        ]
      }),
    ),
  )
  const [dirtyWorkers, setDirtyWorkers] = useState<Record<string, boolean>>({})

  const buildShiftTemplate = (worker: User): ShiftDraft => {
    const todayShift = getWorkerShiftForDate(worker, today, shiftSchedules)
    return {
      start: todayShift.shift_start || "09:00",
      end: todayShift.shift_end || "18:00",
      hasBreak: todayShift.has_break || false,
      breakStart: todayShift.break_start || "12:00",
      breakEnd: todayShift.break_end || "13:00",
    }
  }

  const shiftsAreEqual = (a: ShiftDraft, b: ShiftDraft) =>
    a.start === b.start &&
    a.end === b.end &&
    a.hasBreak === b.hasBreak &&
    a.breakStart === b.breakStart &&
    a.breakEnd === b.breakEnd

  const markDirty = (workerId: string, dirty = true) => {
    setDirtyWorkers((prev) => {
      const alreadyDirty = !!prev[workerId]
      if (dirty) {
        if (alreadyDirty) return prev
        return { ...prev, [workerId]: true }
      }
      if (!alreadyDirty) return prev
      const next = { ...prev }
      delete next[workerId]
      return next
    })
  }

  const hasChanges = (workerId: string) => {
    const worker = workers.find((w) => w.id === workerId)
    if (!worker) return false
    if (dirtyWorkers[workerId]) return true
    const edited = editingShifts[worker.id] ?? buildShiftTemplate(worker)
    const template = buildShiftTemplate(worker)
    return !shiftsAreEqual(edited, template)
  }

  useEffect(() => {
    setEditingShifts((prev) => {
      let mutated = false
      const next = { ...prev }
      const workerIds = new Set(workers.map((w) => w.id))

      workers.forEach((worker) => {
        const template = buildShiftTemplate(worker)
        const current = next[worker.id]
        const isDirty = !!dirtyWorkers[worker.id]

        if (!current || (!isDirty && !shiftsAreEqual(current, template))) {
          next[worker.id] = template
          mutated = true
        }
      })

      Object.keys(next).forEach((id) => {
        if (!workerIds.has(id)) {
          delete next[id]
          mutated = true
        }
      })

      return mutated ? next : prev
    })
  }, [workers, shiftSchedules, dirtyWorkers, today])

  useEffect(() => {
    setDirtyWorkers((prev) => {
      let mutated = false
      const workerIds = new Set(workers.map((w) => w.id))
      const next = { ...prev }
      Object.keys(next).forEach((id) => {
        if (!workerIds.has(id)) {
          delete next[id]
          mutated = true
        }
      })
      return mutated ? next : prev
    })
  }, [workers])

  const [offDutyStatus, setOffDutyStatus] = useState<Record<string, boolean>>(
    Object.fromEntries(
      workers.map((w) => {
        const todayShift = getWorkerShiftForDate(w, today, shiftSchedules)
        return [w.id, todayShift.is_override || false]
      }),
    ),
  )

  useEffect(() => {
    setOffDutyStatus((prev) => {
      let mutated = false
      const next = { ...prev }
      const workerIds = new Set(workers.map((w) => w.id))

      workers.forEach((worker) => {
        const override = getWorkerShiftForDate(worker, today, shiftSchedules).is_override || false
        if (next[worker.id] !== override) {
          next[worker.id] = override
          mutated = true
        }
      })

      Object.keys(next).forEach((id) => {
        if (!workerIds.has(id)) {
          delete next[id]
          mutated = true
        }
      })

      return mutated ? next : prev
    })
  }, [workers, shiftSchedules, today])

  const sortedShiftWorkers = useMemo(() => {
    const getStatusRank = (worker: User) => {
      const overrideOff = offDutyStatus[worker.id]
      if (overrideOff) return 2

      const todayShift = getWorkerShiftForDate(worker, today, shiftSchedules)
      if (todayShift.is_override) return 2
      if (!todayShift.shift_start || !todayShift.shift_end) return 1
      return 0
    }

    return [...workers].sort((a, b) => {
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
  }, [workers, shiftSortOption, offDutyStatus, shiftSchedules, today])

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

  const closeSelfTaskModal = () => {
    setSelfTaskModal(null)
  }

  const availableWorkers = workers.filter((w) => !getWorkerCurrentTask(w.id))
  const busyWorkers = workers.filter((w) => getWorkerCurrentTask(w.id))
  const rejectedTasks = tasks.filter((t) => t.status === "REJECTED")
  const openIssues = issues.filter((issue) => issue.status === "OPEN")


  const myAssignments = tasks
    .filter((t) => t.assigned_by_user_id === user?.id)
    .sort((a, b) => {
      const dateA = new Date(a.assigned_at.client).getTime()
      const dateB = new Date(b.assigned_at.client).getTime()
      return dateB - dateA
    })

  const allAssignments = tasks
    .filter((t) => t.assigned_by_user_id) // Only tasks assigned by front office users
    .sort((a, b) => {
      const dateA = new Date(a.assigned_at.client).getTime()
      const dateB = new Date(b.assigned_at.client).getTime()
      return dateB - dateA
    })

  const displayedAssignments = assignmentFilter === "mine" ? myAssignments : allAssignments

  function getWorkerName(workerId: string) {
    const worker = users.find((u) => u.id === workerId)
    return worker?.name || "Unknown"
  }

  function getAssignerName(assignerId: string) {
    const assigner = users.find((u) => u.id === assignerId)
    return assigner?.name || "Unknown"
  }

  const stats = {
    total: displayedAssignments.length,
    pending: displayedAssignments.filter((t) => t.status === "PENDING").length,
    inProgress: displayedAssignments.filter((t) => t.status === "IN_PROGRESS" || t.status === "PAUSED").length,
    completed: displayedAssignments.filter((t) => t.status === "COMPLETED").length,
  }

  const handleLogout = () => {
    logout()
    router.push("/login")
  }

  const handleSaveShift = (workerId: string) => {
    const worker = workers.find((w) => w.id === workerId)
    if (!worker) return

    const shift = editingShifts[workerId] ?? buildShiftTemplate(worker)

    if (!shift.start || !shift.end) {
      toast({
        title: "Invalid Shift",
        description: "Please enter both start and end times",
        variant: "destructive",
      })
      return
    }

    if (shift.hasBreak) {
      const validation = validateBreakTimes(shift.start, shift.end, shift.breakStart, shift.breakEnd)
      if (!validation.valid) {
        toast({
          title: "Invalid Break Times",
          description: validation.error,
          variant: "destructive",
        })
        return
      }
    }

    updateWorkerShift(workerId, shift.start, shift.end, user!.id, shift.hasBreak, shift.breakStart, shift.breakEnd)
    markDirty(workerId, false)

    const todayDate = today.toISOString().split("T")[0]
    const isOffDuty = offDutyStatus[workerId] ?? false

    saveShiftSchedule({
      worker_id: workerId,
      schedule_date: todayDate,
      shift_start: shift.start,
      shift_end: shift.end,
      has_break: shift.hasBreak,
      break_start: shift.hasBreak ? shift.breakStart : undefined,
      break_end: shift.hasBreak ? shift.breakEnd : undefined,
      is_override: isOffDuty,
      override_reason: isOffDuty ? "leave" : "",
      notes: "",
    })

    toast({
      title: "Shift Updated",
      description: "Worker shift timing has been updated successfully",
    })
  }

  const handleOffDutyToggle = (workerId: string, isOffDuty: boolean) => {
    setOffDutyStatus((prev) => ({ ...prev, [workerId]: isOffDuty }))

    const worker = workers.find((w) => w.id === workerId)
    if (!worker) return

    const todayDate = today.toISOString().split("T")[0]
    const shiftDraft = editingShifts[workerId] ?? buildShiftTemplate(worker)

    saveShiftSchedule({
      worker_id: workerId,
      schedule_date: todayDate,
      shift_start: shiftDraft.start,
      shift_end: shiftDraft.end,
      has_break: shiftDraft.hasBreak,
      break_start: shiftDraft.hasBreak ? shiftDraft.breakStart : undefined,
      break_end: shiftDraft.hasBreak ? shiftDraft.breakEnd : undefined,
      is_override: isOffDuty,
      override_reason: isOffDuty ? "leave" : "",
      notes: "",
    })

    toast({
      title: isOffDuty ? "Marked Off Duty" : "Marked On Duty",
      description: `${worker.name} has been ${isOffDuty ? "marked as off duty" : "marked as on duty"} for today`,
    })
  }
  const getWorkingHoursDisplay = (
    start: string,
    end: string,
    hasBreak: boolean,
    breakStart: string,
    breakEnd: string,
  ) => {
    const result = calculateWorkingHours(start, end, hasBreak, breakStart, breakEnd)
    return result.formatted
  }

  const selfAssignedTasks = tasks.filter((t) => t.assigned_to_user_id === user?.id)

  const renderContent = () => {
    switch (activeTab) {
      case "shifts":
        return (
          <main className="container mx-auto px-4 py-6 max-w-7xl">
            <Tabs defaultValue="current" className="w-full">
              <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-6">
                <TabsTrigger value="current" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Current Shifts
                </TabsTrigger>
                <TabsTrigger value="schedule" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Schedule
                </TabsTrigger>
              </TabsList>

              <TabsContent value="current" className="space-y-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">
                    Showing {sortedShiftWorkers.length} staff members scheduled for today.
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

                <div className="grid gap-4 md:grid-cols-2">
                  {sortedShiftWorkers.map((worker) => {
                    const edited = editingShifts[worker.id]
                    const todayShift = getWorkerShiftForDate(worker, today, shiftSchedules)
                    const isOffDuty = offDutyStatus[worker.id]
                    const workingHours = getWorkingHoursDisplay(
                      edited.start,
                      edited.end,
                      edited.hasBreak,
                      edited.breakStart,
                      edited.breakEnd,
                    )

                    return (
                      <Card key={worker.id}>
                        <CardHeader>
                          <CardTitle className="text-lg">{worker.name}</CardTitle>
                          <p className="text-sm text-muted-foreground capitalize">{worker.department}</p>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                              <div className="flex items-center gap-2">
                                <Label htmlFor={`off-duty-${worker.id}`} className="cursor-pointer font-semibold">
                                  Mark as Off Duty
                                </Label>
                              </div>
                              <Switch
                                id={`off-duty-${worker.id}`}
                                checked={isOffDuty}
                                onCheckedChange={(checked) => handleOffDutyToggle(worker.id, checked)}
                              />
                            </div>

                            <div className={isOffDuty ? "opacity-50 pointer-events-none" : ""}>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <Label htmlFor={`start-${worker.id}`}>Shift Start</Label>
                                  <Input
                                    id={`start-${worker.id}`}
                                    type="time"
                                    value={edited.start}
                                    onChange={(e) => {
                                      const value = e.target.value
                                      setEditingShifts((prev) => ({
                                        ...prev,
                                        [worker.id]: { ...(prev[worker.id] ?? buildShiftTemplate(worker)), start: value },
                                      }))
                                      markDirty(worker.id)
                                    }}
                                    className="mt-1"
                                    disabled={isOffDuty}
                                  />
                                </div>
                                <div>
                                  <Label htmlFor={`end-${worker.id}`}>Shift End</Label>
                                  <Input
                                    id={`end-${worker.id}`}
                                    type="time"
                                    value={edited.end}
                                    onChange={(e) => {
                                      const value = e.target.value
                                      setEditingShifts((prev) => ({
                                        ...prev,
                                        [worker.id]: { ...(prev[worker.id] ?? buildShiftTemplate(worker)), end: value },
                                      }))
                                      markDirty(worker.id)
                                    }}
                                    className="mt-1"
                                    disabled={isOffDuty}
                                  />
                                </div>
                              </div>

                              <div className="flex items-center justify-between py-2 border-t">
                                <div className="flex items-center gap-2">
                                  <Coffee className="h-4 w-4 text-muted-foreground" />
                                  <Label htmlFor={`break-${worker.id}`} className="cursor-pointer">
                                    Break Shifts
                                  </Label>
                                </div>
                                <Switch
                                  id={`break-${worker.id}`}
                                  checked={edited.hasBreak}
                                  onCheckedChange={(checked) => {
                                    setEditingShifts((prev) => ({
                                      ...prev,
                                      [worker.id]: {
                                        ...(prev[worker.id] ?? buildShiftTemplate(worker)),
                                        hasBreak: checked,
                                        breakStart: checked
                                          ? (prev[worker.id]?.breakStart ?? buildShiftTemplate(worker).breakStart)
                                          : buildShiftTemplate(worker).breakStart,
                                        breakEnd: checked
                                          ? (prev[worker.id]?.breakEnd ?? buildShiftTemplate(worker).breakEnd)
                                          : buildShiftTemplate(worker).breakEnd,
                                      },
                                    }))
                                    markDirty(worker.id)
                                  }}
                                  disabled={isOffDuty}
                                />
                              </div>

                              {edited.hasBreak && (
                                <div className="grid grid-cols-2 gap-3 pl-6 border-l-2 border-muted">
                                  <div>
                                    <Label htmlFor={`break-start-${worker.id}`} className="text-xs">
                                      Break Start
                                    </Label>
                                    <Input
                                      id={`break-start-${worker.id}`}
                                      type="time"
                                      value={edited.breakStart}
                                      onChange={(e) => {
                                        const value = e.target.value
                                        setEditingShifts((prev) => ({
                                          ...prev,
                                          [worker.id]: {
                                            ...(prev[worker.id] ?? buildShiftTemplate(worker)),
                                            breakStart: value,
                                          },
                                        }))
                                        markDirty(worker.id)
                                      }}
                                      className="mt-1"
                                      disabled={isOffDuty}
                                    />
                                  </div>
                                  <div>
                                    <Label htmlFor={`break-end-${worker.id}`} className="text-xs">
                                      Break End
                                    </Label>
                                    <Input
                                      id={`break-end-${worker.id}`}
                                      type="time"
                                      value={edited.breakEnd}
                                      onChange={(e) => {
                                        const value = e.target.value
                                        setEditingShifts((prev) => ({
                                          ...prev,
                                          [worker.id]: {
                                            ...(prev[worker.id] ?? buildShiftTemplate(worker)),
                                            breakEnd: value,
                                          },
                                        }))
                                        markDirty(worker.id)
                                      }}
                                      className="mt-1"
                                      disabled={isOffDuty}
                                    />
                                  </div>
                                </div>
                              )}

                              <div className="flex items-center justify-between text-sm pt-2 border-t">
                                <span className="text-muted-foreground">Working Hours:</span>
                                <span className="font-semibold">{isOffDuty ? "Off Duty" : workingHours}</span>
                              </div>

                              <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2 border-t">
                                <Clock className="h-4 w-4" />
                                <span>
                                  Today's Schedule:{" "}
                                  {isOffDuty
                                    ? "Off Duty"
                                    : formatShiftRange(todayShift.shift_start, todayShift.shift_end)}
                                </span>
                              </div>

                              <Button
                                onClick={() => handleSaveShift(worker.id)}
                                disabled={!hasChanges(worker.id) || isOffDuty}
                                className="w-full"
                              >
                                <Save className="mr-2 h-4 w-4" />
                                Save Changes
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </TabsContent>

              <TabsContent value="schedule">
                <WeeklyScheduleView workers={workers} />
              </TabsContent>
            </Tabs>
          </main>
        )

      case "supervisor": {
        const userDepartmentLookup = new Map(users.map((teamMember) => [teamMember.id, teamMember.department]))
        const departmentWorkers = users.filter(
          (teamMember) => teamMember.role === "worker" && (!user?.department || teamMember.department === user.department),
        )
        const departmentTasks = tasks.filter((taskItem) => {
          const taskDepartment =
            taskItem.department ?? (taskItem.assigned_to_user_id ? userDepartmentLookup.get(taskItem.assigned_to_user_id) ?? null : null)
          if (!user?.department) return true
          return taskDepartment === user.department
        })
        const departmentIssues = openIssues.filter((issue) => departmentTasks.some((taskItem) => taskItem.id === issue.task_id))
        const supervisorPendingTasks = departmentTasks.filter((taskItem) => taskItem.status === "PENDING")
        const supervisorInProgressTasks = departmentTasks.filter(
          (taskItem) => taskItem.status === "IN_PROGRESS" || taskItem.status === "PAUSED",
        )
        const supervisorCompletedTasks = departmentTasks.filter((taskItem) => taskItem.status === "COMPLETED")
        const supervisorRejectedTasks = departmentTasks.filter((taskItem) => taskItem.status === "REJECTED")

        return (
          <main className="container mx-auto max-w-7xl px-4 py-6 space-y-8">
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Pending", count: supervisorPendingTasks.length },
                { label: "In Progress", count: supervisorInProgressTasks.length },
                { label: "Completed", count: supervisorCompletedTasks.length },
                { label: "Rejected", count: supervisorRejectedTasks.length },
              ].map((stat) => (
                <Card key={stat.label}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">{stat.label}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold">{stat.count}</p>
                  </CardContent>
                </Card>
              ))}
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Team Status</h2>
                <Badge variant="outline">{departmentWorkers.length} workers</Badge>
              </div>
              {departmentWorkers.length === 0 ? (
                <div className="flex min-h-[160px] items-center justify-center rounded-lg border border-dashed">
                  <p className="text-muted-foreground">No workers found for this department.</p>
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {departmentWorkers.map((worker) => (
                    <WorkerStatusCard
                      key={worker.id}
                      worker={worker}
                      currentTask={getWorkerCurrentTask(worker.id) ?? undefined}
                    />
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" /> Active Issues
                </h2>
                <Badge variant="secondary">{departmentIssues.length} open</Badge>
              </div>
              {departmentIssues.length === 0 ? (
                <div className="flex min-h-[160px] items-center justify-center rounded-lg border border-dashed">
                  <p className="text-muted-foreground">No open issues reported.</p>
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {departmentIssues.map((issue) => {
                    const task = departmentTasks.find((t) => t.id === issue.task_id)
                    if (!task) return null
                    return <IssueCard key={issue.id} issue={issue} task={task} onResolve={() => {}} />
                  })}
                </div>
              )}
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Active Tasks</h2>
                <Badge variant="secondary">{supervisorInProgressTasks.length} active</Badge>
              </div>
              {supervisorInProgressTasks.length === 0 ? (
                <div className="flex min-h-[160px] items-center justify-center rounded-lg border border-dashed">
                  <p className="text-muted-foreground">No tasks currently in progress.</p>
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {supervisorInProgressTasks.map((task) => (
                    <Card key={task.id}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">{task.task_type}</CardTitle>
                        <Badge variant="outline" className="capitalize">{task.status.replace(/_/g, " ")}</Badge>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          <span>{getWorkerName(task.assigned_to_user_id)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          <span>{task.room_number || "N/A"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CalendarClock className="h-4 w-4" />
                          <span>Updated {formatFullTimestamp(task.assigned_at.client)}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>

            {supervisorRejectedTasks.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Rejected Tasks</h2>
                  <Badge variant="destructive">{supervisorRejectedTasks.length} awaiting action</Badge>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {supervisorRejectedTasks.map((task) => (
                    <RejectedTaskCard key={task.id} task={task} />
                  ))}
                </div>
              </section>
            )}
          </main>
        )
      }

      case "assignments":
        return (
          <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <Label htmlFor="assignment-filter" className="text-sm font-medium">
                      Show:
                    </Label>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant={assignmentFilter === "mine" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setAssignmentFilter("mine")}
                      className="min-h-[44px]"
                    >
                      My Assignments
                    </Button>
                    <Button
                      variant={assignmentFilter === "all" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setAssignmentFilter("all")}
                      className="min-h-[44px]"
                    >
                      All Assignments
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Stats Cards */}
            <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2 sm:pb-3">
                  <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Total Assigned</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl sm:text-2xl font-bold">{stats.total}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2 sm:pb-3">
                  <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Pending</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl sm:text-2xl font-bold text-yellow-600">{stats.pending}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2 sm:pb-3">
                  <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">In Progress</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl sm:text-2xl font-bold text-blue-600">{stats.inProgress}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2 sm:pb-3">
                  <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Completed</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl sm:text-2xl font-bold text-green-600">{stats.completed}</div>
                </CardContent>
              </Card>
            </div>

            {/* Assignments List */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg">
                  {assignmentFilter === "mine" ? "My Assignment History" : "All Assignment History"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {displayedAssignments.length > 0 ? (
                  <div className="space-y-3">
                    {displayedAssignments.map((task) => {
                      const isOtherTask = task.task_type === "Other (Custom Task)" || task.custom_task_name
                      const canEdit = task.assigned_by_user_id === user?.id

                      return (
                        <div
                          key={task.id}
                          className="flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-4 p-3 sm:p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex-1 space-y-2 w-full min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="font-semibold text-sm sm:text-base leading-tight">
                                {task.custom_task_name || task.task_type}
                              </h3>
                              <Badge
                                className={`${priorityColors[task.priority_level]} text-xs shrink-0`}
                                variant="secondary"
                              >
                                {task.priority_level.replace(/_/g, " ")}
                              </Badge>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm text-muted-foreground">
                              <div className="flex items-center gap-2">
                                <MapPin className="h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
                                <span className="truncate">{task.room_number}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <User className="h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
                                <span className="truncate">{getWorkerName(task.assigned_to_user_id)}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Clock className="h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
                                <span>{task.expected_duration_minutes} min</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <CalendarClock className="h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
                                <span className="truncate">{formatFullTimestamp(task.assigned_at)}</span>
                              </div>
                              {assignmentFilter === "all" && (
                                <div className="flex items-center gap-2 col-span-full">
                                  <User className="h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
                                  <span className="text-xs">
                                    Assigned by:{" "}
                                    <span className="font-medium">{getAssignerName(task.assigned_by_user_id)}</span>
                                  </span>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <div className={`h-2 w-2 rounded-full ${statusColors[task.status]} shrink-0`} />
                              <span className="text-xs sm:text-sm font-medium">{task.status.replace(/_/g, " ")}</span>
                            </div>
                          </div>
                          {task.status === "PENDING" && canEdit && (
                            <div className="flex gap-2 w-full sm:w-auto shrink-0">
                              {isOtherTask && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setEditTask(task)}
                                  className="flex-1 sm:flex-none min-h-[44px]"
                                >
                                  <Edit2 className="h-4 w-4 sm:mr-2" />
                                  <span className="hidden sm:inline">Edit</span>
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setReassignTask(task)}
                                className="flex-1 sm:flex-none min-h-[44px]"
                              >
                                <Edit className="h-4 w-4 sm:mr-2" />
                                <span className="hidden sm:inline">Re-assign</span>
                                <span className="sm:hidden">Reassign</span>
                              </Button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex min-h-[200px] items-center justify-center">
                    <p className="text-sm text-muted-foreground">
                      {assignmentFilter === "mine" ? "No assignments yet" : "No assignments found"}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </main>
        )

      case "home":
      default:
        return (
          <main className="container mx-auto px-4 py-6 space-y-6">
            {selfAssignedTasks.length > 0 && (
              <section>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-lg font-semibold">My Active Tasks</h2>
                  <Badge variant="outline">{selfAssignedTasks.length} assigned to me</Badge>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {selfAssignedTasks.map((task) => (
                    <Card
                      key={task.id}
                      className="border-primary/30 hover:border-primary cursor-pointer transition-shadow hover:shadow-md"
                      onClick={() => {
                        setSelfTaskModal(task)
                      }}
                    >
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">{task.task_type}</CardTitle>
                        <Badge variant="secondary" className="capitalize">{task.status.replace(/_/g, " ")}</Badge>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          <span>{task.room_number || "N/A"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CalendarClock className="h-4 w-4" />
                          <span>Updated {formatFullTimestamp(task.assigned_at.client)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          <span>{task.expected_duration_minutes} min expected</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Tap to manage this task.</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            <section>
              <Collapsible open={isStaffStatusOpen} onOpenChange={setStaffStatusOpen}>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-semibold">Staff Status</h2>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="flex items-center gap-2">
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${isStaffStatusOpen ? "rotate-180" : ""}`}
                      />
                      {isStaffStatusOpen ? "Hide" : "Show"}
                    </Button>
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent className="space-y-6 pt-2">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base font-semibold">Available Staff</h3>
                      <span className="text-sm text-muted-foreground">{availableWorkers.length} available</span>
                    </div>
                    {availableWorkers.length > 0 ? (
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {availableWorkers.map((worker) => (
                          <WorkerStatusCard key={worker.id} worker={worker} />
                        ))}
                      </div>
                    ) : (
                      <div className="flex min-h-[200px] items-center justify-center border-2 border-dashed rounded-lg">
                        <p className="text-muted-foreground">No staff available</p>
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base font-semibold">Busy Staff</h3>
                      <span className="text-sm text-muted-foreground">{busyWorkers.length} working</span>
                    </div>
                    {busyWorkers.length > 0 ? (
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {busyWorkers.map((worker) => (
                          <WorkerStatusCard
                            key={worker.id}
                            worker={worker}
                            currentTask={getWorkerCurrentTask(worker.id)}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="flex min-h-[200px] items-center justify-center border-2 border-dashed rounded-lg">
                        <p className="text-muted-foreground">No staff currently busy</p>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </section>

            {openIssues.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                    Reported Issues
                  </h2>
                  <span className="text-sm text-muted-foreground">{openIssues.length} open</span>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {openIssues.map((issue) => {
                    const task = tasks.find((t) => t.id === issue.task_id)
                    if (!task) return null
                    return (
                      <IssueCard
                        key={issue.id}
                        issue={issue}
                        task={task}
                        onResolve={(issueId) => {
                        }}
                      />
                    )
                  })}
                </div>
              </section>
            )}

            {rejectedTasks.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Rejected Tasks</h2>
                  <span className="text-sm text-muted-foreground">{rejectedTasks.length} rejected</span>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {rejectedTasks.map((task) => (
                    <RejectedTaskCard key={task.id} task={task} />
                  ))}
                </div>
              </section>
            )}
          </main>
        )
    }
  }

  return (
    <div className="flex flex-col h-screen bg-muted/30">
      <header className="border-b bg-background sticky top-0 z-40 shrink-0">
        <div className="container mx-auto flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-bold">
                {activeTab === "home"
                  ? "Front Office"
                  : activeTab === "shifts"
                    ? "Shift Management"
                    : activeTab === "assignments"
                      ? "Assignments"
                      : "Supervisor Tools"}
              </h1>
              <p className="text-sm text-muted-foreground">{user?.name}</p>
            </div>
          </div>
      <div className="flex items-center gap-2">
        <Button asChild size="sm" className="min-h-[44px] px-3 sm:px-4 flex-1 sm:flex-none">
          <Link href="/front-office/create-task">
            <Plus className="mr-2 h-4 w-4" />
            Create Task
          </Link>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleLogout}
          className="min-h-[44px] min-w-[44px] px-2 sm:px-3 bg-transparent"
        >
          <LogOut className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Logout</span>
        </Button>
      </div>
    </div>
  </header>

  <div className="flex-1 overflow-y-auto pb-20">{renderContent()}</div>

  <FrontDeskActiveTaskModal
    task={selfTaskModal}
    open={!!selfTaskModal}
    onOpenChange={(open) => {
      if (!open) {
        closeSelfTaskModal()
      }
    }}
  />

  <FrontOfficeBottomNav activeTab={activeTab} onTabChange={setActiveTab} />

  {reassignTask && (
        <ReassignTaskModal task={reassignTask} open={!!reassignTask} onOpenChange={() => setReassignTask(null)} />
      )}

      {editTask && <EditTaskModal task={editTask} open={!!editTask} onOpenChange={() => setEditTask(null)} />}
    </div>
  )
}

export default function FrontOfficePage() {
  return (
    <ProtectedRoute allowedRoles={["front_office"]}>
      <FrontOfficeDashboard />
    </ProtectedRoute>
  )
}


