"use client"

import { useState } from "react"
import { useTasks } from "@/lib/task-context"
import { Calendar, Plus, Edit2, Trash2, ToggleLeft, ToggleRight } from "lucide-react"
import { TASK_TYPE_LABELS, AREA_LABELS, FREQUENCY_LABELS, type MaintenanceSchedule } from "@/lib/maintenance-types"
import { MaintenanceScheduleHelp } from "./maintenance-schedule-help"

interface ScheduleListProps {
  onCreateNew: () => void
  onEdit: (schedule: MaintenanceSchedule) => void
}

export function MaintenanceScheduleList({ onCreateNew, onEdit }: ScheduleListProps) {
  const { schedules, toggleSchedule, deleteSchedule: deleteScheduleFromContext } = useTasks()
  const [currentMonth] = useState(new Date().getMonth() + 1)
  const [currentYear] = useState(new Date().getFullYear())

  const handleToggleSchedule = (scheduleId: string) => {
    toggleSchedule(scheduleId)
  }

  const handleDeleteSchedule = (scheduleId: string) => {
    if (!confirm("Are you sure you want to delete this schedule? This will remove all associated tasks.")) {
      return
    }
    deleteScheduleFromContext(scheduleId)
  }

  const getCompletionStats = (schedule: MaintenanceSchedule) => {
    // Mock data - replace with actual query
    return { completed: 0, total: schedule.area === "both" ? 72 : schedule.area === "a_block" ? 30 : 42 }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Maintenance Schedules</h2>
          <p className="text-muted-foreground">
            {new Date(currentYear, currentMonth - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </p>
        </div>
        <button
          onClick={onCreateNew}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 font-medium"
        >
          <Plus className="w-5 h-5" />
          Create Schedule
        </button>
      </div>

      {/* Help Section for New Admins */}
      <MaintenanceScheduleHelp />

      {/* Schedules Table */}
      {schedules.length === 0 ? (
        <div className="text-center py-12 bg-muted/50 rounded-xl border-2 border-border">
          <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-foreground mb-1">No Schedules Configured</h3>
          <p className="text-muted-foreground mb-4">Create your first maintenance schedule to get started</p>
          <button
            onClick={onCreateNew}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 font-medium"
          >
            Create Schedule
          </button>
        </div>
      ) : (
        <div className="bg-card border-2 border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50 border-b-2 border-border">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Task Type</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Area</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Frequency</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Schedule Days</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Progress</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Status</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {schedules.map((schedule) => {
                const stats = getCompletionStats(schedule)
                const percentage = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0

                return (
                  <tr key={schedule.id} className="hover:bg-muted/30">
                    <td className="px-6 py-4">
                      <span className="font-medium text-foreground">{TASK_TYPE_LABELS[schedule.task_type]}</span>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{AREA_LABELS[schedule.area]}</td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {FREQUENCY_LABELS[schedule.frequency]}
                      {schedule.frequency === "custom" && schedule.frequency_weeks && (
                        <span className="text-sm"> ({schedule.frequency_weeks}w)</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      Days {schedule.day_range_start}-{schedule.day_range_end}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 bg-muted rounded-full h-2 max-w-[100px]">
                          <div className="bg-primary h-2 rounded-full" style={{ width: `${percentage}%` }} />
                        </div>
                        <span className="text-sm font-medium text-foreground">
                          {stats.completed}/{stats.total}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button onClick={() => handleToggleSchedule(schedule.id)} className="flex items-center gap-2">
                        {schedule.active ? (
                          <>
                            <ToggleRight className="w-5 h-5 text-primary" />
                            <span className="text-sm font-medium text-primary">Active</span>
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="w-5 h-5 text-muted-foreground" />
                            <span className="text-sm font-medium text-muted-foreground">Inactive</span>
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => onEdit(schedule)}
                          className="p-2 hover:bg-muted rounded-lg transition-colors"
                          title="Edit schedule"
                        >
                          <Edit2 className="w-4 h-4 text-muted-foreground" />
                        </button>
                        <button
                          onClick={() => handleDeleteSchedule(schedule.id)}
                          className="p-2 hover:bg-destructive/10 rounded-lg transition-colors"
                          title="Delete schedule"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-muted/50 border-2 border-border rounded-xl p-4">
        <h3 className="font-semibold text-foreground mb-2">Quick Setup</h3>
        <p className="text-sm text-muted-foreground mb-3">
          Generate a standard monthly maintenance schedule for all rooms
        </p>
        <button
          onClick={() => {
            alert(
              "This will create standard monthly schedules for AC Indoor, AC Outdoor, Fan, and Exhaust for all rooms",
            )
          }}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 font-medium text-sm"
        >
          Generate Monthly Template
        </button>
      </div>
    </div>
  )
}
