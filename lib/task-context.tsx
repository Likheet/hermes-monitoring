"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import type { Task, AuditLogEntry, User, TaskIssue, CategorizedPhotos, Department, UserRole } from "./types"
import type { MaintenanceSchedule, MaintenanceTask, MaintenanceTaskType, ShiftSchedule } from "./maintenance-types"
import { createDualTimestamp, mockUsers } from "./mock-data"
import { createNotification, playNotificationSound } from "./notification-utils"
import { triggerHapticFeedback } from "./haptics"
import { ALL_ROOMS, getMaintenanceItemsForRoom } from "./location-data"
import { useRealtimeTasks, type TaskRealtimePayload } from "./use-realtime-tasks"
import { hashPassword } from "./auth-utils"
import {
  loadTasksFromSupabase,
  loadUsersFromSupabase,
  loadShiftSchedulesFromSupabase,
  saveTaskToSupabase,
  saveUserToSupabase,
  saveMaintenanceScheduleToSupabase,
  saveMaintenanceTaskToSupabase,
  deleteMaintenanceScheduleFromSupabase,
  saveShiftScheduleToSupabase,
  deleteShiftScheduleFromSupabase,
  type LoadOptions,
} from "./supabase-task-operations"

const DEFAULT_MAINTENANCE_DURATION: Record<MaintenanceTaskType, number> = {
  ac_indoor: 30,
  ac_outdoor: 30,
  fan: 15,
  exhaust: 20,
  lift: 45,
  all: 60,
}

type NonAdminRole = Exclude<UserRole, "admin">

interface CreateUserInput {
  username: string
  password: string
  role: NonAdminRole
  name?: string
  department?: Department
}

interface CreateUserResult {
  success: boolean
  error?: string
}

const DEFAULT_DEPARTMENT_FOR_ROLE: Record<NonAdminRole, Department> = {
  worker: "housekeeping",
  supervisor: "maintenance",
  front_office: "front_desk",
}

const DEFAULT_SHIFT_TIMING = {
  start: "09:00",
  end: "17:00",
}

function generateUuid() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }

  const segments = [8, 4, 4, 4, 12]
  return segments
    .map((length) =>
      Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16)).join(""),
    )
    .join("-")
}

interface TaskContextType {
  tasks: Task[]
  users: User[]
  issues: TaskIssue[]
  schedules: MaintenanceSchedule[]
  maintenanceTasks: MaintenanceTask[]
  shiftSchedules: ShiftSchedule[]
  isBusy: boolean
  updateTask: (taskId: string, updates: Partial<Task>) => Promise<void>
  addAuditLog: (taskId: string, entry: Omit<AuditLogEntry, "timestamp">) => void
  startTask: (taskId: string, userId: string) => Promise<{ success: boolean; error?: string }>
  pauseTask: (
    taskId: string,
    userId: string,
    reason: string,
  ) => Promise<{ success: boolean; error?: string; pausedTaskId?: string; pausedTaskName?: string }>
  resumeTask: (taskId: string, userId: string) => Promise<{ success: boolean; error?: string }>
  completeTask: (taskId: string, userId: string, categorizedPhotos: CategorizedPhotos, remark: string) => Promise<void>
  getTaskById: (taskId: string) => Task | undefined
  createTask: (task: Omit<Task, "id" | "audit_log" | "pause_history">) => Promise<void>
  verifyTask: (
    taskId: string,
    userId: string,
    approved: boolean,
    supervisorRemark: string,
    rating: number | null,
    qualityComment: string | null,
    ratingProofPhotoUrl: string | null,
    rejectionProofPhotoUrl: string | null,
  ) => void
  reassignTask: (taskId: string, newWorkerId: string, userId: string, reason: string) => void
  dismissRejectedTask: (taskId: string, userId: string) => void
  updateWorkerShift: (
    workerId: string,
    shiftStart: string,
    shiftEnd: string,
    userId: string,
    hasBreak: boolean,
    breakStart?: string,
    breakEnd?: string,
  ) => void
  addWorker: (input: CreateUserInput) => Promise<CreateUserResult>
  raiseIssue: (taskId: string, userId: string, issueDescription: string, photos?: string[]) => void
  addSchedule: (schedule: Omit<MaintenanceSchedule, "id" | "created_at">) => void
  updateSchedule: (scheduleId: string, updates: Partial<MaintenanceSchedule>) => void
  deleteSchedule: (scheduleId: string) => void
  toggleSchedule: (scheduleId: string) => void
  updateMaintenanceTask: (taskId: string, updates: Partial<MaintenanceTask>) => void
  swapTasks: (pauseTaskId: string, resumeTaskId: string, userId: string) => { success: boolean; error?: string }
  saveShiftSchedule: (schedule: Omit<ShiftSchedule, "id" | "created_at">) => void
  getShiftSchedules: (workerId: string, startDate: string, endDate: string) => ShiftSchedule[]
  deleteShiftSchedule: (scheduleId: string) => void
}

const TaskContext = createContext<TaskContextType | undefined>(undefined)

export function TaskProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [issues, setIssues] = useState<TaskIssue[]>([])
  const [schedules, setSchedules] = useState<MaintenanceSchedule[]>([])
  const [maintenanceTasks, setMaintenanceTasks] = useState<MaintenanceTask[]>([])
  const [shiftSchedules, setShiftSchedules] = useState<ShiftSchedule[]>([])
  const [activeRequests, setActiveRequests] = useState(0)

  const beginRequest = useCallback(() => {
    setActiveRequests((prev) => prev + 1)
  }, [])

  const settleRequest = useCallback(() => {
    setActiveRequests((prev) => (prev > 0 ? prev - 1 : 0))
  }, [])

  const runWithGlobalLoading = useCallback(<T,>(operation: () => Promise<T>) => {
    beginRequest()

    let operationPromise: Promise<T>
    try {
      operationPromise = operation()
    } catch (error) {
      settleRequest()
      return Promise.reject(error)
    }

    return operationPromise.finally(() => {
      settleRequest()
    })
  }, [beginRequest, settleRequest])

  const isBusy = activeRequests > 0

  const refreshTasks = useCallback((options?: LoadOptions) => {
    return runWithGlobalLoading(async () => {
      try {
        const data = await loadTasksFromSupabase(options)
        setTasks(data)
      } catch (error) {
        console.error("[v0] Error loading tasks from Supabase:", error)
      }
    })
  }, [runWithGlobalLoading])

  const refreshUsers = useCallback((options?: LoadOptions) => {
    return runWithGlobalLoading(async () => {
      try {
        const data = await loadUsersFromSupabase(options)
        if (data.length > 0) {
          setUsers(data)
        } else {
          setUsers(mockUsers)
        }
      } catch (error) {
        console.error("[v0] Error loading users from Supabase:", error)
        setUsers(mockUsers)
      }
    })
  }, [runWithGlobalLoading])

  const refreshShiftSchedules = useCallback((options?: LoadOptions) => {
    return runWithGlobalLoading(async () => {
      try {
        const data = await loadShiftSchedulesFromSupabase(options)
        setShiftSchedules(data)
      } catch (error) {
        console.error("[v0] Error loading shift schedules from Supabase:", error)
        setShiftSchedules([])
      }
    })
  }, [runWithGlobalLoading])

  const handleRealtimeTaskUpdate = useCallback(
    (payload: TaskRealtimePayload) => {
      console.log("[v0] Realtime task update received:", payload.eventType)
      void refreshTasks({ forceRefresh: true })
    },
    [refreshTasks],
  )

  const { isConnected } = useRealtimeTasks({
    enabled: true,
    onTaskUpdate: handleRealtimeTaskUpdate,
  })

  useEffect(() => {
    console.log("[v0] Realtime connection status:", isConnected ? "CONNECTED" : "DISCONNECTED")
  }, [isConnected])

  useEffect(() => {
    async function loadData() {
      console.log("[v0] Loading data from Supabase...")

      try {
        await Promise.all([refreshTasks(), refreshUsers(), refreshShiftSchedules()])

        console.log("[v0] ✅ Data loaded from Supabase")
      } catch (error) {
        console.error("[v0] Error loading data:", error)
        setUsers(mockUsers)
      }
    }

    loadData()
  }, [refreshTasks, refreshUsers, refreshShiftSchedules])

  const updateTask = async (taskId: string, updates: Partial<Task>) => {
    await runWithGlobalLoading(async () => {
      try {
        const response = await fetch(`/api/tasks/${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        })

        if (response.ok) {
          const { task } = await response.json()
          setTasks((prev) =>
            prev.map((t) => {
              if (t.id !== taskId) return t
              const merged = {
                ...t,
                ...task,
                department: t.department ?? task.department,
              }

              Object.entries(updates).forEach(([key, value]) => {
                if (typeof value !== "undefined") {
                  ;(merged as Record<string, unknown>)[key] = value as unknown
                }
              })

              return merged
            }),
          )
          console.log("[v0] Task updated successfully via API:", taskId)
        } else {
          console.error("[v0] Failed to update task via API:", await response.text())
        }
      } catch (error) {
        console.error("[v0] Error updating task:", error)
      }
    })
  }

  const addAuditLog = (taskId: string, entry: Omit<AuditLogEntry, "timestamp">) => {
    setTasks((prev) =>
      prev.map((task) => {
        if (task.id === taskId) {
          return {
            ...task,
            audit_log: [
              ...task.audit_log,
              {
                ...entry,
                timestamp: createDualTimestamp(),
              },
            ],
          }
        }
        return task
      }),
    )
  }

  const startTask = async (taskId: string, userId: string) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return { success: false, error: "Task not found." }

    const hasActiveTask = tasks.some(
      (t) => t.assigned_to_user_id === userId && t.status === "IN_PROGRESS" && t.id !== taskId,
    )

    if (hasActiveTask) {
      return {
        success: false,
        error: "You already have a task in progress. Please pause it first before starting another task.",
      }
    }

    return runWithGlobalLoading(async () => {
      try {
        const response = await fetch(`/api/tasks/${taskId}/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        })

        if (response.ok) {
          await refreshTasks()
          return { success: true }
        } else {
          const error = await response.json()
          return { success: false, error: error.message || "Failed to start task" }
        }
      } catch (error) {
        console.error("[v0] Error starting task:", error)
        return { success: false, error: "Network error" }
      }
    })
  }

  const pauseTask = async (taskId: string, userId: string, reason: string) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return { success: false, error: "Task not found." }

    const pausedTask = tasks.find((t) => t.assigned_to_user_id === userId && t.status === "PAUSED" && t.id !== taskId)

    if (pausedTask) {
      return {
        success: false,
        error: "You already have a paused task. Please resume or complete it first.",
        pausedTaskId: pausedTask.id,
        pausedTaskName: pausedTask.task_type,
      }
    }

    return runWithGlobalLoading(async () => {
      try {
        const response = await fetch(`/api/tasks/${taskId}/pause`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, reason }),
        })

        if (response.ok) {
          await refreshTasks()
          return { success: true }
        } else {
          const error = await response.json()
          return { success: false, error: error.message || "Failed to pause task" }
        }
      } catch (error) {
        console.error("[v0] Error pausing task:", error)
        return { success: false, error: "Network error" }
      }
    })
  }

  const resumeTask = async (taskId: string, userId: string) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return { success: false, error: "Task not found." }

    const hasActiveTask = tasks.some(
      (t) => t.assigned_to_user_id === userId && t.status === "IN_PROGRESS" && t.id !== taskId,
    )

    if (hasActiveTask) {
      return {
        success: false,
        error: "You already have a task in progress. Please pause it first before resuming another task.",
      }
    }

    return runWithGlobalLoading(async () => {
      try {
        const response = await fetch(`/api/tasks/${taskId}/resume`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        })

        if (response.ok) {
          await refreshTasks()
          return { success: true }
        } else {
          const error = await response.json()
          return { success: false, error: error.message || "Failed to resume task" }
        }
      } catch (error) {
        console.error("[v0] Error resuming task:", error)
        return { success: false, error: "Network error" }
      }
    })
  }

  const completeTask = async (taskId: string, userId: string, categorizedPhotos: CategorizedPhotos, remark: string) => {
    await runWithGlobalLoading(async () => {
      try {
        const response = await fetch(`/api/tasks/${taskId}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, categorizedPhotos, remark }),
        })

        if (response.ok) {
          await refreshTasks()
          console.log("[v0] Task completed successfully via API:", taskId)
        } else {
          console.error("[v0] Failed to complete task via API:", await response.text())
        }
      } catch (error) {
        console.error("[v0] Error completing task:", error)
      }
    })
  }

  const getTaskById = (taskId: string) => {
    return tasks.find((t) => t.id === taskId)
  }

  const createTask = async (taskData: Omit<Task, "id" | "audit_log" | "pause_history">) => {
    await runWithGlobalLoading(async () => {
      try {
        const response = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...taskData,
            assigned_at_client: taskData.assigned_at.client,
          }),
        })

        if (response.ok) {
          const { task } = await response.json()
          setTasks((prev) => [...prev, task])
          console.log("[v0] Task created successfully via API:", task.id)

          if (task.is_custom_task || task.custom_task_name) {
            const adminUsers = users.filter((u) => u.role === "admin")
            const notificationName = task.custom_task_name || task.task_type
            adminUsers.forEach((admin) => {
              createNotification(
                admin.id,
                "system",
                "Custom Task Created",
                `Front office created a custom task: "${notificationName}" at ${task.room_number || "N/A"}. Consider adding this as a permanent task type.`,
                task.id,
              )
            })
          }
        } else {
          console.error("[v0] Failed to create task via API:", await response.text())
        }
      } catch (error) {
        console.error("[v0] Error creating task:", error)
      }
    })
  }

  const verifyTask = (
    taskId: string,
    userId: string,
    approved: boolean,
    supervisorRemark: string,
    rating: number | null = null,
    qualityComment: string | null = null,
    ratingProofPhotoUrl: string | null = null,
    rejectionProofPhotoUrl: string | null = null,
  ) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return

    if (approved) {
      updateTask(taskId, {
        supervisor_remark: supervisorRemark,
        rating,
        quality_comment: qualityComment,
        rating_proof_photo_url: ratingProofPhotoUrl,
      })
      addAuditLog(taskId, {
        user_id: userId,
        action: "TASK_APPROVED",
        old_status: task.status,
        new_status: task.status,
        details: `Supervisor approved task with ${rating} star rating: ${supervisorRemark}`,
      })
    } else {
      updateTask(taskId, {
        status: "REJECTED",
        supervisor_remark: supervisorRemark,
        rejection_proof_photo_url: rejectionProofPhotoUrl,
      })
      addAuditLog(taskId, {
        user_id: userId,
        action: "TASK_REJECTED",
        old_status: task.status,
        new_status: "REJECTED",
        details: `Supervisor rejected task: ${supervisorRemark}`,
      })

      const allRejectionPhotos = rejectionProofPhotoUrl ? [rejectionProofPhotoUrl] : []
      const originalPhotos = task.categorized_photos || { room_photos: [], proof_photos: [] }

      const newTask: Task = {
        id: generateUuid(),
        task_type: `[REWORK] ${task.task_type}`,
        priority_level: task.priority_level,
        status: "PENDING",
        department: task.department,
        assigned_to_user_id: "",
        assigned_by_user_id: userId,
        assigned_at: createDualTimestamp(),
        started_at: null,
        completed_at: null,
        expected_duration_minutes: task.expected_duration_minutes,
        actual_duration_minutes: null,
        photo_urls: [...allRejectionPhotos, ...task.photo_urls],
        categorized_photos: {
          room_photos: [...allRejectionPhotos, ...originalPhotos.room_photos],
          proof_photos: originalPhotos.proof_photos,
        },
        photo_required: task.photo_required,
        worker_remark: `Original task rejected. Supervisor remark: ${supervisorRemark}`,
        supervisor_remark: "",
        rating: null,
        quality_comment: null,
        rating_proof_photo_url: null,
        rejection_proof_photo_url: null,
        room_number: task.room_number,
        pause_history: [],
        audit_log: [
          {
            timestamp: createDualTimestamp(),
            user_id: userId,
            action: "TASK_CREATED_FROM_REJECTION",
            old_status: null,
            new_status: "PENDING",
            details: `Task created from rejected task ${taskId}. Awaiting supervisor assignment.`,
          },
        ],
      }

      setTasks((prev) => {
        const updated = [...prev, newTask]
        runWithGlobalLoading(async () => {
          await saveTaskToSupabase(newTask)
        }).catch((error) => {
          console.error("[v0] Error saving rework task to Supabase:", error)
        })
        return updated
      })

      console.log("[v0] Created new rework task from rejection:", newTask.id)

      const supervisors = users.filter((u) => u.role === "supervisor")
      supervisors.forEach((supervisor) => {
        createNotification(
          supervisor.id,
          "task_assigned",
          "Rework Task Created",
          `A rework task "${newTask.task_type}" needs to be assigned at ${newTask.room_number}`,
          newTask.id,
        )
      })

      if (task.assigned_to_user_id) {
        createNotification(
          task.assigned_to_user_id,
          "task_rejected",
          "Task Rejected",
          `Your task "${task.task_type}" was rejected. A rework task has been created.`,
          taskId,
        )
        playNotificationSound()
        triggerHapticFeedback("error")
      }
    }
  }

  const reassignTask = (taskId: string, newWorkerId: string, userId: string, reason: string) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task || task.status !== "PENDING") return

    const oldWorkerId = task.assigned_to_user_id
    const newWorker = users.find((u) => u.id === newWorkerId)

    const reassignedAt = createDualTimestamp()

    updateTask(taskId, {
      assigned_to_user_id: newWorkerId,
      assigned_at: reassignedAt,
    })

    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              assigned_to_user_id: newWorkerId,
              assigned_at: reassignedAt,
              department: newWorker?.department || t.department,
            }
          : t,
      ),
    )

    addAuditLog(taskId, {
      user_id: userId,
      action: "TASK_REASSIGNED",
      old_status: task.status,
      new_status: task.status,
      details: `Task reassigned from worker ${oldWorkerId} to ${newWorkerId}. Reason: ${reason}`,
    })

    createNotification(
      newWorkerId,
      "task_assigned",
      "New Task Assigned",
      `You have been assigned: ${task.task_type} at ${task.room_number}`,
      taskId,
    )
    playNotificationSound()
    triggerHapticFeedback("success")
  }

  const dismissRejectedTask = (taskId: string, userId: string) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task || task.status !== "REJECTED") return

    const now = createDualTimestamp()
    updateTask(taskId, {
      rejection_acknowledged: true,
      rejection_acknowledged_at: now,
    })

    addAuditLog(taskId, {
      user_id: userId,
      action: "REJECTION_ACKNOWLEDGED",
      old_status: task.status,
      new_status: task.status,
      details: "Worker acknowledged rejection - task retained for records",
    })

    console.log("[v0] Rejection acknowledged for task:", taskId, "- task retained in system")
  }

  const updateWorkerShift = (
    workerId: string,
    shiftStart: string,
    shiftEnd: string,
    userId: string,
    hasBreak = false,
    breakStart?: string,
    breakEnd?: string,
  ) => {
    console.log("[v0] Updating worker shift:", {
      workerId,
      shiftStart,
      shiftEnd,
      hasBreak,
      breakStart,
      breakEnd,
      updatedBy: userId,
    })
    setUsers((prev) => {
      const updated = prev.map((user) =>
        user.id === workerId
          ? {
              ...user,
              shift_start: shiftStart,
              shift_end: shiftEnd,
              has_break: hasBreak,
              break_start: breakStart,
              break_end: breakEnd,
            }
          : user,
      )
      console.log(
        "[v0] Worker shift updated. Updated user:",
        updated.find((u) => u.id === workerId),
      )
      return updated
    })
    console.log("[v0] Worker shift update complete")
  }

  const addWorker = useCallback(
    (input: CreateUserInput) => {
      return runWithGlobalLoading(async () => {
        const username = input.username.trim().toLowerCase()
        const password = input.password.trim()

        if (!username || !password) {
          return { success: false, error: "Username and password are required." }
        }

        const role: NonAdminRole = input.role
        try {
          const passwordHash = await hashPassword(password)
          const department = input.department ?? DEFAULT_DEPARTMENT_FOR_ROLE[role]
          const newUser: User = {
            id: generateUuid(),
            name: input.name?.trim() || username,
            role,
            phone: "",
            department,
            shift_start: DEFAULT_SHIFT_TIMING.start,
            shift_end: DEFAULT_SHIFT_TIMING.end,
            has_break: false,
            break_start: undefined,
            break_end: undefined,
            is_available: true,
          }

          const saved = await saveUserToSupabase(newUser, { username, passwordHash })
          if (!saved) {
            return { success: false, error: "Unable to store the new user in the database." }
          }

          setUsers((prev) => [...prev, newUser])
          void refreshUsers({ forceRefresh: true })
          console.log("[v0] Added new team member:", newUser.id, "role:", role)
          return { success: true }
        } catch (error) {
          console.error("[v0] Error adding new user:", error)
          const message = error instanceof Error ? error.message : "Failed to add user"
          return { success: false, error: message }
        }
      })
    },
    [runWithGlobalLoading, refreshUsers],
  )

  const raiseIssue = (taskId: string, userId: string, issueDescription: string, photos?: string[]) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return

    const newIssue: TaskIssue = {
      id: `issue${Date.now()}`,
      task_id: taskId,
      reported_by_user_id: userId,
      reported_at: createDualTimestamp(),
      issue_description: issueDescription,
      issue_photos: photos || [], // Store photos in issue
      status: "OPEN",
    }

    setIssues((prev) => [...prev, newIssue])

    addAuditLog(taskId, {
      user_id: userId,
      action: "ISSUE_RAISED",
      old_status: task.status,
      new_status: task.status,
      details: `Worker raised issue: ${issueDescription}${photos ? ` (with ${photos.length} photo(s))` : ""}`, // Include photo count in audit log
    })

    const supervisors = users.filter((u) => u.role === "supervisor")
    supervisors.forEach((supervisor) => {
      createNotification(
        supervisor.id,
        "task_assigned",
        "Issue Reported",
        `Worker reported issue on task "${task.task_type}": ${issueDescription}`,
        taskId,
      )
    })

    const frontOfficeUsers = users.filter((u) => u.role === "front_office")
    frontOfficeUsers.forEach((fo) => {
      createNotification(
        fo.id,
        "task_assigned",
        "Issue Reported",
        `Worker reported issue on task "${task.task_type}": ${issueDescription}`,
        taskId,
      )
    })

    playNotificationSound()
    triggerHapticFeedback("error")

    console.log("[v0] Issue raised:", newIssue)
  }

  const addSchedule = (scheduleData: Omit<MaintenanceSchedule, "id" | "created_at">) => {
    const newSchedule: MaintenanceSchedule = {
      ...scheduleData,
      id: generateUuid(),
      created_at: createDualTimestamp(),
      metadata_version: 1,
    }
    console.log("[v0] Adding new schedule:", newSchedule)
    setSchedules((prev) => [...prev, newSchedule])

    const persistSchedule = async () => {
      try {
        const saved = await runWithGlobalLoading(() => saveMaintenanceScheduleToSupabase(newSchedule))

        if (!saved) {
          console.warn("[v0] Failed to save maintenance schedule, skipping task generation")
          setSchedules((prev) => prev.filter((schedule) => schedule.id !== newSchedule.id))
          return
        }

        console.log("[v0] Maintenance schedule stored in Supabase, id:", newSchedule.id)

        if (newSchedule.active) {
          console.log("[v0] Schedule is active, generating tasks")
          await runWithGlobalLoading(() => generateMaintenanceTasksFromSchedule(newSchedule))
        }

        console.log("[v0] Schedule added successfully")
      } catch (error) {
        console.error("[v0] Error persisting maintenance schedule:", error)
      }
    }

    void persistSchedule()
  }

  const updateSchedule = (scheduleId: string, updates: Partial<MaintenanceSchedule>) => {
    console.log("[v0] Updating schedule:", scheduleId, updates)

    const existing = schedules.find((s) => s.id === scheduleId)
    if (!existing) {
      console.warn("[v0] Attempted to update missing schedule", scheduleId)
      return
    }

    const scheduleSnapshot: MaintenanceSchedule = { ...existing, ...updates }

    setSchedules((prev) => prev.map((s) => (s.id === scheduleId ? scheduleSnapshot : s)))

    runWithGlobalLoading(async () => {
      await saveMaintenanceScheduleToSupabase(scheduleSnapshot)
    }).catch((error) => {
      console.error("[v0] Error updating maintenance schedule:", error)
    })
  }

  const deleteSchedule = (scheduleId: string) => {
    console.log("[v0] Deleting schedule:", scheduleId)
    setSchedules((prev) => {
      const updated = prev.filter((s) => s.id !== scheduleId)
      setMaintenanceTasks((prevTasks) => prevTasks.filter((t) => t.schedule_id !== scheduleId))
      return updated
    })
    runWithGlobalLoading(async () => {
      await deleteMaintenanceScheduleFromSupabase(scheduleId)
    }).catch((error) => {
      console.error("[v0] Error deleting maintenance schedule:", error)
    })
  }

  const toggleSchedule = (scheduleId: string) => {
    console.log("[v0] Toggling schedule:", scheduleId)

    const existing = schedules.find((s) => s.id === scheduleId)
    if (!existing) {
      console.warn("[v0] Attempted to toggle missing schedule", scheduleId)
      return
    }

    const scheduleSnapshot: MaintenanceSchedule = { ...existing, active: !existing.active }

    setSchedules((prev) => prev.map((s) => (s.id === scheduleId ? scheduleSnapshot : s)))

    runWithGlobalLoading(async () => {
      await saveMaintenanceScheduleToSupabase(scheduleSnapshot)
    }).catch((error) => {
      console.error("[v0] Error toggling maintenance schedule:", error)
    })

    if (scheduleSnapshot.active) {
      console.log("[v0] Schedule activated, generating tasks")
      runWithGlobalLoading(async () => {
        await generateMaintenanceTasksFromSchedule(scheduleSnapshot)
      }).catch((error) => {
        console.error("[v0] Error generating maintenance tasks for toggled schedule:", error)
      })
    }
  }

  const generateMaintenanceTasksFromSchedule = async (schedule: MaintenanceSchedule) => {
    if (!schedule.active) {
      console.log("[v0] Schedule is not active, skipping task generation")
      return
    }

    const currentDate = new Date()
    const currentMonth = currentDate.getMonth() + 1
    const currentYear = currentDate.getFullYear()

    console.log("[v0] Generating maintenance tasks for schedule:", schedule.id, schedule.task_type, schedule.area)

    let roomsToGenerate = ALL_ROOMS
    if (schedule.area === "a_block") {
      roomsToGenerate = ALL_ROOMS.filter((r) => r.block === "A")
    } else if (schedule.area === "b_block") {
      roomsToGenerate = ALL_ROOMS.filter((r) => r.block === "B")
    }

    console.log("[v0] Generating tasks for", roomsToGenerate.length, "rooms")

    const taskTypesToGenerate: MaintenanceTaskType[] =
      schedule.task_type === "all" ? ["ac_indoor", "ac_outdoor", "fan", "exhaust"] : [schedule.task_type]

    console.log("[v0] Task types to generate:", taskTypesToGenerate)

    const tasksToPersist: MaintenanceTask[] = []

    roomsToGenerate.forEach((room) => {
      const maintenanceItems = getMaintenanceItemsForRoom(room.number)

      const filteredItems = maintenanceItems.filter((item) => taskTypesToGenerate.includes(item.type))

      filteredItems.forEach((item) => {
        const newTask: MaintenanceTask = {
          id: generateUuid(),
          schedule_id: schedule.id,
          room_number: room.number,
          task_type: item.type,
          location: item.location,
          description: `${item.description} - room ${room.number}`,
          status: "pending",
          photos: [],
          categorized_photos: {
            before_photos: [],
            during_photos: [],
            after_photos: [],
          },
          period_month: currentMonth,
          period_year: currentYear,
          created_at: new Date().toISOString(),
          expected_duration_minutes: DEFAULT_MAINTENANCE_DURATION[item.type] ?? DEFAULT_MAINTENANCE_DURATION.all,
        }
        tasksToPersist.push(newTask)
      })
    })

    console.log("[v0] Generated", tasksToPersist.length, "maintenance tasks")

    if (tasksToPersist.length === 0) {
      return
    }

    const persistenceOutcomes = await Promise.all(
      tasksToPersist.map(async (task) => ({ task, saved: await saveMaintenanceTaskToSupabase(task) })),
    )

    const successfulTasks = persistenceOutcomes.filter((outcome) => outcome.saved).map((outcome) => outcome.task)
    const failedTasks = persistenceOutcomes.filter((outcome) => !outcome.saved).map((outcome) => outcome.task.id)

    if (successfulTasks.length > 0) {
      setMaintenanceTasks((prev) => [...prev, ...successfulTasks])
      console.log(`[v0] Persisted ${successfulTasks.length} maintenance tasks to Supabase`)
    }

    if (failedTasks.length > 0) {
      console.warn("[v0] Failed to persist maintenance tasks:", failedTasks)
    }
  }

  const updateMaintenanceTask = (taskId: string, updates: Partial<MaintenanceTask>) => {
    console.log("[v0] Updating maintenance task:", taskId, updates)
    const existing = maintenanceTasks.find((t) => t.id === taskId)
    if (!existing) {
      console.warn("[v0] Attempted to update missing maintenance task", taskId)
      return
    }

    const updatedTask: MaintenanceTask = { ...existing, ...updates }

    setMaintenanceTasks((prev) => {
      const updated = prev.map((t) => (t.id === taskId ? updatedTask : t))
      console.log(
        "[v0] Task updated. Total tasks:",
        updated.length,
        "Active tasks:",
        updated.filter((t) => t.status === "in_progress" || t.status === "paused").length,
      )
      return updated
    })

    runWithGlobalLoading(async () => {
      await saveMaintenanceTaskToSupabase(updatedTask)
    }).catch((error) => {
      console.error("[v0] Error saving maintenance task to Supabase:", error)
    })
  }

  const swapTasks = (pauseTaskId: string, resumeTaskId: string, userId: string) => {
    const taskToPause = tasks.find((t) => t.id === pauseTaskId)
    const taskToResume = tasks.find((t) => t.id === resumeTaskId)

    if (!taskToPause || !taskToResume) {
      return { success: false, error: "One or both tasks not found." }
    }

    if (taskToPause.status !== "IN_PROGRESS") {
      return { success: false, error: "Task to pause is not in progress." }
    }

    if (taskToResume.status !== "PAUSED") {
      return { success: false, error: "Task to resume is not paused." }
    }

    const now = createDualTimestamp()

    updateTask(pauseTaskId, {
      status: "PAUSED",
      pause_history: [
        ...taskToPause.pause_history,
        { paused_at: now, resumed_at: null, reason: "Swapped to work on another task" },
      ],
    })
    addAuditLog(pauseTaskId, {
      user_id: userId,
      action: "TASK_PAUSED",
      old_status: "IN_PROGRESS",
      new_status: "PAUSED",
      details: "Task paused to resume another task",
    })

    const updatedPauseHistory = [...taskToResume.pause_history]
    const lastPause = updatedPauseHistory[updatedPauseHistory.length - 1]
    if (lastPause && !lastPause.resumed_at) {
      lastPause.resumed_at = now
    }

    updateTask(resumeTaskId, {
      status: "IN_PROGRESS",
      pause_history: updatedPauseHistory,
    })
    addAuditLog(resumeTaskId, {
      user_id: userId,
      action: "TASK_RESUMED",
      old_status: "PAUSED",
      new_status: "IN_PROGRESS",
      details: "Task resumed via swap",
    })

    return { success: true }
  }

  const saveShiftSchedule = (scheduleData: Omit<ShiftSchedule, "id" | "created_at">) => {
    console.log("[v0] Saving shift schedule:", scheduleData)

    const existingIndex = shiftSchedules.findIndex(
      (s) => s.worker_id === scheduleData.worker_id && s.schedule_date === scheduleData.schedule_date,
    )

    if (existingIndex >= 0) {
      console.log("[v0] Updating existing shift schedule")
      const updatedSchedule = {
        ...shiftSchedules[existingIndex],
        ...scheduleData,
        has_break: Boolean(scheduleData.break_start && scheduleData.break_end),
        created_at: new Date().toISOString(),
      }
      setShiftSchedules((prev) => prev.map((s, i) => (i === existingIndex ? updatedSchedule : s)))
      runWithGlobalLoading(async () => {
        await saveShiftScheduleToSupabase(updatedSchedule)
      }).catch((error) => {
        console.error("[v0] Error saving shift schedule:", error)
      })
    } else {
      const newSchedule: ShiftSchedule = {
        ...scheduleData,
        has_break: Boolean(scheduleData.break_start && scheduleData.break_end),
        id: generateUuid(),
        created_at: new Date().toISOString(),
      }
      console.log("[v0] Creating new shift schedule:", newSchedule.id)
      setShiftSchedules((prev) => [...prev, newSchedule])
      runWithGlobalLoading(async () => {
        await saveShiftScheduleToSupabase(newSchedule)
      }).catch((error) => {
        console.error("[v0] Error saving new shift schedule:", error)
      })
    }
  }

  const getShiftSchedules = (workerId: string, startDate: string, endDate: string) => {
    const filtered = shiftSchedules.filter(
      (s) => s.worker_id === workerId && s.schedule_date >= startDate && s.schedule_date <= endDate,
    )
    console.log(
      "[v0] Found",
      filtered.length,
      "shift schedules for worker",
      workerId,
      "between",
      startDate,
      "and",
      endDate,
    )
    return filtered
  }

  const deleteShiftSchedule = (scheduleId: string) => {
    console.log("[v0] Deleting shift schedule:", scheduleId)
    setShiftSchedules((prev) => {
      const updated = prev.filter((s) => s.id !== scheduleId)
      runWithGlobalLoading(async () => {
        await deleteShiftScheduleFromSupabase(scheduleId)
      }).catch((error) => {
        console.error("[v0] Error deleting shift schedule:", error)
      })
      return updated
    })
  }

  return (
    <TaskContext.Provider
      value={{
        tasks,
        users,
        issues,
        schedules,
        maintenanceTasks,
        shiftSchedules,
  isBusy,
        updateTask,
        addAuditLog,
        startTask,
        pauseTask,
        resumeTask,
        completeTask,
        getTaskById,
        createTask,
        verifyTask,
        reassignTask,
        dismissRejectedTask,
        updateWorkerShift,
        addWorker,
        raiseIssue,
        addSchedule,
        updateSchedule,
        deleteSchedule,
        toggleSchedule,
        updateMaintenanceTask,
        swapTasks,
        saveShiftSchedule,
        getShiftSchedules,
        deleteShiftSchedule,
      }}
    >
      {children}
    </TaskContext.Provider>
  )
}

function useTasks() {
  const context = useContext(TaskContext)
  if (context === undefined) {
    throw new Error("useTasks must be used within a TaskProvider")
  }
  return context
}

export { useTasks }

