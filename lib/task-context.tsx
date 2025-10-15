"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import type { Task, AuditLogEntry, PauseRecord, User, TaskIssue } from "./types"
import { mockTasks, createDualTimestamp, mockUsers, mockIssues } from "./mock-data"
import { createClient } from "@/lib/supabase/client"
import { createNotification, playNotificationSound } from "./notification-utils"
import { triggerHapticFeedback } from "./haptics"

interface TaskContextType {
  tasks: Task[]
  users: User[]
  issues: TaskIssue[]
  updateTask: (taskId: string, updates: Partial<Task>) => void
  addAuditLog: (taskId: string, entry: Omit<AuditLogEntry, "timestamp">) => void
  startTask: (taskId: string, userId: string) => void
  pauseTask: (taskId: string, userId: string, reason: string) => void
  resumeTask: (taskId: string, userId: string) => void
  completeTask: (taskId: string, userId: string, photoUrl: string | null, remark: string) => void
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
  updateWorkerShift: (workerId: string, shiftStart: string, shiftEnd: string, userId: string) => void
  addWorker: (worker: Omit<User, "id" | "is_available">) => void
  raiseIssue: (taskId: string, userId: string, issueDescription: string) => void
}

const TaskContext = createContext<TaskContextType | undefined>(undefined)

export function TaskProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>(mockTasks)
  const [users, setUsers] = useState<User[]>(mockUsers)
  const [issues, setIssues] = useState<TaskIssue[]>(mockIssues)
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

  const completeTask = (taskId: string, userId: string, photoUrl: string | null, remark: string) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task || !task.started_at) return

    const now = createDualTimestamp()
    const startTime = new Date(task.started_at.client).getTime()
    const endTime = new Date(now.client).getTime()

    // Calculate actual duration excluding pause time
    let pausedDuration = 0
    task.pause_history.forEach((pause) => {
      if (pause.resumed_at) {
        const pauseStart = new Date(pause.paused_at.client).getTime()
        const pauseEnd = new Date(pause.resumed_at.client).getTime()
        pausedDuration += pauseEnd - pauseStart
      }
    })

    const actualDuration = Math.round((endTime - startTime - pausedDuration) / 60000)

    console.log("[v0] Completing task:", {
      taskId,
      status: "COMPLETED",
      actualDuration,
      hasPhoto: !!photoUrl,
      hasRemark: !!remark,
    })

    updateTask(taskId, {
      status: "COMPLETED",
      completed_at: now,
      actual_duration_minutes: actualDuration,
      photo_url: photoUrl,
      worker_remark: remark,
    })
    addAuditLog(taskId, {
      user_id: userId,
      action: "TASK_COMPLETED",
      old_status: task.status,
      new_status: "COMPLETED",
      details: `Task completed in ${actualDuration} minutes`,
    })

    console.log("[v0] Task completed and ready for verification:", taskId)
  }

  const getTaskById = (taskId: string) => {
    return tasks.find((t) => t.id === taskId)
  }

  const createTask = (taskData: Omit<Task, "id" | "audit_log" | "pause_history">) => {
    const newTask: Task = {
      ...taskData,
      id: `t${Date.now()}`,
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

      if (task.assigned_to_user_id) {
        createNotification(
          task.assigned_to_user_id,
          "task_rejected",
          "Task Rejected",
          `Your task "${task.task_type}" was rejected. Reason: ${supervisorRemark}`,
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

    updateTask(taskId, {
      assigned_to_user_id: newWorkerId,
      assigned_at: createDualTimestamp(),
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

  const updateWorkerShift = (workerId: string, shiftStart: string, shiftEnd: string, userId: string) => {
    console.log("[v0] Updating worker shift:", { workerId, shiftStart, shiftEnd, updatedBy: userId })
    setUsers((prev) => {
      const updated = prev.map((user) =>
        user.id === workerId
          ? {
              ...user,
              shift_start: shiftStart,
              shift_end: shiftEnd,
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

  return (
    <TaskContext.Provider
      value={{
        tasks,
        users,
        issues,
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
