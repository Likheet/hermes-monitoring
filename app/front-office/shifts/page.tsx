"use client"

import { useState } from "react"
import { ProtectedRoute } from "@/components/protected-route"
import { useAuth } from "@/lib/auth-context"
import { useTasks } from "@/lib/task-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Clock, Save, Coffee, Calendar } from "lucide-react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { formatShiftRange } from "@/lib/date-utils"
import { validateBreakTimes } from "@/lib/shift-utils"
import { calculateWorkingHours } from "@/lib/date-utils"
import { WeeklyScheduleView } from "@/components/shift/weekly-schedule-view"

function ShiftManagement() {
  const { user } = useAuth()
  const { users, updateWorkerShift } = useTasks()
  const router = useRouter()
  const { toast } = useToast()

  const workers = users.filter((u) => u.role === "worker")

  const [editingShifts, setEditingShifts] = useState<
    Record<
      string,
      {
        start: string
        end: string
        hasBreak: boolean
        breakStart: string
        breakEnd: string
      }
    >
  >(
    Object.fromEntries(
      workers.map((w) => [
        w.id,
        {
          start: w.shift_start,
          end: w.shift_end,
          hasBreak: w.has_break || false,
          breakStart: w.break_start || "12:00",
          breakEnd: w.break_end || "13:00",
        },
      ]),
    ),
  )

  const handleSaveShift = (workerId: string) => {
    const shift = editingShifts[workerId]

    if (shift.hasBreak) {
      const validation = validateBreakTimes(shift.start, shift.end, shift.breakStart, shift.breakEnd)
      if (!validation.valid) {
        toast({
          title: "Invalid Break Times",
          description: validation.error,
          variant: "destructive",
        })
        return
      }
    }

    updateWorkerShift(workerId, shift.start, shift.end, user!.id, shift.hasBreak, shift.breakStart, shift.breakEnd)
    toast({
      title: "Shift Updated",
      description: "Worker shift timing has been updated successfully",
    })
  }

  const hasChanges = (workerId: string) => {
    const worker = workers.find((w) => w.id === workerId)
    if (!worker) return false
    const edited = editingShifts[worker.id]
    return (
      edited.start !== worker.shift_start ||
      edited.end !== worker.shift_end ||
      edited.hasBreak !== (worker.has_break || false) ||
      edited.breakStart !== (worker.break_start || "12:00") ||
      edited.breakEnd !== (worker.break_end || "13:00")
    )
  }

  const getWorkingHoursDisplay = (
    start: string,
    end: string,
    hasBreak: boolean,
    breakStart: string,
    breakEnd: string,
  ) => {
    const result = calculateWorkingHours(start, end, hasBreak, breakStart, breakEnd)
    return result.formatted
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="container mx-auto flex items-center gap-4 px-4 py-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/front-office")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Shift Management</h1>
            <p className="text-sm text-muted-foreground">Manage worker shift timings and schedules</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-7xl">
        <Tabs defaultValue="current" className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-6">
            <TabsTrigger value="current" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Current Shifts
            </TabsTrigger>
            <TabsTrigger value="schedule" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Schedule
            </TabsTrigger>
          </TabsList>

          <TabsContent value="current" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              {workers.map((worker) => {
                const edited = editingShifts[worker.id]
                const workingHours = getWorkingHoursDisplay(
                  edited.start,
                  edited.end,
                  edited.hasBreak,
                  edited.breakStart,
                  edited.breakEnd,
                )

                return (
                  <Card key={worker.id}>
                    <CardHeader>
                      <CardTitle className="text-lg">{worker.name}</CardTitle>
                      <p className="text-sm text-muted-foreground capitalize">{worker.department}</p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label htmlFor={`start-${worker.id}`}>Shift Start</Label>
                            <Input
                              id={`start-${worker.id}`}
                              type="time"
                              value={edited.start}
                              onChange={(e) =>
                                setEditingShifts((prev) => ({
                                  ...prev,
                                  [worker.id]: { ...prev[worker.id], start: e.target.value },
                                }))
                              }
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label htmlFor={`end-${worker.id}`}>Shift End</Label>
                            <Input
                              id={`end-${worker.id}`}
                              type="time"
                              value={edited.end}
                              onChange={(e) =>
                                setEditingShifts((prev) => ({
                                  ...prev,
                                  [worker.id]: { ...prev[worker.id], end: e.target.value },
                                }))
                              }
                              className="mt-1"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between py-2 border-t">
                          <div className="flex items-center gap-2">
                            <Coffee className="h-4 w-4 text-muted-foreground" />
                            <Label htmlFor={`break-${worker.id}`} className="cursor-pointer">
                              Break Shifts
                            </Label>
                          </div>
                          <Switch
                            id={`break-${worker.id}`}
                            checked={edited.hasBreak}
                            onCheckedChange={(checked) =>
                              setEditingShifts((prev) => ({
                                ...prev,
                                [worker.id]: { ...prev[worker.id], hasBreak: checked },
                              }))
                            }
                          />
                        </div>

                        {edited.hasBreak && (
                          <div className="grid grid-cols-2 gap-3 pl-6 border-l-2 border-muted">
                            <div>
                              <Label htmlFor={`break-start-${worker.id}`} className="text-xs">
                                Break Start
                              </Label>
                              <Input
                                id={`break-start-${worker.id}`}
                                type="time"
                                value={edited.breakStart}
                                onChange={(e) =>
                                  setEditingShifts((prev) => ({
                                    ...prev,
                                    [worker.id]: { ...prev[worker.id], breakStart: e.target.value },
                                  }))
                                }
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label htmlFor={`break-end-${worker.id}`} className="text-xs">
                                Break End
                              </Label>
                              <Input
                                id={`break-end-${worker.id}`}
                                type="time"
                                value={edited.breakEnd}
                                onChange={(e) =>
                                  setEditingShifts((prev) => ({
                                    ...prev,
                                    [worker.id]: { ...prev[worker.id], breakEnd: e.target.value },
                                  }))
                                }
                                className="mt-1"
                              />
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-between text-sm pt-2 border-t">
                          <span className="text-muted-foreground">Working Hours:</span>
                          <span className="font-semibold">{workingHours}</span>
                        </div>

                        <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2 border-t">
                          <Clock className="h-4 w-4" />
                          <span>Current: {formatShiftRange(worker.shift_start, worker.shift_end)}</span>
                        </div>

                        <Button
                          onClick={() => handleSaveShift(worker.id)}
                          disabled={!hasChanges(worker.id)}
                          className="w-full"
                        >
                          <Save className="mr-2 h-4 w-4" />
                          Save Changes
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </TabsContent>

          <TabsContent value="schedule">
            <WeeklyScheduleView workers={workers} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}

export default function ShiftManagementPage() {
  return (
    <ProtectedRoute allowedRoles={["front_office"]}>
      <ShiftManagement />
    </ProtectedRoute>
  )
}
