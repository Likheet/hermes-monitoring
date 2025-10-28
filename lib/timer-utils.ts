// Timer persistence and offline queue utilities

interface TimerState {
  taskId: string
  userId: string
  startedAt: string
  pauseHistory: Array<{
    pausedAt: string
    resumedAt: string | null
    reason: string
  }>
}

interface OfflineAction {
  id: string
  type: "START" | "PAUSE" | "RESUME" | "COMPLETE"
  taskId: string
  userId: string
  timestamp: string
  data?: Record<string, unknown>
}

const TIMER_STORAGE_KEY = "active_timer_state"
const OFFLINE_QUEUE_KEY = "offline_action_queue"

// Background timer persistence
export function saveTimerState(state: TimerState) {
  if (typeof window === "undefined") return
  localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(state))
}

export function getTimerState(): TimerState | null {
  if (typeof window === "undefined") return null
  const stored = localStorage.getItem(TIMER_STORAGE_KEY)
  return stored ? JSON.parse(stored) : null
}

export function clearTimerState() {
  if (typeof window === "undefined") return
  localStorage.removeItem(TIMER_STORAGE_KEY)
}

// Offline queue management
export function addToOfflineQueue(action: Omit<OfflineAction, "id">) {
  if (typeof window === "undefined") return

  const queue = getOfflineQueue()
  const newAction: OfflineAction = {
    ...action,
    id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  }
  queue.push(newAction)
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue))
}

export function getOfflineQueue(): OfflineAction[] {
  if (typeof window === "undefined") return []
  const stored = localStorage.getItem(OFFLINE_QUEUE_KEY)
  return stored ? JSON.parse(stored) : []
}

export function clearOfflineQueue() {
  if (typeof window === "undefined") return
  localStorage.removeItem(OFFLINE_QUEUE_KEY)
}

export function removeFromOfflineQueue(actionId: string) {
  if (typeof window === "undefined") return
  const queue = getOfflineQueue()
  const filtered = queue.filter((action) => action.id !== actionId)
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(filtered))
}

// Calculate total pause duration
export function calculateTotalPauseDuration(
  pauseHistory: Array<{ paused_at: { client: string }; resumed_at: { client: string } | null }>,
): number {
  let totalPauseMs = 0

  pauseHistory.forEach((pause) => {
    const pauseStart = new Date(pause.paused_at.client).getTime()
    if (pause.resumed_at) {
      const pauseEnd = new Date(pause.resumed_at.client).getTime()
      totalPauseMs += pauseEnd - pauseStart
    } else {
      // Currently paused
      totalPauseMs += Date.now() - pauseStart
    }
  })

  return totalPauseMs
}

// Timer validation flags
export interface TimerValidationFlag {
  type: "EXACT_MATCH" | "TIMESTAMP_DRIFT" | "MISSING_PAUSES" | "SUSPICIOUS_PATTERN"
  severity: "warning" | "error"
  message: string
}

export function validateTimer(
  startedAt: { client: string; server: string },
  completedAt: { client: string; server: string },
  pauseHistory: Array<{
    paused_at: { client: string; server: string }
    resumed_at: { client: string; server: string } | null
  }>,
  expectedDuration: number,
  actualDuration: number,
): TimerValidationFlag[] {
  const flags: TimerValidationFlag[] = []

  // Check for exact match (suspicious)
  if (actualDuration === expectedDuration) {
    flags.push({
      type: "EXACT_MATCH",
      severity: "warning",
      message: "Actual duration exactly matches expected duration",
    })
  }

  // Check for timestamp drift (client vs server)
  const startDrift = Math.abs(new Date(startedAt.client).getTime() - new Date(startedAt.server).getTime())
  const completeDrift = Math.abs(new Date(completedAt.client).getTime() - new Date(completedAt.server).getTime())

  if (startDrift > 5 * 60 * 1000 || completeDrift > 5 * 60 * 1000) {
    flags.push({
      type: "TIMESTAMP_DRIFT",
      severity: "error",
      message: `Timestamp drift detected: ${Math.max(startDrift, completeDrift) / 1000 / 60} minutes`,
    })
  }

  // Check for missing pauses (long task with no breaks)
  if (actualDuration > 60 && pauseHistory.length === 0) {
    flags.push({
      type: "MISSING_PAUSES",
      severity: "warning",
      message: "Long task completed without any pauses",
    })
  }

  // Check for suspicious patterns (multiple very short pauses)
  const shortPauses = pauseHistory.filter((pause) => {
    if (!pause.resumed_at) return false
    const duration = new Date(pause.resumed_at.client).getTime() - new Date(pause.paused_at.client).getTime()
    return duration < 60 * 1000 // Less than 1 minute
  })

  if (shortPauses.length > 3) {
    flags.push({
      type: "SUSPICIOUS_PATTERN",
      severity: "warning",
      message: `${shortPauses.length} very short pauses detected`,
    })
  }

  return flags
}

// Network status detection
export function isOnline(): boolean {
  if (typeof window === "undefined") return true
  return navigator.onLine
}

export function setupOnlineListener(callback: (online: boolean) => void) {
  if (typeof window === "undefined") return () => {}

  const handleOnline = () => callback(true)
  const handleOffline = () => callback(false)

  window.addEventListener("online", handleOnline)
  window.addEventListener("offline", handleOffline)

  return () => {
    window.removeEventListener("online", handleOnline)
    window.removeEventListener("offline", handleOffline)
  }
}
