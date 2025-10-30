"use client"

import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from "react"
import type { ShiftSchedule } from "../types"
import type { MaintenanceSchedule, MaintenanceTask } from "../maintenance-types"
import {
  loadShiftSchedulesFromSupabase,
  saveMaintenanceScheduleToSupabase,
  deleteMaintenanceScheduleFromSupabase,
  saveShiftScheduleToSupabase,
  deleteShiftScheduleFromSupabase,
  type LoadOptions,
} from "../supabase-task-operations"

const STORAGE_KEYS = {
  shiftSchedules: "hermes-cache-shifts-v1",
} as const

const LIST_CACHE_TTL_MS = 30_000

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
    const cacheEntry: CacheEntry<unknown> = {
      data: value,
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

// Schedules-specific interfaces
type RefreshOptions = LoadOptions & { useGlobalLoader?: boolean }

interface SchedulesContextType {
  // State
  shiftSchedules: ShiftSchedule[]
  maintenanceSchedules: MaintenanceSchedule[]
  maintenanceTasks: MaintenanceTask[]
  isLoading: boolean
  error: string | null

  // Actions
  refreshShiftSchedules: (options?: RefreshOptions) => Promise<void>
  addShiftSchedule: (scheduleData: Omit<ShiftSchedule, "id" | "created_at">) => Promise<boolean>
  updateShiftSchedule: (scheduleId: string, updates: Partial<ShiftSchedule>) => Promise<boolean>
  deleteShiftSchedule: (scheduleId: string) => Promise<boolean>

  // Maintenance schedule actions
  addMaintenanceSchedule: (scheduleData: {
    taskType: string
    area: string
    frequency: string
    intervalDays: number
    isActive: boolean
    nextDueDate?: string
    rooms?: string[]
    timeSlot?: string
    notes?: string
  }) => Promise<boolean>
  updateMaintenanceSchedule: (scheduleId: string, updates: Partial<MaintenanceSchedule>) => Promise<boolean>
  deleteMaintenanceSchedule: (scheduleId: string) => Promise<boolean>
  toggleMaintenanceSchedule: (scheduleId: string) => Promise<boolean>
}

const SchedulesContext = createContext<SchedulesContextType | null>(null)

export function useSchedules() {
  const context = useContext(SchedulesContext)
  if (!context) {
    throw new Error("useSchedules must be used within a SchedulesProvider")
  }
  return context
}

interface SchedulesProviderProps {
  children: ReactNode
}

export function SchedulesProvider({ children }: SchedulesProviderProps) {
  const [shiftSchedules, setShiftSchedules] = useState<ShiftSchedule[]>([])
  const [maintenanceSchedules, setMaintenanceSchedules] = useState<MaintenanceSchedule[]>([])
  const [maintenanceTasks] = useState<MaintenanceTask[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load cached schedules on mount
  useEffect(() => {
    const cached = loadFromStorage<ShiftSchedule[]>(STORAGE_KEYS.shiftSchedules)
    if (cached) {
      setShiftSchedules(cached)
      setIsLoading(false)
    }
  }, [])

  const refreshShiftSchedules = useCallback(async (options: RefreshOptions = {}) => {
    const { useGlobalLoader = true, forceRefresh = false } = options

    try {
      if (useGlobalLoader) {
        setIsLoading(true)
      }
      setError(null)

      const loaderOptions: LoadOptions = {}
      if (forceRefresh) {
        loaderOptions.forceRefresh = true
      }

      const loadedSchedules = await loadShiftSchedulesFromSupabase(loaderOptions)
      setShiftSchedules(loadedSchedules)
    } catch (error) {
      console.error("Failed to refresh shift schedules:", error)
      setError(error instanceof Error ? error.message : "Failed to load shift schedules")
    } finally {
      setIsLoading(false)
    }
  }, [])

  const addShiftSchedule = useCallback(async (scheduleData: Omit<ShiftSchedule, "id" | "created_at">): Promise<boolean> => {
    try {
  // @ts-expect-error -- legacy admin flow sends partial schedule fields
  const success = await saveShiftScheduleToSupabase(scheduleData)
      if (success) {
        // Refresh schedules from server to get the latest state
        await refreshShiftSchedules({ useGlobalLoader: false })
      }
      return success
    } catch (error) {
      console.error("Error adding shift schedule:", error)
      return false
    }
  }, [refreshShiftSchedules])

  const updateShiftSchedule = useCallback(async (scheduleId: string, updates: Partial<ShiftSchedule>): Promise<boolean> => {
    try {
  // @ts-expect-error -- legacy admin flow patches subset of schedule fields
  const success = await saveShiftScheduleToSupabase({ ...updates, id: scheduleId })
      if (success) {
        // Update local state immediately for better UX
        setShiftSchedules((prev) =>
          prev.map((schedule) =>
            schedule.id === scheduleId ? { ...schedule, ...updates } : schedule
          )
        )

        // Refresh schedules from server to get the latest state
        await refreshShiftSchedules({ useGlobalLoader: false })
      }
      return success
    } catch (error) {
      console.error("Error updating shift schedule:", error)
      return false
    }
  }, [refreshShiftSchedules])

  const deleteShiftSchedule = useCallback(async (scheduleId: string): Promise<boolean> => {
    try {
      const success = await deleteShiftScheduleFromSupabase(scheduleId)
      if (success) {
        // Update local state immediately for better UX
        setShiftSchedules((prev) => prev.filter((schedule) => schedule.id !== scheduleId))

        // Refresh schedules from server to get the latest state
        await refreshShiftSchedules({ useGlobalLoader: false })
      }
      return success
    } catch (error) {
      console.error("Error deleting shift schedule:", error)
      return false
    }
  }, [refreshShiftSchedules])

  const addMaintenanceSchedule = useCallback(async (scheduleData: {
    taskType: string
    area: string
    frequency: string
    intervalDays: number
    isActive: boolean
    nextDueDate?: string
    rooms?: string[]
    timeSlot?: string
    notes?: string
  }): Promise<boolean> => {
    try {
  // @ts-expect-error -- legacy admin flow sends partial maintenance schedule payload
  const success = await saveMaintenanceScheduleToSupabase(scheduleData)
      if (success) {
        // This would typically refresh maintenance schedules, but since we don't have that function
        // in this context, we'll just return success
        return true
      }
      return false
    } catch (error) {
      console.error("Error adding maintenance schedule:", error)
      return false
    }
  }, [])

  const updateMaintenanceSchedule = useCallback(async (scheduleId: string, updates: Partial<MaintenanceSchedule>): Promise<boolean> => {
    try {
  // @ts-expect-error -- legacy admin flow patches subset of maintenance schedule fields
  const success = await saveMaintenanceScheduleToSupabase({ ...updates, id: scheduleId })
      if (success) {
        // Update local state immediately for better UX
        setMaintenanceSchedules((prev) =>
          prev.map((schedule) =>
            schedule.id === scheduleId ? { ...schedule, ...updates } : schedule
          )
        )
      }
      return success
    } catch (error) {
      console.error("Error updating maintenance schedule:", error)
      return false
    }
  }, [])

  const deleteMaintenanceSchedule = useCallback(async (scheduleId: string): Promise<boolean> => {
    try {
      const success = await deleteMaintenanceScheduleFromSupabase(scheduleId)
      if (success) {
        // Update local state immediately for better UX
        setMaintenanceSchedules((prev) => prev.filter((schedule) => schedule.id !== scheduleId))
      }
      return success
    } catch (error) {
      console.error("Error deleting maintenance schedule:", error)
      return false
    }
  }, [])

  const toggleMaintenanceSchedule = useCallback(async (scheduleId: string): Promise<boolean> => {
    try {
      const schedule = maintenanceSchedules.find((s) => s.id === scheduleId)
      if (!schedule) return false

  const updates = { active: !schedule.active }
  // @ts-expect-error -- legacy admin flow toggles subset of fields
  const success = await saveMaintenanceScheduleToSupabase({ ...updates, id: scheduleId })

      if (success) {
        // Update local state immediately for better UX
        setMaintenanceSchedules((prev) =>
          prev.map((s) => (s.id === scheduleId ? { ...s, ...updates } : s))
        )
      }
      return success
    } catch (error) {
      console.error("Error toggling maintenance schedule:", error)
      return false
    }
  }, [maintenanceSchedules])

  // Initialize schedules on mount
  useEffect(() => {
    void (async () => {
      try {
        await refreshShiftSchedules({ useGlobalLoader: false })
      } catch (error) {
        console.error("Failed to initialize schedules:", error)
      }
    })()
  }, [refreshShiftSchedules])

  // Sync schedules with localStorage when they change
  useEffect(() => {
    persistToStorage(STORAGE_KEYS.shiftSchedules, shiftSchedules)
  }, [shiftSchedules])

  const value: SchedulesContextType = useMemo(() => ({
    shiftSchedules,
    maintenanceSchedules,
    maintenanceTasks,
    isLoading,
    error,
    refreshShiftSchedules,
    addShiftSchedule,
    updateShiftSchedule,
    deleteShiftSchedule,
    addMaintenanceSchedule,
    updateMaintenanceSchedule,
    deleteMaintenanceSchedule,
    toggleMaintenanceSchedule,
  }), [shiftSchedules, maintenanceSchedules, maintenanceTasks, isLoading, error, refreshShiftSchedules, addShiftSchedule, updateShiftSchedule, deleteShiftSchedule, addMaintenanceSchedule, updateMaintenanceSchedule, deleteMaintenanceSchedule, toggleMaintenanceSchedule])

  return <SchedulesContext.Provider value={value}>{children}</SchedulesContext.Provider>
}