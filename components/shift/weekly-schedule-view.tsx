"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
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
import { calculateWorkingHours, calculateDualShiftWorkingHours } from "@/lib/date-utils"
import { useTasks } from "@/lib/task-context"
import { validateDualShiftTimes } from "@/lib/shift-utils"
import { cn } from "@/lib/utils"

interface WeeklyScheduleViewProps {
  workers: User[]
}

interface DaySchedule {
  shift_start: string
  shift_end: string
  has_second_shift: boolean
  second_shift_start: string
  second_shift_end: string
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

const timeToMinutes = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number)
  return hours * 60 + minutes
}

export function WeeklyScheduleView({ workers }: WeeklyScheduleViewProps) {
  const { toast } = useToast()
  const { saveShiftSchedule, getShiftSchedules, shiftSchedules } = useTasks()
  const [schedules, setSchedules] = useState<Record<string, WeekSchedule>>({})
  const [loading, setLoading] = useState(true)
  const [, setSelectedWorker] = useState<string | null>(null)
  const [, setSelectedDay] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [weekOffset, setWeekOffset] = useState(0)

  const weekDates = useMemo(() => {
    const today = new Date()
    const currentDay = today.getDay()
    const monday = new Date(today)
    monday.setDate(today.getDate() - (currentDay === 0 ? 6 : currentDay - 1) + weekOffset * 7)

    return DAYS_OF_WEEK.map((_, index) => {
      const date = new Date(monday)
      date.setDate(monday.getDate() + index)
      return date.toISOString().split("T")[0]
    })
  }, [weekOffset])

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

  const loadSchedules = useCallback(() => {
    setLoading(true)
    const newSchedules: Record<string, WeekSchedule> = {}

    for (const worker of workers) {
      const workerSchedule: WeekSchedule = {}

      for (let i = 0; i < weekDates.length; i++) {
        const date = weekDates[i]
        const day = DAYS_OF_WEEK[i]

        const savedSchedules = getShiftSchedules(worker.id, date, date)
        const savedSchedule = savedSchedules[0]

        if (savedSchedule) {
          const hasSecondShift = Boolean(
            savedSchedule.is_dual_shift ||
              savedSchedule.has_shift_2 ||
              (savedSchedule.shift_2_start && savedSchedule.shift_2_end),
          )
          const primaryEnd =
            savedSchedule.shift_1_end ||
            (hasSecondShift && savedSchedule.break_start ? savedSchedule.break_start : undefined) ||
            savedSchedule.shift_end ||
            "18:00"
          const secondShiftStart = hasSecondShift
            ? savedSchedule.shift_2_start || savedSchedule.break_end || "18:00"
            : ""
          const secondShiftEnd = hasSecondShift
            ? savedSchedule.shift_2_end || savedSchedule.shift_end || "21:00"
            : ""

          workerSchedule[day] = {
            shift_start: savedSchedule.shift_1_start || savedSchedule.shift_start || "09:00",
            shift_end: primaryEnd,
            has_second_shift: hasSecondShift,
            second_shift_start: hasSecondShift ? secondShiftStart : "",
            second_shift_end: hasSecondShift ? secondShiftEnd : "",
            is_override: savedSchedule.is_override,
            override_reason: savedSchedule.override_reason || "",
            notes: savedSchedule.notes || "",
          }
        } else {
          const hasSecondShift = Boolean(
            worker.is_dual_shift || worker.has_shift_2 || (worker.shift_2_start && worker.shift_2_end),
          )
          const defaultShiftEnd =
            worker.shift_end ||
            (hasSecondShift && worker.shift_2_start ? worker.shift_2_start : "18:00")
          workerSchedule[day] = {
            shift_start: worker.shift_start || "09:00",
            shift_end: defaultShiftEnd,
            has_second_shift: hasSecondShift,
            second_shift_start: hasSecondShift ? worker.shift_2_start || "" : "",
            second_shift_end: hasSecondShift ? worker.shift_2_end || "" : "",
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
  }, [getShiftSchedules, weekDates, workers])

  useEffect(() => {
    loadSchedules()
  }, [loadSchedules, shiftSchedules])

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
    setSaving(true)

    const dayIndex = DAYS_OF_WEEK.indexOf(day)
    const date = weekDates[dayIndex]

    try {
      if (!schedule.shift_start || !schedule.shift_end) {
        toast({
          title: "Missing shift times",
          description: "Please provide both start and end times for the first shift.",
          variant: "destructive",
        })
        return
      }

      const hasSecondShiftWindow =
        schedule.has_second_shift && Boolean(schedule.second_shift_start && schedule.second_shift_end)

      if (schedule.has_second_shift && !hasSecondShiftWindow) {
        toast({
          title: "Second shift required",
          description: "Please provide both start and end times for the second shift or disable it.",
          variant: "destructive",
        })
        return
      }

      const validation = validateDualShiftTimes(
        schedule.shift_start,
        schedule.shift_end,
        undefined,
        undefined,
        hasSecondShiftWindow ? schedule.second_shift_start : undefined,
        hasSecondShiftWindow ? schedule.second_shift_end : undefined,
        undefined,
        undefined,
      )

      if (!validation.valid) {
        toast({
          title: "Invalid shift configuration",
          description: validation.error,
          variant: "destructive",
        })
        return
      }

      const hasInterShiftBreak =
        hasSecondShiftWindow &&
        timeToMinutes(schedule.second_shift_start) > timeToMinutes(schedule.shift_end)

      const breakStart = hasInterShiftBreak ? schedule.shift_end : undefined
      const breakEnd = hasInterShiftBreak ? schedule.second_shift_start : undefined
      const finalShiftEnd = hasSecondShiftWindow ? schedule.second_shift_end : schedule.shift_end

      saveShiftSchedule({
        worker_id: workerId,
        schedule_date: date,
        shift_start: schedule.shift_start,
        shift_end: finalShiftEnd,
        has_break: Boolean(breakStart && breakEnd),
        break_start: breakStart,
        break_end: breakEnd,
        shift_1_start: schedule.shift_start,
        shift_1_end: schedule.shift_end,
        shift_1_break_start: breakStart,
        shift_1_break_end: breakEnd,
        shift_2_start: hasSecondShiftWindow ? schedule.second_shift_start : undefined,
        shift_2_end: hasSecondShiftWindow ? schedule.second_shift_end : undefined,
        shift_2_break_start: undefined,
        shift_2_break_end: undefined,
        has_shift_2: hasSecondShiftWindow,
        is_dual_shift: hasSecondShiftWindow,
        shift_2_has_break: false,
        is_override: schedule.is_override,
        override_reason: schedule.override_reason,
        notes: schedule.notes,
      })

      toast({
        title: "Schedule Saved",
        description: `Schedule for ${day} has been updated`,
      })
    } catch (error) {
      console.error("Save schedule exception:", error)
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
    const currentSchedule = schedules[workerId]?.[day]
    if (!currentSchedule) {
      console.error("No current schedule found for:", { workerId, day })
      return
    }

    const newSchedule = {
      ...currentSchedule,
      is_override: !currentSchedule.is_override,
      override_reason: !currentSchedule.is_override ? reason : "",
    }

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
                    const isTodayDate = isToday(date)

                    return (
                      <th key={day} className="text-center p-3 font-semibold min-w-[140px]">
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

                      const hasSecondShift =
                        schedule.has_second_shift &&
                        Boolean(schedule.second_shift_start && schedule.second_shift_end)

                      const hasInterShiftBreak =
                        hasSecondShift &&
                        timeToMinutes(schedule.second_shift_start) > timeToMinutes(schedule.shift_end)

                      const workingHours = hasSecondShift
                        ? calculateDualShiftWorkingHours(
                            schedule.shift_start,
                            schedule.shift_end,
                            false,
                            undefined,
                            undefined,
                            schedule.second_shift_start,
                            schedule.second_shift_end,
                            false,
                            undefined,
                            undefined,
                          )
                        : calculateWorkingHours(
                            schedule.shift_start,
                            schedule.shift_end,
                            false,
                            undefined,
                            undefined,
                          )

                      return (
                        <td key={day} className="p-2">
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
                                    {hasSecondShift && (
                                      <div className="text-xs font-semibold">
                                        Shift 2: {schedule.second_shift_start} - {schedule.second_shift_end}
                                      </div>
                                    )}
                                    {hasInterShiftBreak && (
                                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <Coffee className="h-3 w-3" />
                                        {schedule.shift_end}-{schedule.second_shift_start}
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
                                      <Label>Enable Second Shift</Label>
                                      <Switch
                                        checked={schedule.has_second_shift}
                                        onCheckedChange={(checked) =>
                                          updateSchedule(worker.id, day, {
                                            has_second_shift: checked,
                                            second_shift_start: checked
                                              ? schedule.second_shift_start || schedule.shift_end
                                              : "",
                                            second_shift_end: checked
                                              ? schedule.second_shift_end || schedule.shift_end
                                              : "",
                                          })
                                        }
                                      />
                                    </div>

                                    {schedule.has_second_shift && (
                                      <div className="grid grid-cols-2 gap-3">
                                        <div>
                                          <Label>Second Shift Start</Label>
                                          <Input
                                            type="time"
                                            value={schedule.second_shift_start}
                                            onChange={(e) =>
                                              updateSchedule(worker.id, day, { second_shift_start: e.target.value })
                                            }
                                          />
                                        </div>
                                        <div>
                                          <Label>Second Shift End</Label>
                                          <Input
                                            type="time"
                                            value={schedule.second_shift_end}
                                            onChange={(e) =>
                                              updateSchedule(worker.id, day, { second_shift_end: e.target.value })
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
