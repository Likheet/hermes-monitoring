"use client"

import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { TaskStatus } from "@/lib/types"

interface TaskFiltersProps {
  statusFilter: TaskStatus | "ALL"
  onStatusFilterChange: (status: TaskStatus | "ALL") => void
  workerFilter: string
  onWorkerFilterChange: (workerId: string) => void
  workers: Array<{ id: string; name: string }>
}

export function TaskFilters({
  statusFilter,
  onStatusFilterChange,
  workerFilter,
  onWorkerFilterChange,
  workers,
}: TaskFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <div className="flex-1 space-y-2">
        <Label htmlFor="status-filter">Status</Label>
        <Select value={statusFilter} onValueChange={(value) => onStatusFilterChange(value as TaskStatus | "ALL")}>
          <SelectTrigger id="status-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Status</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
            <SelectItem value="PAUSED">Paused</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 space-y-2">
        <Label htmlFor="worker-filter">Worker</Label>
        <Select value={workerFilter} onValueChange={onWorkerFilterChange}>
          <SelectTrigger id="worker-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Workers</SelectItem>
            {workers.map((worker) => (
              <SelectItem key={worker.id} value={worker.id}>
                {worker.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
