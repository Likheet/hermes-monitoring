"use client"

import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo, type ReactNode } from "react"
import type { Task, CategorizedPhotos, Department } from "../types"
import { createDualTimestamp } from "../mock-data"
import { useRealtimeTasks, type TaskRealtimePayload } from "../use-realtime-tasks-optimized"
import { useAuth } from "../auth-context"
import {
  loadTasksFromSupabase,
  type LoadOptions,
} from "../supabase-task-operations"

const STORAGE_KEYS = {
  tasks: "hermes-cache-tasks-v1",
} as const

const MAX_CACHED_TASKS = 100
const LIST_CACHE_TTL_MS = 30_000
const REALTIME_REFRESH_DEBOUNCE_MS = 250
const REALTIME_REFRESH_COOLDOWN_MS = 4_000

type RefreshOptions = LoadOptions & { useGlobalLoader?: boolean }

interface CacheEntry<T> {
  data: T
  timestamp: number
}

function loadFromStorage<T>(key: string): T | null {
  if (typeof window === "undefined") return null
  const raw = window.localStorage.getItem(key)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as CacheEntry<T>
    // Check if cache is expired
    if (Date.now() - parsed.timestamp > LIST_CACHE_TTL_MS) {
      window.localStorage.removeItem(key)
      return null
    }
    return parsed.data
  } catch (error) {
    console.warn("[cache] Failed to parse cached data for key:", key, error)
    return null
  }
}

function persistToStorage(key: string, value: unknown) {
  if (typeof window === "undefined") return

  try {
    let payload = value
    if (key === STORAGE_KEYS.tasks && Array.isArray(value)) {
      payload = (value as Task[]).slice(0, MAX_CACHED_TASKS)
    }

    const cacheEntry: CacheEntry<unknown> = {
      data: payload,
      timestamp: Date.now(),
    }

    const serialized = JSON.stringify(cacheEntry)
    window.localStorage.setItem(key, serialized)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const isQuotaError =
      (error instanceof DOMException && error.name === "QuotaExceededError") ||
      /quotaexceedederror/i.test(message)

    if (isQuotaError) {
      console.warn(
        `[cache] Storage quota exceeded for key: ${key}. Skipping cache persistence.`
      )
      try {
        window.localStorage.removeItem(key)
      } catch {
        // ignore removal failure
      }
    } else {
      console.warn("[cache] Failed to persist data for key:", key, error)
    }
  }
}

function getCachedValue<T>(key: string): T | undefined {
  return loadFromStorage<T>(key) || undefined
}

// Task-specific interfaces
interface TaskContextType {
  // State
  tasks: Task[]
  isLoading: boolean
  error: string | null

  // Actions
  refreshTasks: (options?: RefreshOptions) => Promise<void>
  startTask: (taskId: string) => Promise<boolean>
  pauseTask: (taskId: string, reason?: string) => Promise<boolean>
  resumeTask: (taskId: string) => Promise<boolean>
  completeTask: (taskId: string, data: {
    rating?: number
    qualityComment?: string
    ratingProofPhotoUrl?: string
    categorizedPhotos?: CategorizedPhotos
  }) => Promise<boolean>
  createTask: (data: {
    taskName: string
    department: Department
    assignedToUserId: string
    assignedByUserId: string
    roomNumber?: string
    priority?: "GUEST_REQUEST" | "TIME_SENSITIVE" | "DAILY_TASK" | "PREVENTIVE_MAINTENANCE"
    photoRequired?: boolean
    photoCount?: number
    photoDocumentationRequired?: boolean
    photoCategories?: Array<{ name: string; count: number; description?: string }>
    isCustomTask?: boolean
    customTaskName?: string
    expectedDurationMinutes?: number
    dueAt?: string
    notes?: string
  }) => Promise<boolean>
  rejectTask: (taskId: string, data: {
    remark: string
    rejectionProofPhotoUrl?: string
    createReworkTask?: boolean
    reworkAssignToUserId?: string
    reworkTaskName?: string
    reworkNotes?: string
  }) => Promise<boolean>
  acknowledgeRejection: (taskId: string) => Promise<boolean>
  createTaskIssue: (taskId: string, description: string, photos: string[]) => Promise<boolean>
  updateTaskPhotos: (taskId: string, photos: CategorizedPhotos) => Promise<boolean>
  getTaskById: (taskId: string) => Task | undefined
}

const TaskContext = createContext<TaskContextType | null>(null)

export function useTasks() {
  const context = useContext(TaskContext)
  if (!context) {
    throw new Error("useTasks must be used within a TaskProvider")
  }
  return context
}

interface TaskProviderProps {
  children: ReactNode
}

export function TaskProvider({ children }: TaskProviderProps) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const lastTasksFetchRef = useRef<number>(0)

  const { user: currentUser } = useAuth()

  // Load cached tasks on mount
  useEffect(() => {
    const cached = getCachedValue<Task[]>(STORAGE_KEYS.tasks)
    if (cached) {
      setTasks(cached)
      setIsLoading(false)
    }
  }, [])

  // Real-time task updates
  useRealtimeTasks({
    enabled: !!currentUser,
    userRole: currentUser?.role ?? "worker",
    userDepartment: currentUser?.department ?? "housekeeping",
    userId: currentUser?.id,
    onTaskUpdate: handleRealtimeTaskUpdate,
  })

  function handleRealtimeTaskUpdate(payload: TaskRealtimePayload) {
    const now = Date.now()
    const timeSinceLastFetch = now - lastTasksFetchRef.current

    if (timeSinceLastFetch < REALTIME_REFRESH_COOLDOWN_MS) {
      // Still within cooldown, skip this update
      return
    }

    if (payload.eventType === "UPDATE" || payload.eventType === "INSERT") {
      // Debounce rapid updates
      const timeoutId = setTimeout(() => {
        void refreshTasks({ useGlobalLoader: false, forceRefresh: true })
      }, REALTIME_REFRESH_DEBOUNCE_MS)

      return () => clearTimeout(timeoutId)
    }
  }

  const refreshTasks = useCallback(async (options: RefreshOptions = {}) => {
    const { useGlobalLoader = true, forceRefresh = false, includePhotos } = options

    try {
      if (useGlobalLoader) {
        setIsLoading(true)
      }
      setError(null)

      const now = Date.now()
      if (!forceRefresh && now - lastTasksFetchRef.current < LIST_CACHE_TTL_MS) {
        // Use cached data if still fresh
        return
      }

      const loaderOptions: LoadOptions = {}

      if (includePhotos) {
        loaderOptions.includePhotos = true
      }
      if (forceRefresh) {
        loaderOptions.forceRefresh = true
      }

      const loadedTasks = await loadTasksFromSupabase(loaderOptions)
      setTasks(loadedTasks)
      lastTasksFetchRef.current = now
    } catch (error) {
      console.error("Failed to refresh tasks:", error)
      setError(error instanceof Error ? error.message : "Failed to load tasks")
    } finally {
      setIsLoading(false)
    }
  }, [])

  const startTask = useCallback(async (taskId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/tasks/${taskId}/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (response.ok) {
        // Update local state immediately for better UX
        setTasks((prev): Task[] =>
          prev.map((task): Task =>
            task.id === taskId
              ? {
                  ...task,
                  status: "IN_PROGRESS",
                  started_at: createDualTimestamp(),
                }
              : task
          ),
        )
        return true
      } else {
        console.error("Failed to start task:", await response.text())
        return false
      }
    } catch (error) {
      console.error("Error starting task:", error)
      return false
    }
  }, [])

  const pauseTask = useCallback(async (taskId: string, reason?: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/tasks/${taskId}/pause`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason }),
      })

      if (response.ok) {
        setTasks((prev): Task[] =>
          prev.map((task): Task =>
            task.id === taskId
              ? {
                  ...task,
                  status: "PAUSED",
                  pause_history: [
                    ...task.pause_history,
                    {
                      paused_at: createDualTimestamp(),
                      resumed_at: null,
                      reason: reason || "",
                    },
                  ],
                }
              : task
          )
        )
        return true
      } else {
        console.error("Failed to pause task:", await response.text())
        return false
      }
    } catch (error) {
      console.error("Error pausing task:", error)
      return false
    }
  }, [])

  const resumeTask = useCallback(async (taskId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/tasks/${taskId}/resume`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (response.ok) {
        setTasks((prev): Task[] =>
          prev.map((task): Task =>
            task.id === taskId
              ? {
                  ...task,
                  status: "IN_PROGRESS",
                  pause_history: task.pause_history.map((pause, index) =>
                    index === task.pause_history.length - 1
                      ? { ...pause, resumed_at: createDualTimestamp() }
                      : pause
                  ),
                }
              : task
          )
        )
        return true
      } else {
        console.error("Failed to resume task:", await response.text())
        return false
      }
    } catch (error) {
      console.error("Error resuming task:", error)
      return false
    }
  }, [])

  const completeTask = useCallback(async (
    taskId: string,
    data: {
      rating?: number
      qualityComment?: string
      ratingProofPhotoUrl?: string
      categorizedPhotos?: CategorizedPhotos
    }
  ): Promise<boolean> => {
    try {
      const response = await fetch(`/api/tasks/${taskId}/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      })

      if (response.ok) {
        setTasks((prev): Task[] =>
          prev.map((task): Task =>
            task.id === taskId
              ? {
                  ...task,
                  status: "COMPLETED",
                  completed_at: createDualTimestamp(),
                  actual_duration_minutes:
                    task.started_at && task.completed_at
                      ? Math.floor(
                          (new Date(task.completed_at.server).getTime() -
                            new Date(task.started_at.server).getTime()) /
                            60000
                        )
                      : null,
                  rating: data.rating ?? null,
                  quality_comment: data.qualityComment ?? null,
                  rating_proof_photo_url: data.ratingProofPhotoUrl ?? null,
                  categorized_photos: data.categorizedPhotos ?? null,
                }
              : task
          )
        )

        // Refresh tasks from server to get the latest state
        lastTasksFetchRef.current = 0
        await refreshTasks({ useGlobalLoader: false, forceRefresh: true })

        return true
      } else {
        console.error("Failed to complete task:", await response.text())
        return false
      }
    } catch (error) {
      console.error("Error completing task:", error)
      return false
    }
  }, [refreshTasks])

  const createTask = useCallback(async (data: {
    taskName: string
    department: Department
    assignedToUserId: string
    assignedByUserId: string
    roomNumber?: string
    priority?: "GUEST_REQUEST" | "TIME_SENSITIVE" | "DAILY_TASK" | "PREVENTIVE_MAINTENANCE"
    photoRequired?: boolean
    photoCount?: number
    photoDocumentationRequired?: boolean
    photoCategories?: Array<{ name: string; count: number; description?: string }>
    isCustomTask?: boolean
    customTaskName?: string
    expectedDurationMinutes?: number
    dueAt?: string
    notes?: string
  }): Promise<boolean> => {
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          taskName: data.taskName,
          department: data.department,
          assignedToUserId: data.assignedToUserId,
          assignedByUserId: data.assignedByUserId,
          roomNumber: data.roomNumber,
          priority: data.priority,
          photoRequired: data.photoRequired,
          photoCount: data.photoCount,
          photoDocumentationRequired: data.photoDocumentationRequired,
          photoCategories: data.photoCategories,
          isCustomTask: data.isCustomTask,
          customTaskName: data.customTaskName,
          expectedDurationMinutes: data.expectedDurationMinutes,
          dueAt: data.dueAt,
          notes: data.notes,
        }),
      })

      if (response.ok) {
        const { task } = await response.json()
  setTasks((prev): Task[] => [...prev, task])

        // Refresh tasks from server to get the latest state
        lastTasksFetchRef.current = 0
        await refreshTasks({ useGlobalLoader: false, forceRefresh: true })

        return true
      } else {
        console.error("Failed to create task:", await response.text())
        return false
      }
    } catch (error) {
      console.error("Error creating task:", error)
      return false
    }
  }, [refreshTasks])

  const rejectTask = useCallback(async (taskId: string, data: {
    remark: string
    rejectionProofPhotoUrl?: string
    createReworkTask?: boolean
    reworkAssignToUserId?: string
    reworkTaskName?: string
    reworkNotes?: string
  }): Promise<boolean> => {
    try {
      const response = await fetch(`/api/tasks/${taskId}/reject`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      })

      if (response.ok) {
        setTasks((prev): Task[] =>
          prev.map((task): Task =>
            task.id === taskId
              ? {
                  ...task,
                  status: "REJECTED",
                  completed_at: createDualTimestamp(),
                  supervisor_remark: data.remark,
                  rejection_proof_photo_url: data.rejectionProofPhotoUrl ?? null,
                  actual_duration_minutes:
                    task.started_at && task.completed_at
                      ? Math.floor(
                          (new Date(task.completed_at.server).getTime() -
                            new Date(task.started_at.server).getTime()) /
                            60000
                        )
                      : null,
                }
              : task
          )
        )

        // Refresh tasks from server to get the latest state
        lastTasksFetchRef.current = 0
        await refreshTasks({ useGlobalLoader: false, forceRefresh: true })

        return true
      } else {
        console.error("Failed to reject task:", await response.text())
        return false
      }
    } catch (error) {
      console.error("Error rejecting task:", error)
      return false
    }
  }, [refreshTasks])

  const acknowledgeRejection = useCallback(async (taskId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/tasks/${taskId}/acknowledge-rejection`, {
        method: "POST",
      })

      if (response.ok) {
        setTasks((prev): Task[] =>
          prev.map((task): Task =>
            task.id === taskId
              ? {
                  ...task,
                  rejection_acknowledged: true,
                  rejection_acknowledged_at: createDualTimestamp(),
                }
              : task
          )
        )
        return true
      } else {
        console.error("Failed to acknowledge rejection:", await response.text())
        return false
      }
    } catch (error) {
      console.error("Error acknowledging rejection:", error)
      return false
    }
  }, [])

  const createTaskIssue = useCallback(async (taskId: string, description: string, photos: string[]): Promise<boolean> => {
    try {
      const response = await fetch("/api/issues", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          taskId,
          description,
          photos,
        }),
      })

      return response.ok
    } catch (error) {
      console.error("Error creating task issue:", error)
      return false
    }
  }, [])

  const updateTaskPhotos = useCallback(async (taskId: string, photos: CategorizedPhotos): Promise<boolean> => {
    try {
      const response = await fetch(`/api/tasks/${taskId}/photos`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ photos }),
      })

      if (response.ok) {
        setTasks((prev): Task[] =>
          prev.map((task): Task =>
            task.id === taskId ? { ...task, categorized_photos: photos } : task
          )
        )
        return true
      } else {
        console.error("Failed to update task photos:", await response.text())
        return false
      }
    } catch (error) {
      console.error("Error updating task photos:", error)
      return false
    }
  }, [])

  const getTaskById = useCallback((taskId: string): Task | undefined => {
    return tasks.find((t) => t.id === taskId)
  }, [tasks])

  // Initialize tasks on mount
  useEffect(() => {
    void (async () => {
      try {
        await refreshTasks({ useGlobalLoader: false })
      } catch (error) {
        console.error("Failed to initialize tasks:", error)
      }
    })()
  }, [refreshTasks])

  // Sync tasks with localStorage when they change
  useEffect(() => {
    const limited = tasks.length > MAX_CACHED_TASKS ? tasks.slice(0, MAX_CACHED_TASKS) : tasks
    persistToStorage(STORAGE_KEYS.tasks, limited)
  }, [tasks])

  const value: TaskContextType = useMemo(() => ({
    tasks,
    isLoading,
    error,
    refreshTasks,
    startTask,
    pauseTask,
    resumeTask,
    completeTask,
    createTask,
    rejectTask,
    acknowledgeRejection,
    createTaskIssue,
    updateTaskPhotos,
    getTaskById,
  }), [tasks, isLoading, error, refreshTasks, startTask, pauseTask, resumeTask, completeTask, createTask, rejectTask, acknowledgeRejection, createTaskIssue, updateTaskPhotos, getTaskById])

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>
}