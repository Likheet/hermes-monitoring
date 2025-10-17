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
import { Calendar, Coffee, Save, Umbrella, Plane } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"
import type { User } from "@/lib/types"
import { calculateWorkingHours } from "@/lib/date-utils"

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
  const supabase = createClient()
  const [schedules, setSchedules] = useState<Record<string, WeekSchedule>>({})
  const [loading, setLoading] = useState(true)
  const [selectedWorker, setSelectedWorker] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  // Get the current week's dates
  const getWeekDates = () => {
    const today = new Date()
    const currentDay = today.getDay()
    const monday = new Date(today)
    monday.setDate(today.getDate() - (currentDay === 0 ? 6 : currentDay - 1))

    return DAYS_OF_WEEK.map((_, index) => {
      const date = new Date(monday)
      date.setDate(monday.getDate() + index)
      return date.toISOString().split("T")[0]
    })
  }

  const weekDates = getWeekDates()

  // Load schedules from database
  useEffect(() => {
    loadSchedules()
  }, [])

  const loadSchedules = async () => {
    setLoading(true)
    const newSchedules: Record<string, WeekSchedule> = {}

    for (const worker of workers) {
      const workerSchedule: WeekSchedule = {}

      for (let i = 0; i < weekDates.length; i++) {
        const date = weekDates[i]
        const { data, error } = await supabase
          .from("shift_schedules")
          .select("*")
          .eq("worker_id", worker.id)
          .eq("schedule_date", date)
          .single()

        if (data) {
          workerSchedule[DAYS_OF_WEEK[i]] = {
            shift_start: data.shift_start,
            shift_end: data.shift_end,
            has_break: data.has_break,
            break_start: data.break_start || "12:00",
            break_end: data.break_end || "13:00",
            is_override: data.is_override,
            override_reason: data.override_reason || "",
            notes: data.notes || "",
          }
        } else {
          // Use worker's default shift
          workerSchedule[DAYS_OF_WEEK[i]] = {
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
  }

  const saveSchedule = async (workerId: string, day: string, schedule: DaySchedule) => {
    const dayIndex = DAYS_OF_WEEK.indexOf(day)
    const date = weekDates[dayIndex]

    const { error } = await supabase.from("shift_schedules").upsert(
      {
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
      },
      { onConflict: "worker_id,schedule_date" },
    )

    if (error) {
      toast({
        title: "Error",
        description: "Failed to save schedule",
        variant: "destructive",
      })
    } else {
      toast({
        title: "Schedule Saved",
        description: `Schedule for ${day} has been updated`,
      })
      loadSchedules()
    }
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

  const toggleOverride = (workerId: string, day: string, reason: string) => {
    const currentSchedule = schedules[workerId]?.[day]
    if (!currentSchedule) return

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

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Weekly Schedule
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Assign shifts for each worker for every day of the week. Click on a day to edit shift details.
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-semibold">Worker</th>
                  {DAYS_OF_WEEK.map((day, index) => (
                    <th key={day} className="text-center p-3 font-semibold min-w-[140px]">
                      <div className="text-sm">{day}</div>
                      <div className="text-xs text-muted-foreground font-normal">
                        {new Date(weekDates[index]).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {workers.map((worker) => (
                  <tr key={worker.id} className="border-b hover:bg-muted/50">
                    <td className="p-3">
                      <div className="font-medium">{worker.name}</div>
                      <div className="text-xs text-muted-foreground capitalize">{worker.department}</div>
                    </td>
                    {DAYS_OF_WEEK.map((day) => {
                      const schedule = schedules[worker.id]?.[day]
                      if (!schedule) return <td key={day} className="p-2" />

                      const workingHours = calculateWorkingHours(
                        schedule.shift_start,
                        schedule.shift_end,
                        schedule.has_break,
                        schedule.break_start,
                        schedule.break_end,
                      )

                      return (
                        <td key={day} className="p-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant={schedule.is_override ? "secondary" : "outline"}
                                className="w-full h-auto flex flex-col items-start p-2 gap-1"
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

                                <Button onClick={() => saveSchedule(worker.id, day, schedule)} className="w-full">
                                  <Save className="mr-2 h-4 w-4" />
                                  Save Schedule
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
