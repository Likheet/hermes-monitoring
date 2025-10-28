"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
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
import { formatShiftRange, formatShiftTime, calculateWorkingHours, calculateDualShiftWorkingHours } from "@/lib/date-utils"
import { validateDualShiftTimes, getWorkerShiftForDate, timeToMinutes } from "@/lib/shift-utils"
import { WeeklyScheduleView } from "@/components/shift/weekly-schedule-view"
import { DualShiftUI } from "./dual-shift-ui"

function ShiftManagement() {
  const { user } = useAuth()
  const { users, updateWorkerShift, shiftSchedules, saveShiftSchedule } = useTasks()
  const router = useRouter()
  const { toast } = useToast()

  const workers = useMemo(() => users.filter((u) => u.role === "worker"), [users])

  const today = useMemo(() => new Date(), [])

  type ShiftEditorState = {
    shift1Start: string
    shift1End: string
    hasSecondShift: boolean
    shift2Start: string
    shift2End: string
  }

  const [editingShifts, setEditingShifts] = useState<Record<string, ShiftEditorState>>({})

  const [offDutyStatus, setOffDutyStatus] = useState<Record<string, boolean>>({})

  const normalizeShiftState = useCallback((state: ShiftEditorState): ShiftEditorState => {
    const hasSecondShift = Boolean(state.hasSecondShift && state.shift2Start && state.shift2End)
    return {
      shift1Start: state.shift1Start,
      shift1End: state.shift1End,
      hasSecondShift,
      shift2Start: hasSecondShift ? state.shift2Start : "",
      shift2End: hasSecondShift ? state.shift2End : "",
    }
  }, [])

  const updateEditingShift = (workerId: string, updates: Partial<ShiftEditorState>) => {
    setEditingShifts((prev) => {
      const current = prev[workerId]
      if (!current) return prev
      const nextState = normalizeShiftState({ ...current, ...updates })
      if (
        current.shift1Start === nextState.shift1Start &&
        current.shift1End === nextState.shift1End &&
        current.hasSecondShift === nextState.hasSecondShift &&
        current.shift2Start === nextState.shift2Start &&
        current.shift2End === nextState.shift2End
      ) {
        return prev
      }

      return {
        ...prev,
        [workerId]: nextState,
      }
    })
  }

  useEffect(() => {
    const nextEditing = Object.fromEntries(
      workers.map((worker) => {
        const todayShift = getWorkerShiftForDate(worker, today, shiftSchedules)
        const hasSecondShift = Boolean(
          (todayShift.is_dual_shift || todayShift.has_shift_2) && todayShift.shift_2_start && todayShift.shift_2_end,
        )

        const shift1Start = todayShift.shift_1_start || todayShift.shift_start || ""
        const shift1End =
          todayShift.shift_1_end ||
          (hasSecondShift ? todayShift.break_start || todayShift.shift_2_start || "" : todayShift.shift_end || "")
        const shift2Start = hasSecondShift ? todayShift.shift_2_start || "" : ""
        const shift2End = hasSecondShift ? todayShift.shift_2_end || todayShift.shift_end || "" : ""

        const initialState: ShiftEditorState = {
          shift1Start,
          shift1End,
          hasSecondShift,
          shift2Start,
          shift2End,
        }

        return [worker.id, normalizeShiftState(initialState)]
      }),
    )

    const nextOffDuty = Object.fromEntries(
      workers.map((worker) => {
        const todayShift = getWorkerShiftForDate(worker, today, shiftSchedules)
        return [worker.id, todayShift.is_override || false]
      }),
    )

    setEditingShifts(nextEditing)
    setOffDutyStatus(nextOffDuty)
  }, [shiftSchedules, today, workers, normalizeShiftState])

  const handleSaveShift = (workerId: string) => {
    const shift = editingShifts[workerId]
    if (!shift) return

    const hasSecondShift = Boolean(shift.hasSecondShift && shift.shift2Start && shift.shift2End)

    const validation = validateDualShiftTimes(
      shift.shift1Start,
      shift.shift1End,
      undefined,
      undefined,
      hasSecondShift ? shift.shift2Start : undefined,
      hasSecondShift ? shift.shift2End : undefined,
      undefined,
      undefined,
    )

    if (!validation.valid) {
      toast({
        title: "Invalid Shift Configuration",
        description: validation.error,
        variant: "destructive",
      })
      return
    }

    const hasInterShiftBreak = Boolean(
      hasSecondShift &&
        shift.shift1End &&
        shift.shift2Start &&
        timeToMinutes(shift.shift2Start) > timeToMinutes(shift.shift1End),
    )
    const breakStart = hasInterShiftBreak ? shift.shift1End : undefined
    const breakEnd = hasInterShiftBreak ? shift.shift2Start : undefined

    updateWorkerShift(
      workerId,
      shift.shift1Start,
      hasSecondShift ? shift.shift2End : shift.shift1End,
      user!.id,
      {
        breakStart,
        breakEnd,
        shift2Start: hasSecondShift ? shift.shift2Start : undefined,
        shift2End: hasSecondShift ? shift.shift2End : undefined,
      },
    )
    toast({
      title: "Shift Updated",
      description: "Worker shift timing has been updated successfully",
    })
  }

  const handleOffDutyToggle = (workerId: string, isOffDuty: boolean) => {
    setOffDutyStatus((prev) => ({ ...prev, [workerId]: isOffDuty }))

    const worker = workers.find((w) => w.id === workerId)
    if (!worker) return

    const todayDate = today.toISOString().split("T")[0]
    const edited = editingShifts[workerId]

    const hasSecondShift = Boolean(edited.hasSecondShift && edited.shift2Start && edited.shift2End)
    const hasInterShiftBreak = Boolean(
      hasSecondShift &&
        edited.shift1End &&
        edited.shift2Start &&
        timeToMinutes(edited.shift2Start) > timeToMinutes(edited.shift1End),
    )
    const breakStart = hasInterShiftBreak ? edited.shift1End : undefined
    const breakEnd = hasInterShiftBreak ? edited.shift2Start : undefined

    saveShiftSchedule({
      worker_id: workerId,
      schedule_date: todayDate,
      shift_start: edited.shift1Start,
      shift_end: hasSecondShift ? edited.shift2End : edited.shift1End,
      has_break: hasInterShiftBreak,
      break_start: breakStart,
      break_end: breakEnd,
      shift_1_start: edited.shift1Start,
      shift_1_end: edited.shift1End,
      shift_1_break_start: undefined,
      shift_1_break_end: undefined,
      shift_2_start: hasSecondShift ? edited.shift2Start : undefined,
      shift_2_end: hasSecondShift ? edited.shift2End : undefined,
      shift_2_break_start: undefined,
      shift_2_break_end: undefined,
      has_shift_2: hasSecondShift,
      is_dual_shift: hasSecondShift,
      shift_2_has_break: false,
      is_override: isOffDuty,
      override_reason: isOffDuty ? "leave" : "",
      notes: "",
    })

    toast({
      title: isOffDuty ? "Marked Off Duty" : "Marked On Duty",
      description: `${worker.name} has been ${isOffDuty ? "marked as off duty" : "marked as on duty"} for today`,
    })
  }

  const hasChanges = (workerId: string) => {
    const worker = workers.find((w) => w.id === workerId)
    if (!worker) return false

    const todayShift = getWorkerShiftForDate(worker, today, shiftSchedules)
    const defaultHasSecondShift = Boolean(
      (todayShift.is_dual_shift || todayShift.has_shift_2) && todayShift.shift_2_start && todayShift.shift_2_end,
    )
    const defaultShift1Start = todayShift.shift_1_start || todayShift.shift_start || ""
    const defaultShift1End =
      todayShift.shift_1_end ||
      (defaultHasSecondShift ? todayShift.shift_2_start || todayShift.break_start || "" : todayShift.shift_end || "")
    const defaultShift2Start = defaultHasSecondShift ? todayShift.shift_2_start || "" : ""
    const defaultShift2End = defaultHasSecondShift ? todayShift.shift_2_end || "" : ""

    const baselineState = normalizeShiftState({
      shift1Start: defaultShift1Start,
      shift1End: defaultShift1End,
      hasSecondShift: defaultHasSecondShift,
      shift2Start: defaultShift2Start,
      shift2End: defaultShift2End,
    })

    const edited = editingShifts[worker.id] ?? baselineState

    return (
      edited.shift1Start !== baselineState.shift1Start ||
      edited.shift1End !== baselineState.shift1End ||
      edited.hasSecondShift !== baselineState.hasSecondShift ||
      edited.shift2Start !== baselineState.shift2Start ||
      edited.shift2End !== baselineState.shift2End
    )
  }

  const getWorkingHoursDisplay = (state: ShiftEditorState) => {
    if (!state.shift1Start || !state.shift1End) {
      return "—"
    }

    if (state.hasSecondShift && state.shift2Start && state.shift2End) {
      const result = calculateDualShiftWorkingHours(
        state.shift1Start,
        state.shift1End,
        false,
        undefined,
        undefined,
        state.shift2Start,
        state.shift2End,
        false,
        undefined,
        undefined,
      )
      return result.formatted
    }

    const result = calculateWorkingHours(state.shift1Start, state.shift1End, false, undefined, undefined)
    return result.formatted
  }

  const getShiftSummaryLines = (state: ShiftEditorState): string[] => {
    if (state.hasSecondShift && state.shift2Start && state.shift2End) {
      return [
        `Shift 1: ${formatShiftRange(state.shift1Start, state.shift1End)}`,
        `Shift 2: ${formatShiftRange(state.shift2Start, state.shift2End)}`,
      ]
    }
    if (state.shift1Start && state.shift1End) {
      return [`Shift: ${formatShiftRange(state.shift1Start, state.shift1End)}`]
    }
    return []
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
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-3 mb-6">
            <TabsTrigger value="current" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Current Shifts
            </TabsTrigger>
            <TabsTrigger value="schedule" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Schedule
            </TabsTrigger>
            <TabsTrigger value="dual-shifts" className="flex items-center gap-2">
              <Coffee className="h-4 w-4" />
              Dual Shift Tools
            </TabsTrigger>
          </TabsList>

          <TabsContent value="current" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              {workers.map((worker) => {
                const todayShift = getWorkerShiftForDate(worker, today, shiftSchedules)
                const initialState: ShiftEditorState = normalizeShiftState({
                  shift1Start: todayShift.shift_1_start || todayShift.shift_start || "",
                  shift1End:
                    todayShift.shift_1_end ||
                    (todayShift.shift_2_start || todayShift.shift_2_end
                      ? todayShift.shift_2_start || todayShift.break_start || ""
                      : todayShift.shift_end || ""),
                  hasSecondShift: Boolean(
                    (todayShift.is_dual_shift || todayShift.has_shift_2) &&
                      todayShift.shift_2_start &&
                      todayShift.shift_2_end,
                  ),
                  shift2Start: todayShift.shift_2_start || "",
                  shift2End: todayShift.shift_2_end || "",
                })

                const shiftState = editingShifts[worker.id] ?? initialState
                const isOffDuty = offDutyStatus[worker.id]
                const hasSecondShift = Boolean(shiftState.hasSecondShift && shiftState.shift2Start && shiftState.shift2End)
                const workingHours = getWorkingHoursDisplay(shiftState)
                const shiftSegments = getShiftSummaryLines(shiftState)
                const interShiftBreakLabel =
                  hasSecondShift && shiftState.shift1End && shiftState.shift2Start
                    ? `Shift Break: ${formatShiftTime(shiftState.shift1End)} - ${formatShiftTime(shiftState.shift2Start)}`
                    : null

                return (
                  <Card key={worker.id}>
                    <CardHeader>
                      <CardTitle className="text-lg">{worker.name}</CardTitle>
                      <p className="text-sm text-muted-foreground capitalize">{worker.department}</p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Label htmlFor={`off-duty-${worker.id}`} className="cursor-pointer font-semibold">
                              Mark as Off Duty
                            </Label>
                          </div>
                          <Switch
                            id={`off-duty-${worker.id}`}
                            checked={isOffDuty}
                            onCheckedChange={(checked) => handleOffDutyToggle(worker.id, checked)}
                          />
                        </div>

                        <div className={isOffDuty ? "opacity-50 pointer-events-none" : ""}>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label htmlFor={`shift1-start-${worker.id}`}>
                                {hasSecondShift ? "Shift 1 Start" : "Shift Start"}
                              </Label>
                              <Input
                                id={`shift1-start-${worker.id}`}
                                type="time"
                                value={shiftState.shift1Start}
                                onChange={(e) => updateEditingShift(worker.id, { shift1Start: e.target.value })}
                                className="mt-1"
                                disabled={isOffDuty}
                              />
                            </div>
                            <div>
                              <Label htmlFor={`shift1-end-${worker.id}`}>
                                {hasSecondShift ? "Shift 1 End" : "Shift End"}
                              </Label>
                              <Input
                                id={`shift1-end-${worker.id}`}
                                type="time"
                                value={shiftState.shift1End}
                                onChange={(e) => updateEditingShift(worker.id, { shift1End: e.target.value })}
                                className="mt-1"
                                disabled={isOffDuty}
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between py-2 border-t">
                            <div className="flex items-center gap-2">
                              <Coffee className="h-4 w-4 text-muted-foreground" />
                              <Label htmlFor={`second-shift-${worker.id}`} className="cursor-pointer">
                                Enable Second Shift
                              </Label>
                            </div>
                            <Switch
                              id={`second-shift-${worker.id}`}
                              checked={hasSecondShift}
                              onCheckedChange={(checked) =>
                                updateEditingShift(worker.id, {
                                  hasSecondShift: checked,
                                  shift2Start: checked ? shiftState.shift2Start || shiftState.shift1End : "",
                                  shift2End: checked ? shiftState.shift2End || shiftState.shift1End : "",
                                })
                              }
                              disabled={isOffDuty}
                            />
                          </div>

                          {hasSecondShift && (
                            <div className="space-y-2 pl-6 border-l-2 border-muted">
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <Label htmlFor={`shift2-start-${worker.id}`} className="text-xs">
                                    Shift 2 Start
                                  </Label>
                                  <Input
                                    id={`shift2-start-${worker.id}`}
                                    type="time"
                                    value={shiftState.shift2Start}
                                    onChange={(e) =>
                                      updateEditingShift(worker.id, { shift2Start: e.target.value })
                                    }
                                    className="mt-1"
                                    disabled={isOffDuty}
                                  />
                                </div>
                                <div>
                                  <Label htmlFor={`shift2-end-${worker.id}`} className="text-xs">
                                    Shift 2 End
                                  </Label>
                                  <Input
                                    id={`shift2-end-${worker.id}`}
                                    type="time"
                                    value={shiftState.shift2End}
                                    onChange={(e) =>
                                      updateEditingShift(worker.id, { shift2End: e.target.value })
                                    }
                                    className="mt-1"
                                    disabled={isOffDuty}
                                  />
                                </div>
                              </div>
                              {interShiftBreakLabel && (
                                <p className="text-xs text-muted-foreground">{interShiftBreakLabel}</p>
                              )}
                            </div>
                          )}

                          <div className="flex items-center justify-between text-sm pt-2 border-t">
                            <span className="text-muted-foreground">Working Hours:</span>
                            <span className="font-semibold">{isOffDuty ? "Off Duty" : workingHours}</span>
                          </div>

                          <div className="flex flex-col gap-1 text-sm text-muted-foreground pt-2 border-t">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4" />
                              <span>
                                Today&apos;s Schedule:{" "}
                                {isOffDuty
                                  ? "Off Duty"
                                  : shiftSegments.length > 0
                                  ? shiftSegments.join(" • ")
                                  : "Not set"}
                              </span>
                            </div>
                            {!isOffDuty && interShiftBreakLabel && (
                              <span className="pl-6 text-xs text-muted-foreground">{interShiftBreakLabel}</span>
                            )}
                          </div>

                          <Button
                            onClick={() => handleSaveShift(worker.id)}
                            disabled={!hasChanges(worker.id) || isOffDuty}
                            className="w-full"
                          >
                            <Save className="mr-2 h-4 w-4" />
                            Save Changes
                          </Button>
                        </div>
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

          <TabsContent value="dual-shifts" className="space-y-6">
            <div className="mb-6">
              <h2 className="text-xl font-bold">Dual Shift Configuration</h2>
              <p className="text-muted-foreground mb-4">
                Configure dual shifts for workers who need to work split shifts with longer breaks between them.
              </p>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2">
              {workers.map((worker) => {
                const todayShift = getWorkerShiftForDate(worker, today, shiftSchedules)
                const isOffDuty = offDutyStatus[worker.id]
                
                return (
                  <Card key={worker.id}>
                    <CardHeader>
                      <CardTitle className="text-lg">{worker.name}</CardTitle>
                      <p className="text-sm text-muted-foreground capitalize">{worker.department}</p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`off-duty-${worker.id}`} className="cursor-pointer font-semibold">
                            Mark as Off Duty
                          </Label>
                        </div>
                        <Switch
                          id={`off-duty-${worker.id}`}
                          checked={isOffDuty}
                          onCheckedChange={(checked) => handleOffDutyToggle(worker.id, checked)}
                        />
                      </div>

                      <div className={isOffDuty ? "opacity-50 pointer-events-none" : ""}>
                        <DualShiftUI
                          workerId={worker.id}
                          workerName={worker.name}
                          initialShift={{
                            start: todayShift.shift_1_start || todayShift.shift_start || "",
                            end: todayShift.shift_1_end || todayShift.shift_end || "",
                            hasBreak: Boolean(todayShift.has_break),
                            breakStart: todayShift.break_start || "",
                            breakEnd: todayShift.break_end || "",
                            isDualShift: Boolean(todayShift.is_dual_shift || todayShift.has_shift_2),
                            shift2Start: todayShift.shift_2_start || "",
                            shift2End: todayShift.shift_2_end || "",
                            shift2HasBreak: Boolean(
                              todayShift.shift_2_has_break &&
                                todayShift.shift_2_break_start &&
                                todayShift.shift_2_break_end,
                            ),
                            shift2BreakStart: todayShift.shift_2_break_start || "",
                            shift2BreakEnd: todayShift.shift_2_break_end || "",
                          }}
                          onSave={(shiftData) => {
                            const shift1Start = (shiftData.shift_1_start as string) || (shiftData.shift_start as string) || ""
                            const shift1End = (shiftData.shift_1_end as string) || (shiftData.shift_end as string) || ""
                            const secondEnabled = Boolean(
                              (shiftData.is_dual_shift || shiftData.has_shift_2) &&
                                shiftData.shift_2_start &&
                                shiftData.shift_2_end,
                            )
                            const shift2Start = secondEnabled ? ((shiftData.shift_2_start as string) || "") : ""
                            const shift2End = secondEnabled ? ((shiftData.shift_2_end as string) || "") : ""
                            const shift1BreakStart = (shiftData.shift_1_break_start as string) || undefined
                            const shift1BreakEnd = (shiftData.shift_1_break_end as string) || undefined
                            const shift2BreakStart = (shiftData.shift_2_break_start as string) || undefined
                            const shift2BreakEnd = (shiftData.shift_2_break_end as string) || undefined
                            const hasShift1Break = Boolean(shift1BreakStart && shift1BreakEnd)
                            const hasShift2Break = Boolean(shift2BreakStart && shift2BreakEnd)

                            const nextState = normalizeShiftState({
                              shift1Start,
                              shift1End,
                              hasSecondShift: secondEnabled,
                              shift2Start,
                              shift2End,
                            })

                            const hasInterShiftBreak = Boolean(
                              nextState.hasSecondShift &&
                                !hasShift1Break &&
                                nextState.shift1End &&
                                nextState.shift2Start &&
                                timeToMinutes(nextState.shift2Start) > timeToMinutes(nextState.shift1End),
                            )
                            const interShiftBreakStart = hasInterShiftBreak ? nextState.shift1End : undefined
                            const interShiftBreakEnd = hasInterShiftBreak ? nextState.shift2Start : undefined
                            const hasAnyBreak = Boolean(
                              (hasShift1Break && shift1BreakStart && shift1BreakEnd) ||
                                (interShiftBreakStart && interShiftBreakEnd),
                            )

                            setEditingShifts((prev) => ({
                              ...prev,
                              [worker.id]: nextState,
                            }))

                            const todayDate = today.toISOString().split("T")[0]

                            saveShiftSchedule({
                              worker_id: worker.id,
                              schedule_date: todayDate,
                              shift_start: nextState.shift1Start,
                              shift_end: nextState.hasSecondShift ? nextState.shift2End : nextState.shift1End,
                              has_break: hasAnyBreak,
                              break_start: hasShift1Break ? shift1BreakStart : interShiftBreakStart,
                              break_end: hasShift1Break ? shift1BreakEnd : interShiftBreakEnd,
                              shift_1_start: nextState.shift1Start,
                              shift_1_end: nextState.shift1End,
                              shift_1_break_start: hasShift1Break ? shift1BreakStart : undefined,
                              shift_1_break_end: hasShift1Break ? shift1BreakEnd : undefined,
                              shift_2_start: nextState.hasSecondShift ? nextState.shift2Start : undefined,
                              shift_2_end: nextState.hasSecondShift ? nextState.shift2End : undefined,
                              shift_2_break_start:
                                nextState.hasSecondShift && hasShift2Break ? shift2BreakStart : undefined,
                              shift_2_break_end:
                                nextState.hasSecondShift && hasShift2Break ? shift2BreakEnd : undefined,
                              has_shift_2: nextState.hasSecondShift,
                              is_dual_shift: nextState.hasSecondShift,
                              shift_2_has_break: nextState.hasSecondShift && hasShift2Break,
                              is_override: isOffDuty,
                              override_reason: isOffDuty ? "leave" : "",
                              notes: "",
                            })
                            
                            toast({
                              title: "Dual Shift Updated",
                              description: `${worker.name}'s dual shift configuration has been updated successfully`,
                            })
                          }}
                          onCancel={() => {
                            // Just close the modal without saving
                          }}
                        />
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
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
