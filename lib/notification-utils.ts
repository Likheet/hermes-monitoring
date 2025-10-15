import { createClient } from "@/lib/supabase/client"

export type NotificationType =
  | "task_assigned"
  | "task_completed"
  | "task_rejected"
  | "escalation"
  | "handover"
  | "system"

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  message: string
  task_id: string | null
  read: boolean
  created_at: string
}

export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  taskId?: string,
) {
  // In production with real Supabase, this would work with proper UUID task IDs
  if (taskId && !taskId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    console.log("[v0] Skipping Supabase notification for mock task ID:", taskId)
    // Return a mock notification for local state management
    return {
      id: `notif-${Date.now()}`,
      user_id: userId,
      type,
      title,
      message,
      task_id: taskId,
      read: false,
      created_at: new Date().toISOString(),
    }
  }

  const supabase = createClient()

  const { data, error } = await supabase
    .from("notifications")
    .insert({
      user_id: userId,
      type,
      title,
      message,
      task_id: taskId || null,
    })
    .select()
    .single()

  if (error) {
    console.error("[v0] Failed to create notification:", error.message)
    return null
  }

  return data
}

export async function getUnreadNotifications(userId: string) {
  const supabase = createClient()

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .eq("read", false)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[v0] Failed to fetch notifications:", error)
    return []
  }

  return data as Notification[]
}

export async function getAllNotifications(userId: string, limit = 50) {
  const supabase = createClient()

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    console.error("[v0] Failed to fetch notifications:", error)
    return []
  }

  return data as Notification[]
}

export async function markNotificationAsRead(notificationId: string) {
  const supabase = createClient()

  const { error } = await supabase.from("notifications").update({ read: true }).eq("id", notificationId)

  if (error) {
    console.error("[v0] Failed to mark notification as read:", error)
    return false
  }

  return true
}

export async function markAllNotificationsAsRead(userId: string) {
  const supabase = createClient()

  const { error } = await supabase.from("notifications").update({ read: true }).eq("user_id", userId).eq("read", false)

  if (error) {
    console.error("[v0] Failed to mark all notifications as read:", error)
    return false
  }

  return true
}

// Play notification sound
export function playNotificationSound() {
  if (typeof window === "undefined") return

  // Check if sound is muted in localStorage
  const isMuted = localStorage.getItem("notifications-muted") === "true"
  if (isMuted) return

  try {
    // Create a simple beep sound using Web Audio API
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    oscillator.frequency.value = 800
    oscillator.type = "sine"

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)

    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.3)
  } catch (error) {
    console.log("[v0] Failed to play notification sound:", error)
  }
}
