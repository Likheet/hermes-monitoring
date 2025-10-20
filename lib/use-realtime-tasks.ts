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
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>()
  const reconnectAttemptsRef = useRef(0)

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
    }
    if (channelRef.current) {
      const supabase = createClient()
      console.log("[v0] Removing realtime channel")
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
  }, [])

  const attemptReconnect = useCallback(() => {
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

    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectAttemptsRef.current++
      setupChannel()
    }, delay)
  }, [])

  const setupChannel = useCallback(() => {
    cleanup()

    if (!enabled) {
      console.log("[v0] Realtime disabled")
      setConnectionStatus("DISABLED")
      return
    }

    const supabase = createClient()
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
          attemptReconnect()
          return
        }

        if (status === "SUBSCRIBED") {
          setIsConnected(true)
          reconnectAttemptsRef.current = 0 // Reset on successful connection
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setIsConnected(false)
          attemptReconnect()
        } else if (status === "CLOSED") {
          setIsConnected(false)
        }
      })

    channelRef.current = taskChannel
  }, [enabled, filter?.userId, handleTaskUpdate, cleanup, attemptReconnect])

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
