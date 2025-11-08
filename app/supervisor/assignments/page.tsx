"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ProtectedRoute } from "@/components/protected-route"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/lib/auth-context"
import { useTasks } from "@/lib/task-context"
import { ReassignTaskModal } from "@/components/reassign-task-modal"
import { EditTaskModal } from "@/components/edit-task-modal"
import { SupervisorBottomNav } from "@/components/supervisor/supervisor-bottom-nav"
import { formatFullTimestamp } from "@/lib/date-utils"
import type { Task } from "@/lib/types"
import { Filter, Edit, Edit2, MapPin, User, Clock, CalendarClock, Plus } from "lucide-react"

const priorityColors = {
  GUEST_REQUEST: "bg-red-500 text-white",
  TIME_SENSITIVE: "bg-orange-500 text-white",
  DAILY_TASK: "bg-blue-500 text-white",
  PREVENTIVE_MAINTENANCE: "bg-green-500 text-white",
} as const

const statusColors = {
  PENDING: "bg-yellow-500",
  IN_PROGRESS: "bg-blue-500",
  PAUSED: "bg-orange-500",
  COMPLETED: "bg-green-500",
  REJECTED: "bg-red-500",
  VERIFIED: "bg-emerald-600",
} as const

type PriorityKey = keyof typeof priorityColors

type AssignmentFilter = "mine" | "all"

function SupervisorAssignments() {
  const { user } = useAuth()
  const { tasks, users } = useTasks()

  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>("mine")
  const [taskTypeFilter, setTaskTypeFilter] = useState<"all" | "recurring">("all")
  const [reassignTask, setReassignTask] = useState<Task | null>(null)
  const [editTask, setEditTask] = useState<Task | null>(null)

  const departmentTasks = useMemo(() => {
    if (!user?.department) return tasks
    const department = user.department.toLowerCase()

    return tasks.filter((task) => {
      const assignee = users.find((u) => u.id === task.assigned_to_user_id)
      const taskDepartment = task.department || assignee?.department
      return taskDepartment?.toLowerCase() === department
    })
  }, [tasks, users, user?.department])

  const assignmentsCreatedByMe = useMemo(
    () =>
      departmentTasks
        .filter((task) => task.assigned_by_user_id === user?.id)
        .sort((a, b) => new Date(b.assigned_at.client).getTime() - new Date(a.assigned_at.client).getTime()),
    [departmentTasks, user?.id],
  )

  const assignmentsAllDepartment = useMemo(
    () =>
      departmentTasks
        .filter((task) => Boolean(task.assigned_by_user_id))
        .sort((a, b) => new Date(b.assigned_at.client).getTime() - new Date(a.assigned_at.client).getTime()),
    [departmentTasks],
  )

  const isRecurringTask = (task: Task) =>
    Boolean(
      task.is_recurring || task.recurring_frequency || task.custom_task_is_recurring || task.custom_task_recurring_frequency,
    )

  const displayedAssignments = useMemo(() => {
    const base = assignmentFilter === "mine" ? assignmentsCreatedByMe : assignmentsAllDepartment
    if (taskTypeFilter === "recurring") {
      return base.filter(isRecurringTask)
    }
    return base
  }, [assignmentFilter, assignmentsAllDepartment, assignmentsCreatedByMe, taskTypeFilter])

  const assignmentStats = useMemo(
    () => ({
      total: displayedAssignments.length,
      pending: displayedAssignments.filter((task) => task.status === "PENDING").length,
      inProgress: displayedAssignments.filter((task) => task.status === "IN_PROGRESS" || task.status === "PAUSED").length,
      completed: displayedAssignments.filter((task) => task.status === "COMPLETED").length,
    }),
    [displayedAssignments],
  )

  const getWorkerName = (workerId: string) => users.find((u) => u.id === workerId)?.name || "Unknown"
  const getAssignerName = (assignerId: string | null) => {
    if (!assignerId) return "Unknown"
    return users.find((u) => u.id === assignerId)?.name || "Unknown"
  }

  return (
    <div className="min-h-screen bg-muted/30 pb-20 md:pb-0">
      <header className="border-b bg-background sticky top-0 z-40">
        <div className="container mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between px-3 sm:px-4 py-3 sm:py-4 gap-3 sm:gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-bold">Assignments</h1>
            <p className="text-xs sm:text-sm text-muted-foreground truncate">
              {assignmentFilter === "mine" ? "Tasks you assigned" : "All assignments in your department"}
            </p>
          </div>
          <Button asChild size="sm" className="min-h-[44px] px-3 sm:px-4">
            <Link href="/supervisor/create-task">
              <Plus className="mr-2 h-4 w-4" />
              Create Task
            </Link>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Filter className="h-4 w-4 text-muted-foreground" />
                Show
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

        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Total Assigned</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold">{assignmentStats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold text-yellow-600">{assignmentStats.pending}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">In Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold text-blue-600">{assignmentStats.inProgress}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold text-green-600">{assignmentStats.completed}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">
              {assignmentFilter === "mine" ? "My Assignment History" : "Department Assignment History"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {displayedAssignments.length > 0 ? (
              <div className="space-y-3">
                {displayedAssignments.map((task) => {
                  const priorityClass = priorityColors[task.priority_level as PriorityKey] || ""
                  const statusClass = statusColors[task.status as keyof typeof statusColors] || "bg-muted"
                  const isCustomTask = task.task_type === "Other (Custom Task)" || Boolean(task.custom_task_name)
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
                          <Badge className={`${priorityClass} text-xs shrink-0`} variant="secondary">
                            {task.priority_level.replace(/_/g, " ")}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
                            <span className="truncate">{task.room_number || "N/A"}</span>
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
                                Assigned by: <span className="font-medium">{getAssignerName(task.assigned_by_user_id)}</span>
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <div className={`h-2 w-2 rounded-full ${statusClass} shrink-0`} />
                          <span className="text-xs sm:text-sm font-medium">{task.status.replace(/_/g, " ")}</span>
                        </div>
                      </div>

                      {task.status === "PENDING" && canEdit && (
                        <div className="flex gap-2 w-full sm:w-auto shrink-0">
                          {isCustomTask && (
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

      <SupervisorBottomNav />

      {reassignTask && (
        <ReassignTaskModal
          task={reassignTask}
          open={!!reassignTask}
          onOpenChange={(open) => {
            if (!open) {
              setReassignTask(null)
            }
          }}
        />
      )}
      {editTask && (
        <EditTaskModal
          task={editTask}
          open={!!editTask}
          onOpenChange={(open) => {
            if (!open) {
              setEditTask(null)
            }
          }}
        />
      )}
    </div>
  )
}

export default function SupervisorAssignmentsPage() {
  return (
    <ProtectedRoute allowedRoles={["supervisor"]}>
      <SupervisorAssignments />
    </ProtectedRoute>
  )
}
