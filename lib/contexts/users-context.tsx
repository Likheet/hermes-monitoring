"use client"

import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from "react"
import type { User, UserRole } from "../types"
import { loadUsersFromSupabase, type LoadOptions } from "../supabase-task-operations"

const STORAGE_KEYS = {
  users: "hermes-cache-users-v1",
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

// User-specific interfaces
type RefreshOptions = LoadOptions & { useGlobalLoader?: boolean }

interface UsersContextType {
  // State
  users: User[]
  isLoading: boolean
  error: string | null

  // Actions
  refreshUsers: (options?: RefreshOptions) => Promise<void>
  createUser: (data: {
    username: string
    password: string
    role: Exclude<UserRole, "admin">
    name?: string
    phone: string
    department: string
    shiftStart: string
    shiftEnd: string
    hasBreak?: boolean
    breakStart?: string
    breakEnd?: string
    isDualShift?: boolean
    hasShift2?: boolean
    shift2Start?: string
    shift2End?: string
    shift2HasBreak?: boolean
    shift2BreakStart?: string
    shift2BreakEnd?: string
  }) => Promise<boolean>
  updateUser: (userId: string, data: Partial<User>) => Promise<boolean>
  deleteUser: (userId: string) => Promise<boolean>
  getUserById: (userId: string) => User | undefined
  getUsersByRole: (role: UserRole) => User[]
  getUsersByDepartment: (department: string) => User[]
}

const UsersContext = createContext<UsersContextType | null>(null)

export function useUsers() {
  const context = useContext(UsersContext)
  if (!context) {
    throw new Error("useUsers must be used within a UsersProvider")
  }
  return context
}

interface UsersProviderProps {
  children: ReactNode
}

export function UsersProvider({ children }: UsersProviderProps) {
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load cached users on mount
  useEffect(() => {
    const cached = loadFromStorage<User[]>(STORAGE_KEYS.users)
    if (cached) {
      setUsers(cached)
      setIsLoading(false)
    }
  }, [])

  const refreshUsers = useCallback(async (options: RefreshOptions = {}) => {
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

      const loadedUsers = await loadUsersFromSupabase(loaderOptions)
      setUsers(loadedUsers)
    } catch (error) {
      console.error("Failed to refresh users:", error)
      setError(error instanceof Error ? error.message : "Failed to load users")
    } finally {
      setIsLoading(false)
    }
  }, [])

  const createUser = useCallback(async (data: {
    username: string
    password: string
    role: Exclude<UserRole, "admin">
    name?: string
    phone: string
    department: string
    shiftStart: string
    shiftEnd: string
    hasBreak?: boolean
    breakStart?: string
    breakEnd?: string
    isDualShift?: boolean
    hasShift2?: boolean
    shift2Start?: string
    shift2End?: string
    shift2HasBreak?: boolean
    shift2BreakStart?: string
    shift2BreakEnd?: string
  }): Promise<boolean> => {
    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      })

      if (response.ok) {
        const { user } = await response.json()
        setUsers((prev) => [...prev, user])

        // Refresh users from server to get the latest state
        await refreshUsers({ useGlobalLoader: false })

        return true
      } else {
        console.error("Failed to create user:", await response.text())
        return false
      }
    } catch (error) {
      console.error("Error creating user:", error)
      return false
    }
  }, [refreshUsers])

  const updateUser = useCallback(async (userId: string, data: Partial<User>): Promise<boolean> => {
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      })

      if (response.ok) {
        const { user } = await response.json()
        setUsers((prev) => prev.map((u) => (u.id === userId ? user : u)))

        // Refresh users from server to get the latest state
        await refreshUsers({ useGlobalLoader: false })

        return true
      } else {
        console.error("Failed to update user:", await response.text())
        return false
      }
    } catch (error) {
      console.error("Error updating user:", error)
      return false
    }
  }, [refreshUsers])

  const deleteUser = useCallback(async (userId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        setUsers((prev) => prev.filter((u) => u.id !== userId))

        // Refresh users from server to get the latest state
        await refreshUsers({ useGlobalLoader: false })

        return true
      } else {
        console.error("Failed to delete user:", await response.text())
        return false
      }
    } catch (error) {
      console.error("Error deleting user:", error)
      return false
    }
  }, [refreshUsers])

  const getUserById = useCallback((userId: string): User | undefined => {
    return users.find((u) => u.id === userId)
  }, [users])

  const getUsersByRole = useCallback((role: UserRole): User[] => {
    return users.filter((u) => u.role === role)
  }, [users])

  const getUsersByDepartment = useCallback((department: string): User[] => {
    return users.filter((u) => u.department === department)
  }, [users])

  // Initialize users on mount
  useEffect(() => {
    void (async () => {
      try {
        await refreshUsers({ useGlobalLoader: false })
      } catch (error) {
        console.error("Failed to initialize users:", error)
      }
    })()
  }, [refreshUsers])

  // Sync users with localStorage when they change
  useEffect(() => {
    persistToStorage(STORAGE_KEYS.users, users)
  }, [users])

  const value: UsersContextType = useMemo(() => ({
    users,
    isLoading,
    error,
    refreshUsers,
    createUser,
    updateUser,
    deleteUser,
    getUserById,
    getUsersByRole,
    getUsersByDepartment,
  }), [users, isLoading, error, refreshUsers, createUser, updateUser, deleteUser, getUserById, getUsersByRole, getUsersByDepartment])

  return <UsersContext.Provider value={value}>{children}</UsersContext.Provider>
}
