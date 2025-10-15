"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Clock, Play } from "lucide-react"

interface PauseTimelineProps {
  pauseHistory: Array<{
    paused_at: { client: string }
    resumed_at: { client: string } | null
    reason: string
  }>
}

export function PauseTimeline({ pauseHistory }: PauseTimelineProps) {
  if (pauseHistory.length === 0) {
    return null
  }

  const formatDuration = (start: string, end: string | null) => {
    const startTime = new Date(start).getTime()
    const endTime = end ? new Date(end).getTime() : Date.now()
    const durationMs = endTime - startTime
    const minutes = Math.floor(durationMs / 60000)
    const seconds = Math.floor((durationMs % 60000) / 1000)
    return `${minutes}m ${seconds}s`
  }

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Pause History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {pauseHistory.map((pause, index) => (
            <div key={index} className="flex items-start gap-3 border-l-2 border-muted pl-4">
              <div className="mt-1">
                {pause.resumed_at ? (
                  <Play className="h-4 w-4 text-green-500" />
                ) : (
                  <Clock className="h-4 w-4 text-orange-500" />
                )}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{pause.resumed_at ? "Resumed" : "Paused"}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDuration(pause.paused_at.client, pause.resumed_at?.client || null)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{pause.reason}</p>
                <p className="text-xs text-muted-foreground">
                  {formatTime(pause.paused_at.client)}
                  {pause.resumed_at && ` - ${formatTime(pause.resumed_at.client)}`}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
