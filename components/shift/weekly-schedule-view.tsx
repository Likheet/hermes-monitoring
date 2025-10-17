"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar, Coffee, Save, Umbrella, Plane, ChevronLeft, ChevronRight } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { User } from "@/lib/types"
import { calculateWorkingHours } from "@/lib/date-utils"
import { useTasks } from "@/lib/task-context"
import { cn } from "@/lib/utils"

interface WeeklyScheduleViewProps {
  workers: User[]
}

interface DaySchedule {
  shift_start: string
  shift_end: string
  has_break: boolean
  break_start: string
  break_end: string
  is_override: boolean
  override_reason: string
  notes: string
}

type WeekSchedule = Record<string, DaySchedule>

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

const OVERRIDE_REASONS = [
  { value: "holiday", label: "Holiday", icon: Umbrella },
  { value: "leave", label: "Took Leave", icon: Plane },
  { value: "sick", label: "Sick Leave", icon: Umbrella },
  { value: "emergency", label: "Emergency", icon: Umbrella },
]

export function WeeklyScheduleView({ workers }: WeeklyScheduleViewProps) {
  const { toast } = useToast()
  const { saveShiftSchedule, getShiftSchedules } = useTasks()
  const [schedules, setSchedules] = useState<Record<string, WeekSchedule>>({})
  const [loading, setLoading] = useState(true)
  const [selectedWorker, setSelectedWorker] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [weekOffset, setWeekOffset] = useState(0)

  const getWeekDates = () => {
    const today = new Date()
    const currentDay = today.getDay()
    const monday = new Date(today)
    monday.setDate(today.getDate() - (currentDay === 0 ? 6 : currentDay - 1) + weekOffset * 7)

    return DAYS_OF_WEEK.map((_, index) => {
      const date = new Date(monday)
      date.setDate(monday.getDate() + index)
      return date.toISOString().split("T")[0]
    })
  }

  const weekDates = getWeekDates()

  const isPastDate = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return date < today
  }

  const isToday = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    )
  }

  useEffect(() => {
    console.log("[v0] WeeklyScheduleView mounted with workers:", workers.length)
    loadSchedules()
  }, [weekOffset])

  const loadSchedules = () => {
    console.log("[v0] Loading schedules for workers:", workers.length)
    setLoading(true)
    const newSchedules: Record<string, WeekSchedule> = {}

    for (const worker of workers) {
      console.log("[v0] Loading schedule for worker:", worker.name, "ID:", worker.id)
      const workerSchedule: WeekSchedule = {}

      for (let i = 0; i < weekDates.length; i++) {
        const date = weekDates[i]
        const day = DAYS_OF_WEEK[i]

        const savedSchedules = getShiftSchedules(worker.id, date, date)
        const savedSchedule = savedSchedules[0]

        if (savedSchedule) {
          console.log("[v0] Loaded schedule for", worker.name, day, savedSchedule)
          workerSchedule[day] = {
            shift_start: savedSchedule.shift_start,
            shift_end: savedSchedule.shift_end,
            has_break: savedSchedule.has_break,
            break_start: savedSchedule.break_start || "12:00",
            break_end: savedSchedule.break_end || "13:00",
            is_override: savedSchedule.is_override,
            override_reason: savedSchedule.override_reason || "",
            notes: savedSchedule.notes || "",
          }
        } else {
          console.log("[v0] No schedule found, using default shift for", worker.name, day)
          workerSchedule[day] = {
            shift_start: worker.shift_start,
            shift_end: worker.shift_end,
            has_break: worker.has_break,
            break_start: worker.break_start || "12:00",
            break_end: worker.break_end || "13:00",
            is_override: false,
            override_reason: "",
            notes: "",
          }
        }
      }

      newSchedules[worker.id] = workerSchedule
    }

    setSchedules(newSchedules)
    setLoading(false)
    console.log("[v0] Schedules loaded successfully")
  }

  const updateSchedule = (workerId: string, day: string, updates: Partial<DaySchedule>) => {
    setSchedules((prev) => ({
      ...prev,
      [workerId]: {
        ...prev[workerId],
        [day]: {
          ...prev[workerId][day],
          ...updates,
        },
      },
    }))
  }

  const saveSchedule = (workerId: string, day: string, schedule: DaySchedule) => {
    console.log("[v0] Saving schedule:", { workerId, day, schedule })
    setSaving(true)

    const dayIndex = DAYS_OF_WEEK.indexOf(day)
    const date = weekDates[dayIndex]

    try {
      saveShiftSchedule({
        worker_id: workerId,
        schedule_date: date,
        shift_start: schedule.shift_start,
        shift_end: schedule.shift_end,
        has_break: schedule.has_break,
        break_start: schedule.break_start,
        break_end: schedule.break_end,
        is_override: schedule.is_override,
        override_reason: schedule.override_reason,
        notes: schedule.notes,
      })

      console.log("[v0] Schedule saved successfully")
      toast({
        title: "Schedule Saved",
        description: `Schedule for ${day} has been updated`,
      })
    } catch (error) {
      console.error("[v0] Save schedule exception:", error)
      toast({
        title: "Error",
        description: `Failed to save schedule: ${error instanceof Error ? error.message : "Unknown error"}`,
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const toggleOverride = (workerId: string, day: string, reason: string) => {
    console.log("[v0] toggleOverride called:", { workerId, day, reason })
    const currentSchedule = schedules[workerId]?.[day]
    if (!currentSchedule) {
      console.error("[v0] No current schedule found for:", { workerId, day })
      return
    }

    const newSchedule = {
      ...currentSchedule,
      is_override: !currentSchedule.is_override,
      override_reason: !currentSchedule.is_override ? reason : "",
    }

    console.log("[v0] New schedule after toggle:", newSchedule)
    updateSchedule(workerId, day, newSchedule)
    saveSchedule(workerId, day, newSchedule)
  }

  if (loading) {
    return <div className="text-center py-8">Loading schedules...</div>
  }

  const weekStart = new Date(weekDates[0])
  const weekEnd = new Date(weekDates[6])
  const weekRangeText = `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Weekly Schedule
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Assign shifts for each worker for every day of the week. Click on a day to edit shift details.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setWeekOffset((prev) => prev - 1)}>
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <div className="text-sm font-medium px-3">{weekRangeText}</div>
              <Button variant="outline" size="sm" onClick={() => setWeekOffset((prev) => prev + 1)}>
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-semibold">Worker</th>
                  {DAYS_OF_WEEK.map((day, index) => {
                    const date = weekDates[index]
                    const isPast = isPastDate(date)
                    const isTodayDate = isToday(date)

                    return (
                      <th
                        key={day}
                        className={cn(
                          "text-center p-3 font-semibold min-w-[140px]",
                          isPast && "bg-muted/30",
                          isTodayDate && "bg-primary/10 border-2 border-primary/30",
                        )}
                      >
                        <div className="text-sm">{day}</div>
                        <div className="text-xs text-muted-foreground font-normal">
                          {new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </div>
                        {isTodayDate && <Badge className="mt-1 text-xs">Today</Badge>}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {workers.map((worker) => (
                  <tr key={worker.id} className="border-b hover:bg-muted/50">
                    <td className="p-3">
                      <div className="font-medium">{worker.name}</div>
                      <div className="text-xs text-muted-foreground capitalize">{worker.department}</div>
                    </td>
                    {DAYS_OF_WEEK.map((day, index) => {
                      const schedule = schedules[worker.id]?.[day]
                      if (!schedule) return <td key={day} className="p-2" />

                      const date = weekDates[index]
                      const isPast = isPastDate(date)
                      const isTodayDate = isToday(date)

                      const workingHours = calculateWorkingHours(
                        schedule.shift_start,
                        schedule.shift_end,
                        schedule.has_break,
                        schedule.break_start,
                        schedule.break_end,
                      )

                      return (
                        <td
                          key={day}
                          className={cn(
                            "p-2",
                            isPast && "bg-muted/30",
                            isTodayDate && "bg-primary/10 border-2 border-primary/30",
                          )}
                        >
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant={schedule.is_override ? "secondary" : "outline"}
                                className={cn(
                                  "w-full h-auto flex flex-col items-start p-2 gap-1",
                                  isPast && "opacity-60",
                                  isTodayDate && "ring-2 ring-primary/50",
                                )}
                                onClick={() => {
                                  setSelectedWorker(worker.id)
                                  setSelectedDay(day)
                                }}
                              >
                                {schedule.is_override ? (
                                  <Badge variant="secondary" className="text-xs">
                                    {OVERRIDE_REASONS.find((r) => r.value === schedule.override_reason)?.label || "Off"}
                                  </Badge>
                                ) : (
                                  <>
                                    <div className="text-xs font-semibold">
                                      {schedule.shift_start} - {schedule.shift_end}
                                    </div>
                                    {schedule.has_break && (
                                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <Coffee className="h-3 w-3" />
                                        {schedule.break_start}-{schedule.break_end}
                                      </div>
                                    )}
                                    <div className="text-xs text-muted-foreground">{workingHours.formatted}</div>
                                  </>
                                )}
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>
                                  {worker.name} - {day}
                                </DialogTitle>
                                <DialogDescription>
                                  Edit shift schedule for{" "}
                                  {new Date(weekDates[DAYS_OF_WEEK.indexOf(day)]).toLocaleDateString("en-US", {
                                    weekday: "long",
                                    month: "long",
                                    day: "numeric",
                                  })}
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                  <Label>Mark as Off Duty</Label>
                                  <Select
                                    value={schedule.is_override ? schedule.override_reason : "working"}
                                    onValueChange={(value) => {
                                      if (value === "working") {
                                        updateSchedule(worker.id, day, {
                                          is_override: false,
                                          override_reason: "",
                                        })
                                      } else {
                                        toggleOverride(worker.id, day, value)
                                      }
                                    }}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="working">Working</SelectItem>
                                      {OVERRIDE_REASONS.map((reason) => (
                                        <SelectItem key={reason.value} value={reason.value}>
                                          {reason.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>

                                {!schedule.is_override && (
                                  <>
                                    <div className="grid grid-cols-2 gap-3">
                                      <div>
                                        <Label>Shift Start</Label>
                                        <Input
                                          type="time"
                                          value={schedule.shift_start}
                                          onChange={(e) =>
                                            updateSchedule(worker.id, day, { shift_start: e.target.value })
                                          }
                                        />
                                      </div>
                                      <div>
                                        <Label>Shift End</Label>
                                        <Input
                                          type="time"
                                          value={schedule.shift_end}
                                          onChange={(e) =>
                                            updateSchedule(worker.id, day, { shift_end: e.target.value })
                                          }
                                        />
                                      </div>
                                    </div>

                                    <div className="flex items-center justify-between">
                                      <Label>Has Break</Label>
                                      <Switch
                                        checked={schedule.has_break}
                                        onCheckedChange={(checked) =>
                                          updateSchedule(worker.id, day, { has_break: checked })
                                        }
                                      />
                                    </div>

                                    {schedule.has_break && (
                                      <div className="grid grid-cols-2 gap-3">
                                        <div>
                                          <Label>Break Start</Label>
                                          <Input
                                            type="time"
                                            value={schedule.break_start}
                                            onChange={(e) =>
                                              updateSchedule(worker.id, day, { break_start: e.target.value })
                                            }
                                          />
                                        </div>
                                        <div>
                                          <Label>Break End</Label>
                                          <Input
                                            type="time"
                                            value={schedule.break_end}
                                            onChange={(e) =>
                                              updateSchedule(worker.id, day, { break_end: e.target.value })
                                            }
                                          />
                                        </div>
                                      </div>
                                    )}
                                  </>
                                )}

                                <div>
                                  <Label>Notes</Label>
                                  <Input
                                    value={schedule.notes}
                                    onChange={(e) => updateSchedule(worker.id, day, { notes: e.target.value })}
                                    placeholder="Add any notes..."
                                  />
                                </div>

                                <Button
                                  onClick={() => saveSchedule(worker.id, day, schedule)}
                                  className="w-full"
                                  disabled={saving}
                                >
                                  <Save className="mr-2 h-4 w-4" />
                                  {saving ? "Saving..." : "Save Schedule"}
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
