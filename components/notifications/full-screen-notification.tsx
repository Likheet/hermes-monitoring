"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth-context"
import { createClient } from "@/lib/supabase/client"
import type { Notification, NotificationType } from "@/lib/notification-utils"
import { markNotificationAsRead } from "@/lib/notification-utils"
import { playNotificationSound } from "@/lib/notification-utils"
import { triggerHapticFeedback } from "@/lib/haptics"
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js"
import { useTasks } from "@/lib/task-context"
import type { Task } from "@/lib/types"

const HIGH_PRIORITY_TYPES: NotificationType[] = ["escalation", "task_rejected"]

function isNotificationRow(value: unknown): value is Notification {
  if (!value || typeof value !== "object") {
    return false
  }

  const candidate = value as Notification
  return (
    typeof candidate.id === "string" &&
    typeof candidate.user_id === "string" &&
    typeof candidate.type === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.message === "string" &&
    typeof candidate.created_at === "string" &&
    typeof candidate.read === "boolean"
  )
}

function isHighPriority(notification: Notification) {
  return HIGH_PRIORITY_TYPES.includes(notification.type)
}

function resolveTaskLink(notification: Notification, role: string | undefined) {
  if (!notification.task_id) return null

  switch (role) {
    case "worker":
      return `/worker/${notification.task_id}`
    case "supervisor":
      return `/supervisor/verify/${notification.task_id}`
    case "front_office":
      return `/front-office/assignments?focus=${notification.task_id}`
    default:
      return `/admin/task-management?task=${notification.task_id}`
  }
}

export function FullScreenNotificationOverlay() {
  const { user } = useAuth()
  const [queue, setQueue] = useState<Notification[]>([])
  const supabase = useMemo(() => createClient(), [])
  const { tasks } = useTasks()
  const tasksRef = useRef<Task[]>(tasks)

  useEffect(() => {
    tasksRef.current = tasks
  }, [tasks])

  useEffect(() => {
    if (!user) {
      setQueue([])
      return
    }

    let isMounted = true
    const userId = user.id

    async function shouldQueueNotification(notification: Notification) {
      if (!notification.task_id) {
        return false
      }

      const localTask = tasksRef.current.find((task) => task.id === notification.task_id)
      if (localTask) {
        return localTask.priority_level === "GUEST_REQUEST"
      }

      try {
        const { data, error } = await supabase
          .from("tasks")
          .select("id, priority_level")
          .eq("id", notification.task_id)
          .maybeSingle()

        if (error) {
          console.error("Failed to load task for notification prioritization:", error)
          return false
        }

        if (data && typeof data.priority_level === "string") {
          return data.priority_level === "GUEST_REQUEST"
        }
      } catch (error) {
        console.error("Error determining notification priority:", error)
      }

      return false
    }

    async function preloadHighPriorityNotifications() {
      try {
        const { data, error } = await supabase
          .from("notifications")
          .select("*")
          .eq("user_id", userId)
          .eq("read", false)
          .in("type", HIGH_PRIORITY_TYPES)
          .order("created_at", { ascending: true })

        if (!isMounted) return
        if (error) {
          const errorMessage =
            typeof error === "object" && error !== null && "message" in error
              ? (error as { message?: string; code?: string; details?: string }).message || JSON.stringify(error)
              : String(error)
          console.error("Failed to fetch high priority notifications:", errorMessage)
          return
        }

        if (Array.isArray(data) && data.length > 0) {
          const typedRows = data.filter(isNotificationRow)
          const qualifying: Notification[] = []

          for (const notification of typedRows) {
            if (await shouldQueueNotification(notification)) {
              qualifying.push(notification)
            }
          }

          if (!isMounted) {
            return
          }

          if (qualifying.length > 0) {
            setQueue((prev) => {
              const existingIds = new Set(prev.map((item) => item.id))
              const merged = [...prev]
              qualifying.forEach((item) => {
                if (!existingIds.has(item.id)) merged.push(item)
              })
              return merged
            })
          }
        }
      } catch (error) {
        const errorMessage =
          typeof error === "object" && error !== null && "message" in error
            ? (error as { message?: string; code?: string; details?: string }).message || JSON.stringify(error)
            : String(error)
        console.error("Error preloading high priority notifications:", errorMessage)
      }
    }

    void preloadHighPriorityNotifications()

    const channel: RealtimeChannel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        async (payload: RealtimePostgresChangesPayload<Notification>) => {
          if (!payload.new || !isNotificationRow(payload.new)) {
            return
          }

          const notification = payload.new
          if (!isHighPriority(notification)) {
            return
          }

          if (!(await shouldQueueNotification(notification))) {
            return
          }

          if (!isMounted) {
            return
          }

          setQueue((prev) => {
            if (prev.some((item) => item.id === notification.id)) {
              return prev
            }
            return [...prev, notification]
          })

          playNotificationSound()
          triggerHapticFeedback("heavy")
        },
      )
      .subscribe()

    return () => {
      isMounted = false
      supabase.removeChannel(channel)
    }
  }, [supabase, user])

  const currentNotification = queue[0]

  const handleDismiss = async (notification: Notification) => {
    setQueue((prev) => prev.slice(1))

    try {
      await markNotificationAsRead(notification.id)
    } catch (error) {
      console.error("Failed to mark notification as read:", error)
    }
  }

  if (!currentNotification) {
    return null
  }

  const taskLink = resolveTaskLink(currentNotification, user?.role)

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-xl bg-background p-6 shadow-2xl">
        <div className="mb-2 text-sm uppercase tracking-wide text-muted-foreground">Urgent Alert</div>
        <h2 className="text-2xl font-semibold text-foreground">{currentNotification.title}</h2>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">{currentNotification.message}</p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          {taskLink && (
            <Button asChild className="flex-1" onClick={() => void handleDismiss(currentNotification)}>
              <Link href={taskLink}>Open Task</Link>
            </Button>
          )}
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => void handleDismiss(currentNotification)}
          >
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  )
}
