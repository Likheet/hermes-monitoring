"use client"

import { useMemo, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTasks } from "@/lib/task-context"
import { useAuth } from "@/lib/auth-context"
import type { Task, Department } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import {
  getWorkersWithShiftStatusFromUsers,
  getWorkersWithShiftStatusFromUsersAndSchedules,
  isWorkerOnShiftFromUser,
  isWorkerOnShiftWithSchedule,
} from "@/lib/shift-utils"
import { cn } from "@/lib/utils"

// Departments that should not be available for task assignment
const EXCLUDED_TASK_ASSIGNMENT_DEPARTMENTS: Department[] = ["admin"]

const DEPARTMENT_ORDER = ["housekeeping", "maintenance", "front_office"] as const
type DisplayDepartment = (typeof DEPARTMENT_ORDER)[number]

const displayDepartmentLabels: Record<DisplayDepartment, string> = {
  housekeeping: "Housekeeping",
  maintenance: "Maintenance",
  front_office: "Front Office",
}

const departmentLabels: Record<Department, string> = {
  housekeeping: "Housekeeping",
  maintenance: "Maintenance",
  front_office: "Front Office",
  admin: "Admin",
  "housekeeping-dept": "Housekeeping Department",
  "maintenance-dept": "Maintenance Department",
}

const normalizeDepartment = (department?: string | null): DisplayDepartment | null => {
  if (!department) return null
  const value = department.toLowerCase()
  if (value === "housekeeping" || value === "housekeeping-dept") return "housekeeping"
  if (value === "maintenance" || value === "maintenance-dept") return "maintenance"
  if (value === "front_office") return "front_office"
  return null
}

const getDepartmentRank = (department: Department) => {
  const normalized = normalizeDepartment(department)
  return normalized ? DEPARTMENT_ORDER.indexOf(normalized) : DEPARTMENT_ORDER.length
}

interface ReassignTaskModalProps {
  task: Task
  open: boolean
  onOpenChange: (open: boolean) => void
}

const STATUS_LABELS: Record<ReturnType<typeof isWorkerOnShiftFromUser>["status"], string> = {
  AVAILABLE: "On Duty",
  SHIFT_BREAK: "On Break",
  OFF_DUTY: "Off Duty",
}

const STATUS_BADGE_CLASSES: Record<ReturnType<typeof isWorkerOnShiftFromUser>["status"], string> = {
  AVAILABLE: "border-emerald-200 bg-emerald-100 text-emerald-700",
  SHIFT_BREAK: "border-amber-200 bg-amber-100 text-amber-700",
  OFF_DUTY: "border-slate-200 bg-slate-100 text-slate-600",
}

const ACTIVE_TASK_STATUSES = new Set(["IN_PROGRESS", "PAUSED"])

export function ReassignTaskModal({ task, open, onOpenChange }: ReassignTaskModalProps) {
  const { reassignTask: reassignTaskFn, users, tasks: allTasks, shiftSchedules } = useTasks()
  const { user } = useAuth()
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>("")
  const [reason, setReason] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const timezoneOffset = useMemo(() => new Date().getTimezoneOffset(), [])
  const shiftOptions = useMemo(() => ({ timezoneOffsetMinutes: timezoneOffset }), [timezoneOffset])

  const busyWorkerIds = useMemo(() => {
    const busy = new Set<string>()
    allTasks.forEach((taskItem) => {
      if (taskItem.id === task.id) return
      if (ACTIVE_TASK_STATUSES.has(taskItem.status) && taskItem.assigned_to_user_id) {
        busy.add(taskItem.assigned_to_user_id)
      }
    })
    return busy
  }, [allTasks, task.id])

  const filteredWorkers = useMemo(
    () =>
      users.filter((candidate) => {
        if (candidate.id === task.assigned_to_user_id) return false
        if (candidate.role !== "worker" && candidate.role !== "supervisor") return false
        return !EXCLUDED_TASK_ASSIGNMENT_DEPARTMENTS.includes(candidate.department as Department)
      }),
    [users, task.assigned_to_user_id],
  )

  const workersWithAvailability = useMemo(() => {
    const baseList =
      shiftSchedules.length > 0
        ? getWorkersWithShiftStatusFromUsersAndSchedules(filteredWorkers, shiftSchedules, shiftOptions)
        : getWorkersWithShiftStatusFromUsers(filteredWorkers, shiftOptions)

    return baseList.map((worker) => ({
      ...worker,
      isBusy: busyWorkerIds.has(worker.id),
    }))
  }, [filteredWorkers, shiftSchedules, shiftOptions, busyWorkerIds])

  const assigneeOptions = useMemo(() => {
    let options = workersWithAvailability

    if (user && user.id !== task.assigned_to_user_id) {
      const alreadyIncluded = options.some((worker) => worker.id === user.id)
      if (!alreadyIncluded) {
        const availability =
          shiftSchedules.length > 0
            ? isWorkerOnShiftWithSchedule(user, shiftSchedules, shiftOptions)
            : isWorkerOnShiftFromUser(user, shiftOptions)

        options = [
          ...options,
          {
            ...user,
            availability,
            isBusy: busyWorkerIds.has(user.id),
          },
        ]
      }
    }

    const statusRank = (status: ReturnType<typeof isWorkerOnShiftFromUser>["status"]) => {
      switch (status) {
        case "AVAILABLE":
          return 0
        case "SHIFT_BREAK":
          return 1
        default:
          return 2
      }
    }

    return [...options].sort((a, b) => {
      const statusDiff = statusRank(a.availability.status) - statusRank(b.availability.status)
      if (statusDiff !== 0) return statusDiff

      const deptDiff = getDepartmentRank(a.department as Department) - getDepartmentRank(b.department as Department)
      if (deptDiff !== 0) return deptDiff

      return a.name.localeCompare(b.name)
    })
  }, [busyWorkerIds, shiftOptions, shiftSchedules, task.assigned_to_user_id, user, workersWithAvailability])

  const selectedWorker = useMemo(
    () => assigneeOptions.find((worker) => worker.id === selectedWorkerId) ?? null,
    [assigneeOptions, selectedWorkerId],
  )

  const hasOnDutyWorkers = useMemo(
    () => assigneeOptions.some((worker) => worker.availability.status === "AVAILABLE"),
    [assigneeOptions],
  )

  const formatDepartmentLabel = (department?: string) => {
    if (!department) return "Unknown"
    const normalized = normalizeDepartment(department)
    if (normalized) {
      return displayDepartmentLabels[normalized]
    }
    const typed = department as Department
    if (departmentLabels[typed]) {
      return departmentLabels[typed]
    }
    return department.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
  }

  const selectedWorkerLabel = selectedWorker
    ? (() => {
        const deptLabel = formatDepartmentLabel(selectedWorker.department)
        const supervisorTag = selectedWorker.role === "supervisor" ? " • Supervisor" : ""
        const statusLabel = STATUS_LABELS[selectedWorker.availability.status]
        const nameLabel = user && selectedWorker.id === user.id ? `${selectedWorker.name} (You)` : selectedWorker.name
        return `${nameLabel} • ${deptLabel}${supervisorTag} • ${statusLabel}`
      })()
    : undefined

  const handleReassign = () => {
    if (!selectedWorkerId || !reason.trim() || !user) return

    setIsSubmitting(true)
    reassignTaskFn(task.id, selectedWorkerId, user.id, reason)
    setIsSubmitting(false)
    onOpenChange(false)
    setSelectedWorkerId("")
    setReason("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Re-assign Task</DialogTitle>
          <DialogDescription>
            Re-assign this task to a different worker. The current worker will no longer see this task.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Current Task</Label>
            <div className="p-3 bg-muted rounded-lg text-sm">
              <p className="font-medium">{task.task_type}</p>
              <p className="text-muted-foreground">Room: {task.room_number}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="worker">Select New Assignee</Label>
            <Select value={selectedWorkerId} onValueChange={setSelectedWorkerId}>
              <SelectTrigger id="worker">
                <SelectValue placeholder="Choose an assignee">
                  {selectedWorkerLabel}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {assigneeOptions.map((assignee) => {
                  const isSelf = Boolean(user && assignee.id === user.id)
                  const status = STATUS_LABELS[assignee.availability.status]
                  const normalizedDept = normalizeDepartment(assignee.department as Department)
                  const departmentLabel = normalizedDept
                    ? displayDepartmentLabels[normalizedDept]
                    : formatDepartmentLabel(assignee.department)
                  const isSupervisor = assignee.role === "supervisor"
                  return (
                    <SelectItem
                      key={assignee.id}
                      value={assignee.id}
                      className={cn(
                        "min-w-[18rem]",
                        assignee.availability.status !== "AVAILABLE" && "opacity-80",
                      )}
                    >
                      <div className="flex w-full items-center justify-between gap-3">
                        <div className="flex flex-col text-left">
                          <span className="font-medium">
                            {isSelf ? `${assignee.name} (You)` : assignee.name}
                          </span>
                          <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                            <span>{departmentLabel}</span>
                            {isSupervisor && (
                              <Badge
                                variant="outline"
                                className="px-1.5 py-0 text-[10px] uppercase tracking-wide border-primary/30 bg-primary/5 text-primary"
                              >
                                Supervisor
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {assignee.isBusy && (
                            <Badge
                              variant="outline"
                              className="text-xs border-orange-200 bg-orange-100 text-orange-700"
                            >
                              Busy
                            </Badge>
                          )}
                          <Badge
                            variant="outline"
                            className={cn("text-xs", STATUS_BADGE_CLASSES[assignee.availability.status])}
                          >
                            {status}
                          </Badge>
                        </div>
                      </div>
                    </SelectItem>
                  )
                })}
                {assigneeOptions.length === 0 && (
                  <div className="px-3 py-4 text-sm text-muted-foreground">No eligible workers found.</div>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Re-assignment</Label>
            <Textarea
              id="reason"
              placeholder="e.g., Worker is too far away, wrong assignment, etc."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>

          {!hasOnDutyWorkers && assigneeOptions.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {"No one is currently on duty\u2014showing all staff members."}
            </p>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleReassign} disabled={!selectedWorkerId || !reason.trim() || isSubmitting}>
              {isSubmitting ? "Re-assigning..." : "Re-assign Task"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
