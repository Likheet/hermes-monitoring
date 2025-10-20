"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import type { RealtimeChannel } from "@supabase/supabase-js"

interface UseRealtimeTasksOptions {
  enabled?: boolean
  filter?: {
    userId?: string
    department?: string
  }
  onTaskUpdate?: (payload: any) => void
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
    (payload: any) => {
      console.log("[v0] Realtime task change:", payload.eventType, payload.new?.id)
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
      console.log("[v0] Removing realtime channel")
      channelRef.current
        .unsubscribe()
        .catch((error) => console.error("[v0] Error unsubscribing channel:", error))
      channelRef.current = null
    }
  }, [])

  const setupChannel = useCallback(() => {
    cleanup()

    if (!enabled) {
      console.log("[v0] Realtime disabled")
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
          filter: filter?.userId ? `assigned_to_user_id=eq.${filter.userId}` : undefined,
        },
        handleTaskUpdate,
      )
      .subscribe((status, err) => {
        console.log("[v0] Realtime subscription status:", status)
        setConnectionStatus(status)

        if (err) {
          console.error("[v0] Realtime subscription error:", err)
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
  }, [cleanup, enabled, filter?.userId, handleTaskUpdate])

  const attemptReconnect = useCallback(() => {
    if (!enabled) {
      return
    }

    const maxAttempts = 5
    const baseDelay = 2000

    if (reconnectAttemptsRef.current >= maxAttempts) {
      console.error("[v0] Max reconnection attempts reached")
      setConnectionStatus("FAILED")
      return
    }

    const delay = baseDelay * Math.pow(2, reconnectAttemptsRef.current)
    console.log(
      `[v0] Attempting reconnection in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1}/${maxAttempts})`,
    )

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
