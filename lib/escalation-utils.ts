// Escalation detection and management utilities

export interface Escalation {
  id: string
  task_id: string
  worker_id: string
  level: 1 | 2 | 3
  timestamp: { client: string; server: string }
  acknowledged_by?: string
  acknowledged_at?: string
  resolved: boolean
  resolution_notes?: string
}

export function detectEscalationLevel(
  startedAt: string,
  expectedDuration: number,
  pauseHistory: Array<{ paused_at: { client: string }; resumed_at: { client: string } | null }>,
): 1 | 2 | 3 | null {
  const startTime = new Date(startedAt).getTime()
  const now = Date.now()
  const elapsedMinutes = (now - startTime) / 60000

  // Calculate total pause time
  let pausedMinutes = 0
  pauseHistory.forEach((pause) => {
    const pauseStart = new Date(pause.paused_at.client).getTime()
    if (pause.resumed_at) {
      const pauseEnd = new Date(pause.resumed_at.client).getTime()
      pausedMinutes += (pauseEnd - pauseStart) / 60000
    } else {
      pausedMinutes += (now - pauseStart) / 60000
    }
  })

  const activeMinutes = elapsedMinutes - pausedMinutes

  // Level 3: 50% overtime
  if (activeMinutes >= expectedDuration * 1.5) {
    return 3
  }

  // Level 2: 20 minutes
  if (activeMinutes >= 20) {
    return 2
  }

  // Level 1: 15 minutes
  if (activeMinutes >= 15) {
    return 1
  }

  return null
}

export function getEscalationColor(level: 1 | 2 | 3): string {
  switch (level) {
    case 1:
      return "bg-yellow-500 text-white"
    case 2:
      return "bg-orange-500 text-white"
    case 3:
      return "bg-red-500 text-white"
  }
}

export function getEscalationLabel(level: 1 | 2 | 3): string {
  switch (level) {
    case 1:
      return "Level 1: 15min"
    case 2:
      return "Level 2: 20min"
    case 3:
      return "Level 3: Overtime"
  }
}

export function shouldBlockNewAssignments(escalations: Escalation[], workerId: string): boolean {
  // Block if worker has any Level 2 or 3 unresolved escalations
  return escalations.some((esc) => esc.worker_id === workerId && !esc.resolved && (esc.level === 2 || esc.level === 3))
}
