"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { RealtimeChannel } from "@supabase/supabase-js"

interface UseRealtimeTasksOptions {
  enabled?: boolean
  filter?: {
    userId?: string
    department?: string
  }
}

export function useRealtimeTasks(options: UseRealtimeTasksOptions = {}) {
  const { enabled = true, filter } = options
  const [isConnected, setIsConnected] = useState(false)
  const [channel, setChannel] = useState<RealtimeChannel | null>(null)

  useEffect(() => {
    if (!enabled) return

    const supabase = createClient()

    // Create a channel for task updates
    const taskChannel = supabase
      .channel("tasks-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: filter?.userId ? `assigned_to_user_id=eq.${filter.userId}` : undefined,
        },
        (payload) => {
          console.log("[v0] Realtime task update:", payload)
          // The task context will handle the update via the subscription callback
        },
      )
      .subscribe((status) => {
        console.log("[v0] Realtime connection status:", status)
        setIsConnected(status === "SUBSCRIBED")
      })

    setChannel(taskChannel)

    // Cleanup on unmount
    return () => {
      console.log("[v0] Cleaning up realtime subscription")
      taskChannel.unsubscribe()
    }
  }, [enabled, filter?.userId, filter?.department])

  return { isConnected, channel }
}
