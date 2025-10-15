"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AlertTriangle, MapPin, User, Clock } from "lucide-react"
import { formatExactTimestamp } from "@/lib/date-utils"
import type { TaskIssue, Task } from "@/lib/types"
import { useTasks } from "@/lib/task-context"

interface IssueCardProps {
  issue: TaskIssue
  task: Task
  onResolve?: (issueId: string) => void
}

export function IssueCard({ issue, task, onResolve }: IssueCardProps) {
  const { users } = useTasks()
  const reporter = users.find((u) => u.id === issue.reported_by_user_id)

  return (
    <Card className="border-orange-200 bg-orange-50">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg flex items-center gap-2 text-orange-900">
            <AlertTriangle className="h-5 w-5" />
            {task.task_type}
          </CardTitle>
          <Badge variant={issue.status === "OPEN" ? "destructive" : "secondary"}>{issue.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <User className="h-4 w-4" />
          <span>Reported by: {reporter?.name || "Unknown"}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" />
          <span>Room {task.room_number}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>{formatExactTimestamp(issue.reported_at.client)}</span>
        </div>
        <div className="p-3 bg-white rounded border border-orange-200">
          <p className="text-sm font-medium text-orange-900 mb-1">Issue Description:</p>
          <p className="text-sm text-gray-700">{issue.issue_description}</p>
        </div>
        {issue.status === "OPEN" && onResolve && (
          <Button variant="outline" size="sm" className="w-full bg-transparent" onClick={() => onResolve(issue.id)}>
            Mark as Resolved
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

export default IssueCard
