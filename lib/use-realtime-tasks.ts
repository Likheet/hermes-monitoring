"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js"

type TaskRealtimePayload = RealtimePostgresChangesPayload<Record<string, unknown>>

interface UseRealtimeTasksOptions {
  enabled?: boolean
  filter?: {
    userId?: string
    department?: string
    role?: string
  }
  onTaskUpdate?: (payload: TaskRealtimePayload) => void
}

// Helper function to determine subscription filters based on user role
function getSubscriptionFilters(filter?: UseRealtimeTasksOptions['filter']) {
  if (!filter) return undefined

  // Workers get their personal tasks
  if (filter.userId && (!filter.role || filter.role === 'worker')) {
    return `assigned_to_user_id=eq.${filter.userId}`
  }

  // Supervisors see tasks from their department
  if (filter.role === 'supervisor' && filter.department) {
    return `department=eq.${filter.department}`
  }

  // Front office sees all tasks (no filter needed)
  if (filter.role === 'front_office' || filter.role === 'admin') {
    return undefined // No filter - get all updates
  }

  // Default to user filter if available
  return filter.userId ? `assigned_to_user_id=eq.${filter.userId}` : undefined
}

export function useRealtimeTasks(options: UseRealtimeTasksOptions = {}) {
  const { enabled = true, filter, onTaskUpdate } = options
  const [isConnected, setIsConnected] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<string>("IDLE")
  const channelRef = useRef<RealtimeChannel | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)
  const attemptReconnectHandlerRef = useRef<() => void>(() => {})

  const handleTaskUpdate = useCallback(
    (payload: TaskRealtimePayload) => {
      if (onTaskUpdate) {
        onTaskUpdate(payload)
      }
    },
    [onTaskUpdate],
  )

  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    if (channelRef.current) {
      channelRef.current
        .unsubscribe()
        .catch((error) => console.error("Error unsubscribing channel:", error))
      channelRef.current = null
    }
  }, [])

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

    const taskChannel = supabase
      .channel("tasks-realtime", {
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
          filter: getSubscriptionFilters(filter),
        },
        handleTaskUpdate,
      )
  .subscribe((status: string, err?: Error | null) => {
        setConnectionStatus(status)

        if (err) {
          // Suppress "mismatch between server and client bindings" warning - non-critical
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
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setIsConnected(false)
          attemptReconnectHandlerRef.current()
        } else if (status === "CLOSED") {
          setIsConnected(false)
        }
      })

    channelRef.current = taskChannel
  }, [cleanup, enabled, filter, handleTaskUpdate])

  const attemptReconnect = useCallback(() => {
    if (!enabled) {
      return
    }

    const maxAttempts = 5
    const baseDelay = 2000

    if (reconnectAttemptsRef.current >= maxAttempts) {
      console.error("Max reconnection attempts reached")
      setConnectionStatus("FAILED")
      return
    }

    const delay = baseDelay * Math.pow(2, reconnectAttemptsRef.current)

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }

    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectAttemptsRef.current++
      setupChannel()
    }, delay)
  }, [enabled, setupChannel])

  attemptReconnectHandlerRef.current = attemptReconnect

  useEffect(() => {
    setupChannel()
    return cleanup
  }, [setupChannel, cleanup])

  return {
    isConnected,
    connectionStatus,
    channel: channelRef.current,
  }
}

export type { TaskRealtimePayload }
