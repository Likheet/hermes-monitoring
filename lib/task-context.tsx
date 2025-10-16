"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import type { Task, AuditLogEntry, PauseRecord, User, TaskIssue, CategorizedPhotos } from "./types"
import type { MaintenanceSchedule, MaintenanceTask, MaintenanceTaskType } from "./maintenance-types"
import { mockTasks, createDualTimestamp, mockUsers, mockIssues } from "./mock-data"
import { createClient } from "@/lib/supabase/client"
import { createNotification, playNotificationSound } from "./notification-utils"
import { triggerHapticFeedback } from "./haptics"
import { ALL_ROOMS, getMaintenanceItemsForRoom } from "./location-data"

interface TaskContextType {
  tasks: Task[]
  users: User[]
  issues: TaskIssue[]
  schedules: MaintenanceSchedule[]
  maintenanceTasks: MaintenanceTask[]
  updateTask: (taskId: string, updates: Partial<Task>) => void
  addAuditLog: (taskId: string, entry: Omit<AuditLogEntry, "timestamp">) => void
  startTask: (taskId: string, userId: string) => void
  pauseTask: (taskId: string, userId: string, reason: string) => void
  resumeTask: (taskId: string, userId: string) => void
  completeTask: (taskId: string, userId: string, categorizedPhotos: CategorizedPhotos, remark: string) => void
  getTaskById: (taskId: string) => Task | undefined
  createTask: (task: Omit<Task, "id" | "audit_log" | "pause_history">) => void
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
  addWorker: (worker: Omit<User, "id" | "is_available">) => void
  raiseIssue: (taskId: string, userId: string, issueDescription: string) => void
  addSchedule: (schedule: Omit<MaintenanceSchedule, "id" | "created_at">) => void
  updateSchedule: (scheduleId: string, updates: Partial<MaintenanceSchedule>) => void
  deleteSchedule: (scheduleId: string) => void
  toggleSchedule: (scheduleId: string) => void
  updateMaintenanceTask: (taskId: string, updates: Partial<MaintenanceTask>) => void
}

const TaskContext = createContext<TaskContextType | undefined>(undefined)

export function TaskProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>(mockTasks)
  const [users, setUsers] = useState<User[]>(mockUsers)
  const [issues, setIssues] = useState<TaskIssue[]>(mockIssues)
  const [schedules, setSchedules] = useState<MaintenanceSchedule[]>([])
  const [maintenanceTasks, setMaintenanceTasks] = useState<MaintenanceTask[]>([])
  const [isRealtimeEnabled] = useState(false) // Set to true when switching to real database

  useEffect(() => {
    if (!isRealtimeEnabled) return

    const supabase = createClient()

    const channel = supabase
      .channel("tasks-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
        },
        (payload) => {
          console.log("[v0] Realtime task change:", payload)

          if (payload.eventType === "INSERT") {
            setTasks((prev) => [...prev, payload.new as Task])
          } else if (payload.eventType === "UPDATE") {
            setTasks((prev) => prev.map((task) => (task.id === payload.new.id ? (payload.new as Task) : task)))
          } else if (payload.eventType === "DELETE") {
            setTasks((prev) => prev.filter((task) => task.id !== payload.old.id))
          }
        },
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [isRealtimeEnabled])

  useEffect(() => {
    console.log("[v0] TaskProvider mounted, loading from localStorage")
    const savedSchedules = localStorage.getItem("maintenance_schedules")
    const savedTasks = localStorage.getItem("maintenance_tasks")

    console.log("[v0] localStorage check:", {
      hasSchedules: !!savedSchedules,
      hasTasks: !!savedTasks,
      schedulesLength: savedSchedules?.length,
      tasksLength: savedTasks?.length,
    })

    if (savedSchedules) {
      try {
        const parsed = JSON.parse(savedSchedules)
        console.log("[v0] Loaded", parsed.length, "schedules from localStorage")
        setSchedules(parsed)
      } catch (error) {
        console.error("[v0] Error loading schedules:", error)
      }
    }

    if (savedTasks) {
      try {
        const parsed = JSON.parse(savedTasks)
        console.log("[v0] Loaded", parsed.length, "maintenance tasks from localStorage")
        setMaintenanceTasks(parsed)
      } catch (error) {
        console.error("[v0] Error loading maintenance tasks:", error)
      }
    } else {
      console.log("[v0] No maintenance tasks found in localStorage")
    }
  }, [])

  useEffect(() => {
    if (maintenanceTasks.length > 0) {
      localStorage.setItem("maintenance_tasks", JSON.stringify(maintenanceTasks))
      console.log("[v0] Saved", maintenanceTasks.length, "maintenance tasks to localStorage")
    }
  }, [maintenanceTasks])

  useEffect(() => {
    if (schedules.length > 0) {
      localStorage.setItem("maintenance_schedules", JSON.stringify(schedules))
      console.log("[v0] Saved", schedules.length, "schedules to localStorage")
    }
  }, [schedules])

  const updateTask = (taskId: string, updates: Partial<Task>) => {
    setTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, ...updates } : task)))
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

  const startTask = (taskId: string, userId: string) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return

    const now = createDualTimestamp()
    updateTask(taskId, {
      status: "IN_PROGRESS",
      started_at: now,
    })
    addAuditLog(taskId, {
      user_id: userId,
      action: "TASK_STARTED",
      old_status: task.status,
      new_status: "IN_PROGRESS",
      details: "Worker started task",
    })
  }

  const pauseTask = (taskId: string, userId: string, reason: string) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return

    const now = createDualTimestamp()
    const newPauseRecord: PauseRecord = {
      paused_at: now,
      resumed_at: null,
      reason,
    }

    updateTask(taskId, {
      status: "PAUSED",
      pause_history: [...task.pause_history, newPauseRecord],
    })
    addAuditLog(taskId, {
      user_id: userId,
      action: "TASK_PAUSED",
      old_status: task.status,
      new_status: "PAUSED",
      details: `Task paused: ${reason}`,
    })
  }

  const resumeTask = (taskId: string, userId: string) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return

    const now = createDualTimestamp()
    const updatedPauseHistory = [...task.pause_history]
    const lastPause = updatedPauseHistory[updatedPauseHistory.length - 1]
    if (lastPause && !lastPause.resumed_at) {
      lastPause.resumed_at = now
    }

    updateTask(taskId, {
      status: "IN_PROGRESS",
      pause_history: updatedPauseHistory,
    })
    addAuditLog(taskId, {
      user_id: userId,
      action: "TASK_RESUMED",
      old_status: task.status,
      new_status: "IN_PROGRESS",
      details: "Task resumed",
    })
  }

  const completeTask = (taskId: string, userId: string, categorizedPhotos: CategorizedPhotos, remark: string) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task || !task.started_at) return

    const now = createDualTimestamp()
    const startTime = new Date(task.started_at.client).getTime()
    const endTime = new Date(now.client).getTime()

    let pausedDuration = 0
    task.pause_history.forEach((pause) => {
      if (pause.resumed_at) {
        const pauseStart = new Date(pause.paused_at.client).getTime()
        const pauseEnd = new Date(pause.resumed_at.client).getTime()
        pausedDuration += pauseEnd - pauseStart
      }
    })

    const actualDuration = Math.round((endTime - startTime - pausedDuration) / 60000)
    const totalPhotos = categorizedPhotos.room_photos.length + categorizedPhotos.proof_photos.length

    console.log("[v0] Completing task with categorized photos:", {
      taskId,
      status: "COMPLETED",
      actualDuration,
      roomPhotos: categorizedPhotos.room_photos.length,
      proofPhotos: categorizedPhotos.proof_photos.length,
      totalPhotos,
      hasRemark: !!remark,
    })

    updateTask(taskId, {
      status: "COMPLETED",
      completed_at: now,
      actual_duration_minutes: actualDuration,
      categorized_photos: categorizedPhotos,
      photo_urls: [...categorizedPhotos.room_photos, ...categorizedPhotos.proof_photos], // Legacy field
      worker_remark: remark,
    })
    addAuditLog(taskId, {
      user_id: userId,
      action: "TASK_COMPLETED",
      old_status: task.status,
      new_status: "COMPLETED",
      details: `Task completed in ${actualDuration} minutes with ${totalPhotos} photo(s) (${categorizedPhotos.room_photos.length} room, ${categorizedPhotos.proof_photos.length} proof)`,
    })

    console.log("[v0] Task completed and ready for verification:", taskId)
  }

  const getTaskById = (taskId: string) => {
    return tasks.find((t) => t.id === taskId)
  }

  const createTask = (taskData: Omit<Task, "id" | "audit_log" | "pause_history">) => {
    const customTaskName = taskData.custom_task_name ?? (taskData.is_custom_task ? taskData.task_type : null)
    const newTask: Task = {
      ...taskData,
      id: `t${Date.now()}`,
      department: taskData.department,
      custom_task_name: customTaskName,
      is_custom_task: taskData.is_custom_task ?? !!customTaskName,
      audit_log: [
        {
          timestamp: createDualTimestamp(),
          user_id: taskData.assigned_by_user_id,
          action: "TASK_ASSIGNED",
          old_status: null,
          new_status: "PENDING",
          details: "Task created and assigned",
        },
      ],
      pause_history: [],
    }

    if (taskData.priority_level === "GUEST_REQUEST") {
      const workerCurrentTask = tasks.find(
        (t) => t.assigned_to_user_id === taskData.assigned_to_user_id && t.status === "IN_PROGRESS",
      )
      if (workerCurrentTask) {
        pauseTask(workerCurrentTask.id, taskData.assigned_by_user_id, "Auto-paused for urgent guest request")
      }
    }

    if (
      newTask.is_custom_task ||
      newTask.custom_task_name ||
      taskData.task_type.includes("Other (Custom Task)") ||
      taskData.task_type.startsWith("[CUSTOM]")
    ) {
      const adminUsers = users.filter((u) => u.role === "admin")
      const notificationName = newTask.custom_task_name || taskData.task_type
      adminUsers.forEach((admin) => {
        createNotification(
          admin.id,
          "system",
          "Custom Task Created",
          `Front office created a custom task: "${notificationName}" at ${taskData.room_number || "N/A"}. Consider adding this as a permanent task type.`,
          newTask.id,
        )
      })
      console.log("[v0] Admin notified about custom task:", notificationName)
    }

    setTasks((prev) => [...prev, newTask])
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
        id: `t${Date.now()}`,
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

      setTasks((prev) => [...prev, newTask])

      console.log("[v0] Created new rework task from rejection:", newTask.id)

      // Notify supervisor about new task needing assignment
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

    updateTask(taskId, {
      assigned_to_user_id: newWorkerId,
      assigned_at: createDualTimestamp(),
      department: newWorker?.department || task.department,
    })

    addAuditLog(taskId, {
      user_id: userId,
      action: "TASK_REASSIGNED",
      old_status: task.status,
      new_status: task.status,
      details: `Task reassigned from worker ${oldWorkerId} to ${newWorkerId}. Reason: ${reason}`,
    })

    // Notify new worker
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

    setTasks((prev) => prev.filter((t) => t.id !== taskId))

    addAuditLog(taskId, {
      user_id: userId,
      action: "REJECTION_ACKNOWLEDGED",
      old_status: task.status,
      new_status: task.status,
      details: "Worker acknowledged rejection",
    })
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

  const addWorker = (workerData: Omit<User, "id" | "is_available">) => {
    const newWorker: User = {
      ...workerData,
      id: `u${Date.now()}`,
      is_available: true,
    }
    console.log("[v0] Adding new worker:", newWorker)
    setUsers((prev) => {
      const updated = [...prev, newWorker]
      console.log("[v0] Users after adding worker:", updated.length, "total users")
      return updated
    })
  }

  const raiseIssue = (taskId: string, userId: string, issueDescription: string) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return

    const newIssue: TaskIssue = {
      id: `issue${Date.now()}`,
      task_id: taskId,
      reported_by_user_id: userId,
      reported_at: createDualTimestamp(),
      issue_description: issueDescription,
      status: "OPEN",
    }

    setIssues((prev) => [...prev, newIssue])

    addAuditLog(taskId, {
      user_id: userId,
      action: "ISSUE_RAISED",
      old_status: task.status,
      new_status: task.status,
      details: `Worker raised issue: ${issueDescription}`,
    })

    // Notify supervisor
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

    // Notify front office
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
      id: `sched${Date.now()}`,
      created_at: createDualTimestamp(),
    }
    console.log("[v0] Adding new schedule:", newSchedule)
    setSchedules((prev) => [...prev, newSchedule])

    if (newSchedule.active) {
      console.log("[v0] Schedule is active, generating tasks")
      generateMaintenanceTasksFromSchedule(newSchedule)
    }

    console.log("[v0] Schedule added successfully")
  }

  const updateSchedule = (scheduleId: string, updates: Partial<MaintenanceSchedule>) => {
    console.log("[v0] Updating schedule:", scheduleId, updates)
    setSchedules((prev) => prev.map((s) => (s.id === scheduleId ? { ...s, ...updates } : s)))
  }

  const deleteSchedule = (scheduleId: string) => {
    console.log("[v0] Deleting schedule:", scheduleId)
    setSchedules((prev) => prev.filter((s) => s.id !== scheduleId))
    setMaintenanceTasks((prev) => prev.filter((t) => t.schedule_id !== scheduleId))
  }

  const toggleSchedule = (scheduleId: string) => {
    console.log("[v0] Toggling schedule:", scheduleId)
    setSchedules((prev) => {
      const updated = prev.map((s) => {
        if (s.id === scheduleId) {
          const newActive = !s.active
          const updatedSchedule = { ...s, active: newActive }

          if (newActive) {
            console.log("[v0] Schedule activated, generating tasks")
            generateMaintenanceTasksFromSchedule(updatedSchedule)
          }

          return updatedSchedule
        }
        return s
      })
      return updated
    })
  }

  const generateMaintenanceTasksFromSchedule = (schedule: MaintenanceSchedule) => {
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

    const newTasks: MaintenanceTask[] = []

    const taskTypesToGenerate: MaintenanceTaskType[] =
      schedule.task_type === "all" ? ["ac_indoor", "ac_outdoor", "fan", "exhaust"] : [schedule.task_type]

    console.log("[v0] Task types to generate:", taskTypesToGenerate)

    roomsToGenerate.forEach((room) => {
      // Get all maintenance items for this room (includes specific locations)
      const maintenanceItems = getMaintenanceItemsForRoom(room.number)

      // Filter items based on selected task types
      const filteredItems = maintenanceItems.filter((item) => taskTypesToGenerate.includes(item.type))

      filteredItems.forEach((item) => {
        const newTask: MaintenanceTask = {
          id: `mtask${Date.now()}-${room.number}-${item.type}-${item.location}-${Math.random().toString(36).substr(2, 9)}`,
          schedule_id: schedule.id,
          room_number: room.number,
          task_type: item.type,
          location: item.location, // Specific location like "Hall", "Bedroom 1", etc.
          description: `${item.name} maintenance for room ${room.number}`,
          status: "pending",
          photos: { room_photos: [], proof_photos: [] },
          period_month: currentMonth,
          period_year: currentYear,
          created_at: new Date().toISOString(),
          expected_duration_minutes: item.expectedDuration,
        }
        newTasks.push(newTask)
      })
    })

    console.log("[v0] Generated", newTasks.length, "maintenance tasks")
    setMaintenanceTasks((prev) => [...prev, ...newTasks])
  }

  const updateMaintenanceTask = (taskId: string, updates: Partial<MaintenanceTask>) => {
    console.log("[v0] Updating maintenance task:", taskId, updates)
    setMaintenanceTasks((prev) => {
      const updated = prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t))
      console.log(
        "[v0] Task updated. Total tasks:",
        updated.length,
        "Active tasks:",
        updated.filter((t) => t.status === "in_progress" || t.status === "paused").length,
      )
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
      }}
    >
      {children}
    </TaskContext.Provider>
  )
}

export function useTasks() {
  const context = useContext(TaskContext)
  if (context === undefined) {
    throw new Error("useTasks must be used within a TaskProvider")
  }
  return context
}
