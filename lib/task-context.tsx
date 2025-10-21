"use client"

import { createContext, useContext, useState, useEffect, useCallback, useTransition, useRef, type ReactNode } from "react"
import type { Task, AuditLogEntry, User, TaskIssue, CategorizedPhotos, Department, UserRole } from "./types"
import type { MaintenanceSchedule, MaintenanceTask, MaintenanceTaskType, ShiftSchedule } from "./maintenance-types"
import { createDualTimestamp, mockUsers } from "./mock-data"
import { createNotification, playNotificationSound } from "./notification-utils"
import { triggerHapticFeedback } from "./haptics"
import { ALL_ROOMS, getMaintenanceItemsForRoom } from "./location-data"
import { useRealtimeTasks, type TaskRealtimePayload } from "./use-realtime-tasks"
import type { hashPassword } from "./auth-utils"
import { databaseTaskToApp, type DatabaseTask } from "./database-types"
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

const STORAGE_KEYS = {
  tasks: "hermes-cache-tasks-v1",
  users: "hermes-cache-users-v1",
  shiftSchedules: "hermes-cache-shifts-v1",
} as const

const MAX_CACHED_TASKS = 100
const LIST_CACHE_TTL_MS = 180_000
const storageWarningFlags: Record<string, boolean> = {}
const STORAGE_WRITE_DEBOUNCE_MS = 150
const storageWriteTimers: Partial<Record<string, ReturnType<typeof setTimeout>>> = {}
const storageSnapshots: Record<string, string> = {}
const storageObjectCache = new WeakMap<object, string>()
const REALTIME_REFRESH_DEBOUNCE_MS = 250
const REALTIME_REFRESH_COOLDOWN_MS = 4_000
const storageDisabledKeys = new Set<string>()

function loadFromStorage<T>(key: string): T | null {
  if (typeof window === "undefined") return null
  const raw = window.localStorage.getItem(key)
  if (!raw) return null

  storageSnapshots[key] = raw

  try {
    return JSON.parse(raw) as T
  } catch (error) {
    console.warn("[cache] Failed to parse cached data for key:", key, error)
    return null
  }
}

function persistToStorage(key: string, value: unknown) {
  if (typeof window === "undefined") return
  if (storageDisabledKeys.has(key)) return

  try {
    let payload = value
    if (key === STORAGE_KEYS.tasks && Array.isArray(value)) {
      payload = (value as Task[]).slice(0, MAX_CACHED_TASKS)
    }
    let serialized: string

    if (payload && typeof payload === "object") {
      const cached = storageObjectCache.get(payload as object)
      if (cached) {
        serialized = cached
      } else {
        serialized = JSON.stringify(payload)
        storageObjectCache.set(payload as object, serialized)
      }
    } else {
      serialized = JSON.stringify(payload)
    }

    if (storageSnapshots[key] === serialized) {
      return
    }

    const pendingTimer = storageWriteTimers[key]
    if (pendingTimer) {
      clearTimeout(pendingTimer)
    }

    storageWriteTimers[key] = setTimeout(() => {
      try {
        window.localStorage.setItem(key, serialized)
        storageSnapshots[key] = serialized
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        const isQuotaError =
          (error instanceof DOMException && error.name === "QuotaExceededError") ||
          /quotaexceedederror/i.test(message)

        if (isQuotaError) {
          storageDisabledKeys.add(key)
          try {
            window.localStorage.removeItem(key)
            storageSnapshots[key] = ""
          } catch {
            // ignore secondary failure
          }
        }

        if (!storageWarningFlags[key]) {
          storageWarningFlags[key] = true
          if (isQuotaError) {
            console.warn(
              `[cache] Disabled persistence for key due to storage quota limits: ${key}. Continuing without offline cache.`,
            )
          } else {
            console.warn("[cache] Failed to persist data for key:", key, error)
          }
        }
      } finally {
        delete storageWriteTimers[key]
      }
    }, STORAGE_WRITE_DEBOUNCE_MS)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if ((error instanceof DOMException && error.name === "QuotaExceededError") || /quotaexceedederror/i.test(message)) {
      storageDisabledKeys.add(key)
      if (!storageWarningFlags[key]) {
        storageWarningFlags[key] = true
        console.warn(`[cache] Disabled persistence for key due to storage quota limits: ${key}. Continuing without offline cache.`)
      }
      return
    }

    if (!storageWarningFlags[key]) {
      storageWarningFlags[key] = true
      console.warn("[cache] Failed to persist data for key:", key, error)
    }
  }
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
  usersLoaded: boolean
  usersLoadError: boolean
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

type RefreshOptions = LoadOptions & { useGlobalLoader?: boolean }

interface TaskProviderProps {
  children: ReactNode
  initialTasks?: Task[]
  initialUsers?: User[]
  initialShiftSchedules?: ShiftSchedule[]
  bootstrapMeta?: {
    tasksFetchedAt?: number
    usersFetchedAt?: number
    shiftSchedulesFetchedAt?: number
  }
}

const TaskContext = createContext<TaskContextType | undefined>(undefined)

export function TaskProvider({
  children,
  initialTasks,
  initialUsers,
  initialShiftSchedules,
  bootstrapMeta,
}: TaskProviderProps) {
  const sanitizedInitialTasks = initialTasks ? initialTasks.slice(0, MAX_CACHED_TASKS) : undefined
  const sanitizedInitialUsers = initialUsers && initialUsers.length > 0 ? initialUsers : undefined
  const sanitizedInitialShiftSchedules =
    initialShiftSchedules && initialShiftSchedules.length > 0 ? initialShiftSchedules : undefined

  const [tasks, setTasks] = useState<Task[]>(() => sanitizedInitialTasks ?? [])
  const [users, setUsers] = useState<User[]>(() => sanitizedInitialUsers ?? [])
  const [issues, setIssues] = useState<TaskIssue[]>([])
  const [schedules, setSchedules] = useState<MaintenanceSchedule[]>([])
  const [maintenanceTasks, setMaintenanceTasks] = useState<MaintenanceTask[]>([])
  const [shiftSchedules, setShiftSchedules] = useState<ShiftSchedule[]>(() => sanitizedInitialShiftSchedules ?? [])
  const [usersLoaded, setUsersLoaded] = useState(Boolean(sanitizedInitialUsers))
  const [usersLoadError, setUsersLoadError] = useState(false)
  const hasInitialPayload =
    (sanitizedInitialTasks?.length ?? 0) > 0 ||
    (sanitizedInitialUsers?.length ?? 0) > 0 ||
    (sanitizedInitialShiftSchedules?.length ?? 0) > 0
  const [isLoading, setIsLoading] = useState(!hasInitialPayload)
  const [activeRequests, setActiveRequests] = useState(0)
  const [, startRealtimeTransition] = useTransition()
  const lastTasksFetchRef = useRef(bootstrapMeta?.tasksFetchedAt ?? 0)
  const lastUsersFetchRef = useRef(
    sanitizedInitialUsers ? bootstrapMeta?.usersFetchedAt ?? Date.now() : 0,
  )
  const lastShiftFetchRef = useRef(
    sanitizedInitialShiftSchedules ? bootstrapMeta?.shiftSchedulesFetchedAt ?? Date.now() : 0,
  )
  const lastForcedRefreshRef = useRef(bootstrapMeta?.tasksFetchedAt ?? 0)
  const forcedRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastRealtimeVersionRef = useRef(
    new Map<string, string | null>(
      (sanitizedInitialTasks ?? []).map((task) => [
        task.id,
        typeof task.server_updated_at === "string" ? task.server_updated_at : null,
      ]),
    ),
  )

  useEffect(() => {
    const cachedTasks = loadFromStorage<Task[]>(STORAGE_KEYS.tasks)
    if (cachedTasks && cachedTasks.length > 0) {
      const limitedTasks = cachedTasks.slice(0, MAX_CACHED_TASKS)
      setTasks(limitedTasks)
      lastTasksFetchRef.current = Date.now()

      const cachedVersions = new Map<string, string | null>()
      for (const task of limitedTasks) {
        cachedVersions.set(task.id, typeof task.server_updated_at === "string" ? task.server_updated_at : null)
      }
      lastRealtimeVersionRef.current = cachedVersions
    }

    const cachedUsers = loadFromStorage<User[]>(STORAGE_KEYS.users)
    if (cachedUsers && cachedUsers.length > 0) {
      setUsers(cachedUsers)
      setUsersLoaded(true)
      setUsersLoadError(false)
    }

    const cachedShiftSchedules = loadFromStorage<ShiftSchedule[]>(STORAGE_KEYS.shiftSchedules)
    if (cachedShiftSchedules && cachedShiftSchedules.length > 0) {
      setShiftSchedules(cachedShiftSchedules)
    }
  }, [])

  useEffect(() => {
    if (initialTasks && initialTasks.length > 0) {
      const limitedTasks = initialTasks.length > MAX_CACHED_TASKS ? initialTasks.slice(0, MAX_CACHED_TASKS) : initialTasks
      persistToStorage(STORAGE_KEYS.tasks, limitedTasks)
    }
  }, [initialTasks])

  useEffect(() => {
    if (initialUsers && initialUsers.length > 0) {
      persistToStorage(STORAGE_KEYS.users, initialUsers)
    }
  }, [initialUsers])

  useEffect(() => {
    if (initialShiftSchedules && initialShiftSchedules.length > 0) {
      persistToStorage(STORAGE_KEYS.shiftSchedules, initialShiftSchedules)
    }
  }, [initialShiftSchedules])

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

  const refreshTasks = useCallback(
    (options?: RefreshOptions) => {
      const { useGlobalLoader = true, ...loadOptions } = options ?? {}
      const now = Date.now()
      const shouldSkip =
        !loadOptions.forceRefresh &&
        lastTasksFetchRef.current !== 0 &&
        now - lastTasksFetchRef.current < LIST_CACHE_TTL_MS

      if (shouldSkip) {
        return Promise.resolve()
      }

      const execute = async () => {
        try {
          const data = await loadTasksFromSupabase(loadOptions)
          const limited = data.length > MAX_CACHED_TASKS ? data.slice(0, MAX_CACHED_TASKS) : data
          setTasks(limited)
          persistToStorage(STORAGE_KEYS.tasks, limited)
          lastTasksFetchRef.current = Date.now()

          const nextVersions = new Map<string, string | null>()
          for (const task of limited) {
            if (typeof task.server_updated_at === "string") {
              nextVersions.set(task.id, task.server_updated_at)
            }
          }
          lastRealtimeVersionRef.current = nextVersions
        } catch (error) {
          console.error("Error loading tasks from Supabase:", error)
        }
      }

      return useGlobalLoader ? runWithGlobalLoading(execute) : execute()
    },
    [runWithGlobalLoading],
  )

  const refreshUsers = useCallback(
    (options?: RefreshOptions) => {
      const { useGlobalLoader = true, ...loadOptions } = options ?? {}
      const now = Date.now()
      const shouldSkip =
        !loadOptions.forceRefresh &&
        usersLoaded &&
        !usersLoadError &&
        lastUsersFetchRef.current !== 0 &&
        now - lastUsersFetchRef.current < LIST_CACHE_TTL_MS

      if (shouldSkip) {
        return Promise.resolve()
      }

      setUsersLoadError(false)

      const execute = async () => {
        try {
          const data = await loadUsersFromSupabase(loadOptions)
          setUsers(data)
          setUsersLoaded(true)
          setUsersLoadError(false)
          persistToStorage(STORAGE_KEYS.users, data)
          lastUsersFetchRef.current = Date.now()
        } catch (error) {
          console.error("Error loading users from Supabase:", error)
          setUsersLoaded(true)
          setUsersLoadError(true)
        }
      }

      return useGlobalLoader ? runWithGlobalLoading(execute) : execute()
    },
    [runWithGlobalLoading, usersLoaded, usersLoadError],
  )

  const refreshShiftSchedules = useCallback(
    (options?: RefreshOptions) => {
      const { useGlobalLoader = true, ...loadOptions } = options ?? {}
      const now = Date.now()
      const shouldSkip =
        !loadOptions.forceRefresh && lastShiftFetchRef.current !== 0 && now - lastShiftFetchRef.current < LIST_CACHE_TTL_MS

      if (shouldSkip) {
        return Promise.resolve()
      }

      const execute = async () => {
        try {
          const data = await loadShiftSchedulesFromSupabase(loadOptions)
          setShiftSchedules(data)
          persistToStorage(STORAGE_KEYS.shiftSchedules, data)
          lastShiftFetchRef.current = Date.now()
        } catch (error) {
          console.error("Error loading shift schedules from Supabase:", error)
          setShiftSchedules([])
        }
      }

      return useGlobalLoader ? runWithGlobalLoading(execute) : execute()
    },
    [runWithGlobalLoading],
  )

  const refreshDashboardSnapshot = useCallback(
    (options?: { useGlobalLoader?: boolean; forceRefresh?: boolean }) => {
      const { useGlobalLoader = true, forceRefresh = false } = options ?? {}
      const now = Date.now()

      const tasksFresh =
        !forceRefresh && lastTasksFetchRef.current !== 0 && now - lastTasksFetchRef.current < LIST_CACHE_TTL_MS
      const usersFresh =
        !forceRefresh && lastUsersFetchRef.current !== 0 && now - lastUsersFetchRef.current < LIST_CACHE_TTL_MS
      const shiftsFresh =
        !forceRefresh && lastShiftFetchRef.current !== 0 && now - lastShiftFetchRef.current < LIST_CACHE_TTL_MS

      if (tasksFresh && usersFresh && shiftsFresh) {
        return Promise.resolve()
      }

      const execute = async () => {
        try {
          const response = await fetch("/api/dashboard/summary", {
            method: "GET",
            cache: "no-store",
          })

          if (!response.ok) {
            throw new Error(`Failed to load dashboard snapshot: ${response.status}`)
          }

          const payload: {
            tasks: Task[]
            users: User[]
            shiftSchedules: ShiftSchedule[]
          } = await response.json()

          const limitedTasks =
            payload.tasks.length > MAX_CACHED_TASKS ? payload.tasks.slice(0, MAX_CACHED_TASKS) : payload.tasks

          setTasks(limitedTasks)
          persistToStorage(STORAGE_KEYS.tasks, limitedTasks)

          setUsers(payload.users)
          setUsersLoaded(true)
          setUsersLoadError(false)
          persistToStorage(STORAGE_KEYS.users, payload.users)

          setShiftSchedules(payload.shiftSchedules)
          persistToStorage(STORAGE_KEYS.shiftSchedules, payload.shiftSchedules)

          const timestamp = Date.now()
          lastTasksFetchRef.current = timestamp
          lastUsersFetchRef.current = timestamp
          lastShiftFetchRef.current = timestamp

          const nextVersions = new Map<string, string | null>()
          for (const task of limitedTasks) {
            if (typeof task.server_updated_at === "string") {
              nextVersions.set(task.id, task.server_updated_at)
            }
          }
          lastRealtimeVersionRef.current = nextVersions
        } catch (error) {
          console.error("Dashboard snapshot fetch failed, falling back to individual refresh", error)
          await Promise.all([
            refreshTasks({ useGlobalLoader: false, forceRefresh: true }),
            refreshUsers({ useGlobalLoader: false, forceRefresh: true }),
            refreshShiftSchedules({ useGlobalLoader: false, forceRefresh: true }),
          ])
        }
      }

      return useGlobalLoader ? runWithGlobalLoading(execute) : execute()
    },
    [refreshShiftSchedules, refreshTasks, refreshUsers, runWithGlobalLoading],
  )

  const queueForcedRefresh = useCallback(() => {
    const execute = () => {
      forcedRefreshTimerRef.current = null
      lastForcedRefreshRef.current = Date.now()
      void refreshTasks({ forceRefresh: true })
    }

    const now = Date.now()

    if (now - lastForcedRefreshRef.current >= REALTIME_REFRESH_COOLDOWN_MS) {
      execute()
      return
    }

    if (forcedRefreshTimerRef.current) {
      return
    }

    forcedRefreshTimerRef.current = setTimeout(execute, REALTIME_REFRESH_DEBOUNCE_MS)
  }, [refreshTasks])

  const handleRealtimeTaskUpdate = useCallback(
    (payload: TaskRealtimePayload) => {
      if (!payload || payload.table !== "tasks") {
        return
      }

      const applyUpdate = (updater: (prev: Task[]) => Task[]) => {
        startRealtimeTransition(() => {
          setTasks((prev) => {
            const next = updater(prev)
            if (next === prev) {
              return prev
            }

            const limited = next.length > MAX_CACHED_TASKS ? next.slice(0, MAX_CACHED_TASKS) : next
            persistToStorage(STORAGE_KEYS.tasks, limited)
            return limited
          })
        })
      }

      const { eventType, new: newRow, old: oldRow } = payload

      try {
        if (eventType === "INSERT" || eventType === "UPDATE") {
          if (!newRow || typeof newRow !== "object") {
            queueForcedRefresh()
            return
          }

          const taskId =
            typeof (newRow as { id?: unknown }).id === "string" ? ((newRow as { id: string }).id) : null

          if (!taskId) {
            queueForcedRefresh()
            return
          }

          const updatedAt =
            typeof (newRow as { updated_at?: unknown }).updated_at === "string"
              ? ((newRow as { updated_at: string }).updated_at)
              : null

          if (updatedAt) {
            const previous = lastRealtimeVersionRef.current.get(taskId)
            if (previous === updatedAt) {
              return
            }
            lastRealtimeVersionRef.current.set(taskId, updatedAt)
          } else {
            lastRealtimeVersionRef.current.set(taskId, null)
          }

          const appTask = databaseTaskToApp(newRow as unknown as DatabaseTask)

          applyUpdate((prev) => {
            const existingIndex = prev.findIndex((task) => task.id === appTask.id)
            if (existingIndex === -1) {
              return [appTask, ...prev]
            }

            const existingTask = prev[existingIndex]
            if (
              existingTask.server_updated_at &&
              updatedAt &&
              existingTask.server_updated_at === updatedAt
            ) {
              return prev
            }

            const next = [...prev]
            next[existingIndex] = appTask
            return next
          })
        } else if (eventType === "DELETE") {
          const deletedId =
            oldRow && typeof oldRow === "object" && "id" in oldRow ? ((oldRow as { id?: string }).id ?? null) : null

          if (!deletedId) {
            return
          }

          lastRealtimeVersionRef.current.delete(deletedId)

          applyUpdate((prev) => {
            const next = prev.filter((task) => task.id !== deletedId)
            return next.length === prev.length ? prev : next
          })
        }
      } catch (error) {
        console.warn("Failed to apply realtime task update, falling back to scheduled refresh", error)
        queueForcedRefresh()
      }
    },
    [queueForcedRefresh, startRealtimeTransition],
  )

  const { isConnected } = useRealtimeTasks({
    enabled: true,
    onTaskUpdate: handleRealtimeTaskUpdate,
  })

  useEffect(() => {
    console.log("[v0] Realtime connection status:", isConnected ? "CONNECTED" : "DISCONNECTED")
  }, [isConnected])

  useEffect(() => {
    setIsLoading(false)

    void (async () => {
      try {
        await refreshDashboardSnapshot({ useGlobalLoader: false })
      } catch (error) {
        console.error("Error loading data:", error)
        setUsers((prev) => (prev.length > 0 ? prev : mockUsers))
        setUsersLoaded(true)
        setUsersLoadError(true)
      }
    })()
  }, [refreshDashboardSnapshot])

  useEffect(() => {
    return () => {
      if (forcedRefreshTimerRef.current) {
        clearTimeout(forcedRefreshTimerRef.current)
      }
    }
  }, [])

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
          const payload = (await response.json()) as { task?: Task }
          if (payload?.task) {
            setTasks((prev) => {
              const next = prev.map((t) => (t.id === payload.task!.id ? payload.task! : t))
              const limited = next.length > MAX_CACHED_TASKS ? next.slice(0, MAX_CACHED_TASKS) : next
              persistToStorage(STORAGE_KEYS.tasks, limited)
              lastTasksFetchRef.current = Date.now()
              const versions = new Map(lastRealtimeVersionRef.current)
              versions.set(payload.task!.id, payload.task!.server_updated_at ?? null)
              lastRealtimeVersionRef.current = versions
              return limited
            })
          }
          await refreshTasks({ useGlobalLoader: false, forceRefresh: true })
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
          const payload = (await response.json()) as { task?: Task }
          if (payload?.task) {
            setTasks((prev) => {
              const next = prev.map((task) => (task.id === payload.task!.id ? payload.task! : task))
              const limited = next.length > MAX_CACHED_TASKS ? next.slice(0, MAX_CACHED_TASKS) : next
              persistToStorage(STORAGE_KEYS.tasks, limited)

              const versions = new Map(lastRealtimeVersionRef.current)
              versions.set(payload.task!.id, payload.task!.server_updated_at ?? null)
              lastRealtimeVersionRef.current = versions

              return limited
            })
            lastTasksFetchRef.current = Date.now()
          }
          await refreshTasks({ useGlobalLoader: false, forceRefresh: true })
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
    const nextDepartment =
      newWorker?.department ||
      task.department ||
      (oldWorkerId ? users.find((u) => u.id === oldWorkerId)?.department ?? null : null) ||
      user?.department ||
      null

    const nextTaskShape = {
      ...task,
      assigned_to_user_id: newWorkerId,
      assigned_by_user_id: userId,
      assigned_at: reassignedAt,
      department: nextDepartment ?? task.department,
    }

    setTasks((prev) => {
      const updated = prev.map((t) => (t.id === taskId ? nextTaskShape : t))
      persistToStorage(STORAGE_KEYS.tasks, updated)
      return updated
    })

    addAuditLog(taskId, {
      user_id: userId,
      action: "TASK_REASSIGNED",
      old_status: task.status,
      new_status: task.status,
      details: `Task reassigned from worker ${oldWorkerId ?? "N/A"} to ${newWorkerId}. Reason: ${reason}`,
    })

    createNotification(
      newWorkerId,
      "task_assigned",
      "New Task Assigned",
      `You have been assigned: ${task.task_type} at ${task.room_number ?? "N/A"}`,
      taskId,
    )

    if (oldWorkerId && oldWorkerId !== newWorkerId) {
      createNotification(
        oldWorkerId,
        "task_reassigned",
        "Task Reassigned",
        `Task ${task.task_type} at ${task.room_number ?? "N/A"} has been reassigned.`,
        taskId,
      )
    }

    runWithGlobalLoading(async () => {
      await updateTask(taskId, nextTaskShape)
    }).catch((error) => {
      console.error("[v0] Error reassigning task in Supabase:", error)
    })
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
    setUsers((prev) => {
      const updatedUsers = prev.map((user) =>
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
      persistToStorage(STORAGE_KEYS.users, updatedUsers)
      return updatedUsers
    })
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

          const saved = await saveUserToSupabase(newUser, { username, passwordHash: password })
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
    if (typeof updatedTask.timer_duration === "number" && updatedTask.timer_duration < 0) {
      updatedTask.timer_duration = 0
    }

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
        usersLoaded,
        usersLoadError,
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


