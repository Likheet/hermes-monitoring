"use client"

import { useEffect, useState, useCallback, useRef, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js"

type TaskRealtimePayload = RealtimePostgresChangesPayload<Record<string, unknown>>

interface UseRealtimeTasksOptions {
  enabled?: boolean
  userRole?: string
  userDepartment?: string
  userId?: string
  onTaskUpdate?: (payload: TaskRealtimePayload) => void
}

// Performance optimization: Batch updates and debounce rapid changes
class UpdateBatcher {
  private pendingUpdates: TaskRealtimePayload[] = []
  private timeoutId: ReturnType<typeof setTimeout> | null = null
  private readonly batchDelay = 250 // ms
  private readonly maxBatchSize = 10
  private readonly maxWaitTime = 1000 // ms

  constructor(private onBatch: (updates: TaskRealtimePayload[]) => void) {}

  addUpdate(update: TaskRealtimePayload) {
    this.pendingUpdates.push(update)

    // If we hit max batch size, process immediately
    if (this.pendingUpdates.length >= this.maxBatchSize) {
      this.flush()
      return
    }

    // Clear existing timeout
    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
    }

    // Set new timeout
    this.timeoutId = setTimeout(() => {
      this.flush()
    }, this.batchDelay)

    // Safety net: ensure we don't wait too long
    setTimeout(() => {
      if (this.pendingUpdates.length > 0) {
        this.flush()
      }
    }, this.maxWaitTime)
  }

  private flush() {
    if (this.pendingUpdates.length === 0) return

    const updates = [...this.pendingUpdates]
    this.pendingUpdates = []

    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
      this.timeoutId = null
    }

    this.onBatch(updates)
  }

  destroy() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
      this.timeoutId = null
    }
    this.pendingUpdates = []
  }
}

// Optimized subscription filters with caching
const subscriptionFilterCache = new Map<string, string | undefined>()

function getSubscriptionFilters(userRole?: string, userDepartment?: string, userId?: string): string | undefined {
  const cacheKey = `${userRole ?? ""}-${userDepartment ?? ""}-${userId ?? ""}`

  if (subscriptionFilterCache.has(cacheKey)) {
    return subscriptionFilterCache.get(cacheKey)
  }

  let filter: string | undefined

  // Based on user role, determine what they should see
  switch (userRole) {
    case 'worker':
      // Workers should only see updates for their assignments
      if (userId) {
        filter = `assigned_to_user_id=eq.${userId}`
      }
      break
    case 'supervisor':
      // Supervisors currently receive all tasks; department column was removed
      filter = undefined
      break
    case 'front_office':
    case 'admin':
      // Front office and admin see all tasks
      filter = undefined
      break
    default:
      if (userId) {
        filter = `assigned_to_user_id=eq.${userId}`
      }
  }

  subscriptionFilterCache.set(cacheKey, filter)
  return filter
}

export function useRealtimeTasks(options: UseRealtimeTasksOptions = {}) {
  const { enabled = true, userRole, userDepartment, userId, onTaskUpdate } = options
  const [isConnected, setIsConnected] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<string>("IDLE")
  const [lastUpdate, setLastUpdate] = useState<number>(0)

  // Refs for optimization
  const channelRef = useRef<RealtimeChannel | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)
  const batcherRef = useRef<UpdateBatcher | null>(null)
  const connectionHealthCheckRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Memoize the batch handler to prevent unnecessary recreations
  const handleBatchedUpdates = useCallback((updates: TaskRealtimePayload[]) => {
    // Process updates in order, removing duplicates for the same task
    const latestUpdates = new Map<string, TaskRealtimePayload>()

    updates.forEach(update => {
      const taskId = (update.new?.id ?? update.old?.id) as string | undefined
      if (taskId) {
        latestUpdates.set(taskId, update)
      }
    })

    // Trigger callbacks for each unique update
    latestUpdates.forEach(update => {
      if (onTaskUpdate) {
        onTaskUpdate(update)
      }
    })

    setLastUpdate(Date.now())
  }, [onTaskUpdate])

  // Initialize batcher
  useEffect(() => {
    if (enabled && onTaskUpdate) {
      batcherRef.current = new UpdateBatcher(handleBatchedUpdates)
    }

    return () => {
      if (batcherRef.current) {
        batcherRef.current.destroy()
        batcherRef.current = null
      }
    }
  }, [enabled, onTaskUpdate, handleBatchedUpdates])

  // Optimized cleanup function
  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    if (connectionHealthCheckRef.current) {
      clearInterval(connectionHealthCheckRef.current)
      connectionHealthCheckRef.current = null
    }
    if (channelRef.current) {
      channelRef.current
        .unsubscribe()
        .catch((error) => console.error("Error unsubscribing channel:", error))
      channelRef.current = null
    }
    if (batcherRef.current) {
      batcherRef.current.destroy()
      batcherRef.current = null
    }
  }, [])

  // Optimized single task update handler
  const handleTaskUpdate = useCallback(
    (payload: TaskRealtimePayload) => {
      if (batcherRef.current) {
        batcherRef.current.addUpdate(payload)
      }
    },
    []
  )

  // Optimized channel setup with connection pooling
  const setupChannel = useCallback(() => {
    cleanup()

    if (!enabled) {
      setConnectionStatus("DISABLED")
      setIsConnected(false)
      return
    }

    let supabase = supabaseRef.current
    if (!supabase) {
      supabase = createClient()
      supabaseRef.current = supabase
    }
    setConnectionStatus("CONNECTING")

    const filter = getSubscriptionFilters(userRole, userDepartment, userId)

    const taskChannel = supabase
      .channel("tasks-realtime-optimized", {
        config: {
          broadcast: { self: false },
          presence: { key: "" },
        },
      })
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: filter,
        },
        handleTaskUpdate,
      )
      .subscribe((status: string, err?: Error | null) => {
        setConnectionStatus(status)

        if (err) {
          // Suppress non-critical warnings
          if (!err.message?.includes('mismatch between server and client bindings')) {
            console.error("Realtime subscription error:", err)
          }
          setIsConnected(false)
          attemptReconnectHandlerRef.current()
          return
        }

        if (status === "SUBSCRIBED") {
          setIsConnected(true)
          reconnectAttemptsRef.current = 0 // Reset on successful connection

          // Start connection health check
          connectionHealthCheckRef.current = setInterval(() => {
            if (channelRef.current) {
              // Ping the connection to ensure it's still alive
              channelRef.current.send({
                type: 'broadcast',
                event: 'ping',
                payload: { timestamp: Date.now() }
              }).catch(() => {
                // Connection might be dead, trigger reconnect
                setIsConnected(false)
                attemptReconnectHandlerRef.current()
              })
            }
          }, 30000) // Check every 30 seconds

        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setIsConnected(false)
          attemptReconnectHandlerRef.current()
        } else if (status === "CLOSED") {
          setIsConnected(false)
        }
      })

    channelRef.current = taskChannel
  }, [cleanup, enabled, userRole, userDepartment, userId, handleTaskUpdate])

  // Optimized reconnection with exponential backoff and jitter
  const attemptReconnect = useCallback(() => {
    if (!enabled) {
      return
    }

    const maxAttempts = 5
    const baseDelay = 2000
    const maxDelay = 30000 // Max 30 seconds

    if (reconnectAttemptsRef.current >= maxAttempts) {
      console.error("Max reconnection attempts reached")
      setConnectionStatus("FAILED")
      return
    }

    // Exponential backoff with jitter to prevent thundering herd
    const exponentialDelay = Math.min(baseDelay * Math.pow(2, reconnectAttemptsRef.current), maxDelay)
    const jitter = Math.random() * 1000 // Random jitter up to 1 second
    const delay = exponentialDelay + jitter

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }

    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectAttemptsRef.current++
      console.log(`Attempting reconnection ${reconnectAttemptsRef.current}/${maxAttempts}`)
      setupChannel()
    }, delay)
  }, [enabled, setupChannel])

  // Store attempt reconnect handler ref for use in setupChannel
  const attemptReconnectHandlerRef = useRef(attemptReconnect)
  attemptReconnectHandlerRef.current = attemptReconnect

  // Setup channel when dependencies change
  useEffect(() => {
    setupChannel()
    return cleanup
  }, [setupChannel, cleanup])

  // Memoize return value to prevent unnecessary re-renders
  return useMemo(() => ({
    isConnected,
    connectionStatus,
    lastUpdate,
    filters: {
      userRole,
      userDepartment,
      userId,
    }
  }), [isConnected, connectionStatus, lastUpdate, userRole, userDepartment, userId])
}

export type { TaskRealtimePayload }
