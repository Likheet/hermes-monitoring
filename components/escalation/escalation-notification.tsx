"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AlertCircle } from "lucide-react"
import type { Task } from "@/lib/types"
import type { Escalation } from "@/lib/escalation-utils"
import { getEscalationColor } from "@/lib/escalation-utils"

interface EscalationNotificationProps {
  escalations: Escalation[]
  tasks: Task[]
  onAcknowledge: (escalationId: string) => void
}

export function EscalationNotification({ escalations, tasks, onAcknowledge }: EscalationNotificationProps) {
  const [visible, setVisible] = useState(true)

  // Filter unacknowledged Level 2+ escalations
  const criticalEscalations = escalations.filter((esc) => !esc.acknowledged_by && (esc.level === 2 || esc.level === 3))

  useEffect(() => {
    if (criticalEscalations.length > 0) {
      setVisible(true)
    }
  }, [criticalEscalations.length])

  if (criticalEscalations.length === 0 || !visible) {
    return null
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full border-red-500 border-2">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-6 w-6 text-red-500" />
              <div>
                <CardTitle className="text-red-600">Critical Task Escalations</CardTitle>
                <CardDescription>
                  {criticalEscalations.length} task{criticalEscalations.length !== 1 ? "s" : ""} require immediate
                  attention
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {criticalEscalations.map((escalation) => {
            const task = tasks.find((t) => t.id === escalation.task_id)
            if (!task) return null

            return (
              <div key={escalation.id} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{task.task_type}</p>
                    <p className="text-sm text-muted-foreground">Room {task.room_number}</p>
                  </div>
                  <Badge className={getEscalationColor(escalation.level)} variant="secondary">
                    Level {escalation.level}
                  </Badge>
                </div>
                <p className="text-sm">
                  {escalation.level === 2
                    ? "Task has exceeded 20 minutes. Worker may need assistance."
                    : "Task has exceeded 50% of expected duration. Immediate action required."}
                </p>
                <Button onClick={() => onAcknowledge(escalation.id)} size="sm" className="w-full">
                  Acknowledge & Review
                </Button>
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
