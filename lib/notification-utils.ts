import { createClient } from "@/lib/supabase/client"

function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function generateUuid(): string {
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
  read_at?: string | null
  created_at: string
}

export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  taskId?: string,
) {
  const supabase = createClient()
  const sanitizedTaskId = taskId && isValidUuid(taskId) ? taskId : null

  const { data, error } = await supabase
    .from("notifications")
    .insert({
      user_id: userId,
      type,
      title,
      message,
      task_id: sanitizedTaskId,
    })
    .select()
    .single()

  if (!error && data) {
    return data as Notification
  }

  console.error("Failed to create notification via Supabase, returning local fallback:", error)

  return {
    id: generateUuid(),
    user_id: userId,
    type,
    title,
    message,
    task_id: sanitizedTaskId,
    read: false,
    read_at: null,
    created_at: new Date().toISOString(),
  }
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
    console.error("Failed to fetch notifications:", error)
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
    console.error("Failed to fetch notifications:", error)
    return []
  }

  return data as Notification[]
}

export async function markNotificationAsRead(notificationId: string) {
  const supabase = createClient()

  const { error } = await supabase
    .from("notifications")
    .update({ read: true, read_at: new Date().toISOString() })
    .eq("id", notificationId)

  if (error) {
    console.error("Failed to mark notification as read:", error)
    return false
  }

  return true
}

export async function markAllNotificationsAsRead(userId: string) {
  const supabase = createClient()

  const { error } = await supabase.from("notifications").update({ read: true }).eq("user_id", userId).eq("read", false)

  if (error) {
    console.error("Failed to mark all notifications as read:", error)
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
  }
}
