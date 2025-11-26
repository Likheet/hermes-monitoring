"use client"

import { useState } from "react"
import { X } from "lucide-react"
import {
  TASK_TYPE_LABELS,
  AREA_LABELS,
  FREQUENCY_LABELS,
  type MaintenanceSchedule,
  type MaintenanceTaskType,
  type MaintenanceArea,
  type ScheduleFrequency,
} from "@/lib/maintenance-types"
import { useTasks } from "@/lib/task-context"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

interface ScheduleFormProps {
  schedule?: MaintenanceSchedule
  onClose: () => void
  onSave: (schedule: Partial<MaintenanceSchedule>) => Promise<void>
}

export function MaintenanceScheduleForm({ schedule, onClose, onSave }: ScheduleFormProps) {
  const [taskType, setTaskType] = useState<MaintenanceTaskType>(schedule?.task_type || "ac_indoor")
  const [area, setArea] = useState<MaintenanceArea>(schedule?.area || "both")
  const [frequency, setFrequency] = useState<ScheduleFrequency>(schedule?.frequency || "monthly")
  const [autoReset, setAutoReset] = useState(schedule?.auto_reset ?? true)
  const [assignedTo, setAssignedTo] = useState<string[]>(schedule?.assigned_to || [])
  const [saving, setSaving] = useState(false)
  const { users } = useTasks()

  // Only show maintenance workers (workers in maintenance department)
  const maintenanceStaff = users.filter(
    (u) =>
      (u.department === "maintenance" || u.department === "maintenance-dept") &&
      (u.role === "worker" || u.role === "supervisor"),
  )

  const handleSubmit = async () => {
    setSaving(true)
    try {
      const scheduleData: Partial<MaintenanceSchedule> = {
        task_type: taskType,
        area,
        frequency,
        auto_reset: autoReset,
        active: true,
        assigned_to: assignedTo.length > 0 ? assignedTo : null,
      }

      await onSave(scheduleData)
      onClose()
    } catch (error) {
      console.error("Error saving schedule:", error)
      alert("Failed to save schedule. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const handleTaskTypeChange = (newTaskType: MaintenanceTaskType) => {
    setTaskType(newTaskType)
    if (newTaskType === "lift" || newTaskType === "all") {
      setArea("both")
    }
  }

  const getTaskCount = () => {
    if (taskType === "lift") return "4 tasks"
    const roomCount = area === "both" ? 102 : area === "a_block" ? 60 : 42
    if (taskType === "all") {
      const avgTasksPerRoom = 9
      return `~${roomCount * avgTasksPerRoom} tasks`
    }
    return `${roomCount} tasks`
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b-2 border-border">
          <h2 className="text-2xl font-bold text-foreground">{schedule ? "Edit Schedule" : "Create New Schedule"}</h2>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-5">
          {/* Task Type */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">Task Type *</label>
            <select
              value={taskType}
              onChange={(e) => handleTaskTypeChange(e.target.value as MaintenanceTaskType)}
              className="w-full px-4 py-3 border-2 border-border rounded-lg focus:border-ring focus:outline-none bg-background text-foreground"
            >
              {Object.entries(TASK_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Area */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">Target Area *</label>
            <select
              value={area}
              onChange={(e) => setArea(e.target.value as MaintenanceArea)}
              className="w-full px-4 py-3 border-2 border-border rounded-lg focus:border-ring focus:outline-none bg-background text-foreground"
              disabled={taskType === "lift" || taskType === "all"}
            >
              {Object.entries(AREA_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
            {taskType === "lift" && (
              <p className="mt-1 text-sm text-muted-foreground">Lift maintenance applies to both blocks</p>
            )}
            {taskType === "all" && (
              <p className="mt-1 text-sm text-muted-foreground">Complete maintenance applies to both blocks</p>
            )}
          </div>

          {/* Frequency */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">Frequency *</label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as ScheduleFrequency)}
              className="w-full px-4 py-3 border-2 border-border rounded-lg focus:border-ring focus:outline-none bg-background text-foreground"
            >
              {Object.entries(FREQUENCY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-sm text-muted-foreground">
              {frequency === "monthly" && "Tasks must be completed before the end of each month"}
              {frequency === "biweekly" && "Tasks must be completed every 2 weeks"}
              {frequency === "semiannual" && "Tasks must be completed every 6 months"}
            </p>
          </div>

          {/* Assign To */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">Assign To (Optional)</label>
            <div className="border-2 border-border rounded-lg p-4 max-h-48 overflow-y-auto space-y-2 bg-background">
              {maintenanceStaff.length === 0 ? (
                <p className="text-sm text-muted-foreground">No maintenance staff found.</p>
              ) : (
                maintenanceStaff.map((user) => (
                  <div key={user.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`user-${user.id}`}
                      checked={assignedTo.includes(user.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setAssignedTo([...assignedTo, user.id])
                        } else {
                          setAssignedTo(assignedTo.filter((id) => id !== user.id))
                        }
                      }}
                    />
                    <Label htmlFor={`user-${user.id}`} className="text-sm cursor-pointer">
                      {user.name} <span className="text-muted-foreground text-xs">({user.role})</span>
                    </Label>
                  </div>
                ))
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Selected staff will be assigned tasks in a round-robin fashion.
            </p>
          </div>

          {/* Auto Reset */}
          <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
            <input
              type="checkbox"
              id="autoReset"
              checked={autoReset}
              onChange={(e) => setAutoReset(e.target.checked)}
              className="w-5 h-5"
            />
            <label htmlFor="autoReset" className="flex-1 text-sm text-foreground">
              <span className="font-semibold">Auto-reset</span>
              <p className="text-muted-foreground mt-1">
                Automatically generate new tasks and reset completion status based on the selected frequency
              </p>
            </label>
          </div>

          {/* Info Box */}
          <div className="bg-accent border-2 border-border rounded-lg p-4">
            <h4 className="font-semibold text-accent-foreground mb-2">What happens when you save?</h4>
            <ul className="text-sm text-accent-foreground space-y-1">
              <li>
                • Creates {getTaskCount()} for {TASK_TYPE_LABELS[taskType]}
              </li>
              <li>• Tasks visible in worker maintenance calendar immediately</li>
              <li>• Workers must complete tasks before the end of the month</li>
            </ul>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-6 border-t-2 border-border">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 px-6 py-3 border-2 border-border text-foreground font-semibold rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : schedule ? "Update Schedule" : "Create Schedule"}
          </button>
        </div>
      </div>
    </div>
  )
}
