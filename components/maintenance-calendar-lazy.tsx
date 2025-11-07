"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar, Clock, CheckCircle, AlertCircle, Plus, Filter } from "lucide-react"
import type { MaintenanceTask, MaintenanceSchedule } from "@/lib/maintenance-types"

interface LazyMaintenanceCalendarProps {
  maintenanceTasks: MaintenanceTask[]
  maintenanceSchedules: MaintenanceSchedule[]
}

// Calendar view helper
interface CalendarDay {
  date: Date
  tasks: MaintenanceTask[]
  isToday: boolean
  isCurrentMonth: boolean
}

function resolveTaskDate(task: MaintenanceTask): Date | null {
  const rawDate = task.completed_at ?? task.started_at ?? task.created_at
  if (!rawDate) return null
  const parsed = new Date(rawDate)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function getCalendarDays(
  year: number,
  month: number,
  tasks: MaintenanceTask[]
): CalendarDay[] {
  const firstDay = new Date(year, month, 1)
  const startDate = new Date(firstDay)
  startDate.setDate(startDate.getDate() - firstDay.getDay())

  const today = new Date()
  const days: CalendarDay[] = []

  for (let i = 0; i < 42; i++) {
    const currentDate = new Date(startDate)
    currentDate.setDate(startDate.getDate() + i)

    const dayTasks = tasks.filter(task => {
      const taskDate = resolveTaskDate(task)
      if (!taskDate) return false
      return (
        taskDate.getDate() === currentDate.getDate() &&
        taskDate.getMonth() === currentDate.getMonth() &&
        taskDate.getFullYear() === currentDate.getFullYear()
      )
    })

    days.push({
      date: currentDate,
      tasks: dayTasks,
      isToday: (
        currentDate.getDate() === today.getDate() &&
        currentDate.getMonth() === today.getMonth() &&
        currentDate.getFullYear() === today.getFullYear()
      ),
      isCurrentMonth: currentDate.getMonth() === month
    })
  }

  return days
}

export function LazyMaintenanceCalendar({ maintenanceTasks, maintenanceSchedules }: LazyMaintenanceCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  const currentYear = currentDate.getFullYear()
  const currentMonth = currentDate.getMonth()
  const activeSchedules = useMemo(
    () => maintenanceSchedules.filter(schedule => schedule.active).length,
    [maintenanceSchedules]
  )

  const calendarDays = useMemo(() =>
    getCalendarDays(currentYear, currentMonth, maintenanceTasks),
    [currentYear, currentMonth, maintenanceTasks]
  )

  const selectedDateTasks = useMemo(() => {
    if (!selectedDate) return []
    return maintenanceTasks.filter(task => {
      const taskDate = resolveTaskDate(task)
      if (!taskDate) return false
      return (
        taskDate.getDate() === selectedDate.getDate() &&
        taskDate.getMonth() === selectedDate.getMonth() &&
        taskDate.getFullYear() === selectedDate.getFullYear()
      )
    })
  }, [selectedDate, maintenanceTasks])

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ]

  const navigateMonth = (direction: number) => {
    setCurrentDate(prev => {
      const newDate = new Date(prev)
      newDate.setMonth(prev.getMonth() + direction)
      return newDate
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-green-500"
      case "in_progress": return "bg-blue-500"
      case "pending": return "bg-yellow-500"
      case "overdue": return "bg-red-500"
      default: return "bg-gray-500"
    }
  }

  const getStatusVariant = (status: MaintenanceTask["status"]) => {
    switch (status) {
      case "completed":
        return "default"
      case "in_progress":
        return "secondary"
      case "paused":
        return "outline"
      case "pending":
        return "outline"
      default:
        return "secondary"
    }
  }

  return (
    <div className="space-y-6">
      {/* Calendar Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {monthNames[currentMonth]} {currentYear}
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="gap-1">
                <Filter className="h-3 w-3" />
                {maintenanceSchedules.length} schedules
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <CheckCircle className="h-3 w-3" />
                {activeSchedules} active
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateMonth(-1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentDate(new Date())}
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateMonth(1)}
              >
                Next
              </Button>
              <Button variant="secondary" size="sm" className="gap-1" disabled>
                <Plus className="h-3 w-3" />
                New task
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Weekday headers */}
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
              <div key={day} className="text-center text-sm font-medium p-2">
                {day}
              </div>
            ))}

            {/* Calendar days */}
            {calendarDays.map((day, index) => (
              <div
                key={index}
                className={`
                  border rounded p-2 min-h-[80px] cursor-pointer transition-colors
                  ${day.isCurrentMonth ? "bg-background" : "bg-muted/30"}
                  ${day.isToday ? "ring-2 ring-primary" : ""}
                  ${selectedDate?.toDateString() === day.date.toDateString() ? "bg-primary/10" : ""}
                  hover:bg-muted/50
                `}
                onClick={() => setSelectedDate(day.date)}
              >
                <div className="text-sm font-medium mb-1">
                  {day.date.getDate()}
                </div>
                <div className="space-y-1">
                  {day.tasks.slice(0, 2).map((task, taskIndex) => (
                    <div
                      key={taskIndex}
                      className="text-xs p-1 rounded bg-primary/10 truncate"
                      title={task.task_type}
                    >
                      {task.task_type}
                    </div>
                  ))}
                  {day.tasks.length > 2 && (
                    <div className="text-xs text-muted-foreground">
                      +{day.tasks.length - 2} more
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Selected Date Tasks */}
      {selectedDate && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Tasks for {selectedDate.toLocaleDateString()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedDateTasks.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No maintenance tasks scheduled for this date
              </div>
            ) : (
              <div className="space-y-4">
                {selectedDateTasks.map(task => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium">{task.task_type}</h4>
                        <Badge variant={getStatusVariant(task.status)}>
                          {task.status.replace("_", " ")}
                        </Badge>
                        <Badge variant="outline">{task.location}</Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>Room: {task.room_number}</span>
                        <span>Location: {task.location}</span>
                        <span>
                          Duration: {task.expected_duration_minutes ?? Math.round((task.timer_duration ?? 0) / 60)}min
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${getStatusColor(task.status)}`} />
                      <span className="text-sm capitalize">{task.status.replace('_', ' ')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {maintenanceTasks.filter(t => t.status === "completed").length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              In Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {maintenanceTasks.filter(t => t.status === "in_progress").length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {maintenanceTasks.filter(t => t.status === "pending").length}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
