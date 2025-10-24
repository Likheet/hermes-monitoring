import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Coffee, Clock } from "lucide-react"
import { timeToMinutes, validateDualShiftTimes } from "@/lib/shift-utils"
import { calculateDualShiftWorkingHours, calculateWorkingHours, formatShiftTime } from "@/lib/date-utils"
import { useToast } from "@/hooks/use-toast"

interface DualShiftUIProps {
  workerId: string
  workerName: string
  initialShift: {
    start: string
    end: string
    hasBreak: boolean
    breakStart?: string
    breakEnd?: string
    isDualShift: boolean
    shift2Start?: string
    shift2End?: string
    shift2HasBreak?: boolean
    shift2BreakStart?: string
    shift2BreakEnd?: string
  }
  onSave: (shiftData: Record<string, unknown>) => void
  onCancel: () => void
}

interface FormState {
  shift1Start: string
  shift1End: string
  shift1HasBreak: boolean
  shift1BreakStart: string
  shift1BreakEnd: string
  enableSecondShift: boolean
  shift2Start: string
  shift2End: string
  shift2HasBreak: boolean
  shift2BreakStart: string
  shift2BreakEnd: string
}

const EMPTY_TIME = ""

export function DualShiftUI({ workerId, workerName, initialShift, onSave, onCancel }: DualShiftUIProps) {
  const { toast } = useToast()

  const [form, setForm] = useState<FormState>({
    shift1Start: initialShift.start,
    shift1End: initialShift.end,
    shift1HasBreak: initialShift.hasBreak,
    shift1BreakStart: initialShift.breakStart ?? EMPTY_TIME,
    shift1BreakEnd: initialShift.breakEnd ?? EMPTY_TIME,
    enableSecondShift: initialShift.isDualShift && Boolean(initialShift.shift2Start && initialShift.shift2End),
    shift2Start: initialShift.shift2Start ?? EMPTY_TIME,
    shift2End: initialShift.shift2End ?? EMPTY_TIME,
    shift2HasBreak: Boolean(initialShift.shift2HasBreak && initialShift.shift2BreakStart && initialShift.shift2BreakEnd),
    shift2BreakStart: initialShift.shift2BreakStart ?? EMPTY_TIME,
    shift2BreakEnd: initialShift.shift2BreakEnd ?? EMPTY_TIME,
  })

  const updateForm = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const secondShiftEnabled = Boolean(form.enableSecondShift && form.shift2Start && form.shift2End)

  const isSecondShiftSameDay = useMemo(() => {
    if (!secondShiftEnabled || !form.shift1End || !form.shift2Start) {
      return false
    }

    return timeToMinutes(form.shift2Start) > timeToMinutes(form.shift1End)
  }, [secondShiftEnabled, form.shift1End, form.shift2Start])

  const workingHoursSummary = useMemo(() => {
    if (secondShiftEnabled) {
      return calculateDualShiftWorkingHours(
        form.shift1Start,
        form.shift1End,
        form.shift1HasBreak,
        form.shift1BreakStart || undefined,
        form.shift1BreakEnd || undefined,
        form.shift2Start,
        form.shift2End,
        form.shift2HasBreak,
        form.shift2BreakStart || undefined,
        form.shift2BreakEnd || undefined,
      ).formatted
    }

    const shift1 = calculateWorkingHours(
      form.shift1Start,
      form.shift1End,
      form.shift1HasBreak,
      form.shift1BreakStart || undefined,
      form.shift1BreakEnd || undefined,
    )
    return shift1.formatted
  }, [form])

  const interShiftBreakSummary =
    secondShiftEnabled && isSecondShiftSameDay && form.shift1End && form.shift2Start
      ? `${formatShiftTime(form.shift1End)} - ${formatShiftTime(form.shift2Start)}`
      : null

  const handleSave = () => {
    const shift1BreakActive = Boolean(
      form.shift1HasBreak && form.shift1BreakStart && form.shift1BreakEnd,
    )
    const shift1BreakStart = shift1BreakActive ? form.shift1BreakStart : undefined
    const shift1BreakEnd = shift1BreakActive ? form.shift1BreakEnd : undefined
    const shift2BreakActive = Boolean(
      secondShiftEnabled && form.shift2HasBreak && form.shift2BreakStart && form.shift2BreakEnd,
    )
    const shift2BreakStart = shift2BreakActive ? form.shift2BreakStart : undefined
    const shift2BreakEnd = shift2BreakActive ? form.shift2BreakEnd : undefined
    const interShiftBreakStart = !shift1BreakActive && secondShiftEnabled && isSecondShiftSameDay ? form.shift1End : undefined
    const interShiftBreakEnd = interShiftBreakStart ? form.shift2Start : undefined

    const validation = validateDualShiftTimes(
      form.shift1Start,
      form.shift1End,
      shift1BreakStart,
      shift1BreakEnd,
      secondShiftEnabled ? form.shift2Start : undefined,
      secondShiftEnabled ? form.shift2End : undefined,
      shift2BreakStart,
      shift2BreakEnd,
    )

    if (!validation.valid) {
      toast({
        title: "Invalid Shift Timing",
        description: validation.error ?? "Please review the provided shift configuration.",
        variant: "destructive",
      })
      return
    }

    const hasInterShiftBreak = Boolean(interShiftBreakStart && interShiftBreakEnd)
    const hasAnyBreak = Boolean(shift1BreakStart && shift1BreakEnd) || hasInterShiftBreak

    onSave({
      shift_start: form.shift1Start,
      shift_end: secondShiftEnabled ? form.shift2End : form.shift1End,
      has_break: hasAnyBreak,
      break_start: shift1BreakStart ?? interShiftBreakStart,
      break_end: shift1BreakEnd ?? interShiftBreakEnd,
      shift_1_start: form.shift1Start,
      shift_1_end: form.shift1End,
      shift_1_break_start: shift1BreakStart,
      shift_1_break_end: shift1BreakEnd,
      shift_2_start: secondShiftEnabled ? form.shift2Start : undefined,
      shift_2_end: secondShiftEnabled ? form.shift2End : undefined,
      shift_2_break_start: shift2BreakStart,
      shift_2_break_end: shift2BreakEnd,
      has_shift_2: secondShiftEnabled,
      is_dual_shift: secondShiftEnabled,
      shift_2_has_break: secondShiftEnabled && shift2BreakActive,
    })

    toast({
      title: "Shift Updated",
      description: `${workerName}'s dual shift configuration has been saved.`,
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{workerName}</CardTitle>
        <p className="text-sm text-muted-foreground">Configure split shift timings and break windows.</p>
      </CardHeader>
      <CardContent className="space-y-6">
        <section className="space-y-4">
          <h3 className="text-md font-semibold">First Shift</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor={`shift1-start-${workerId}`}>Start Time</Label>
              <Input
                id={`shift1-start-${workerId}`}
                type="time"
                value={form.shift1Start}
                onChange={(event) => updateForm("shift1Start", event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor={`shift1-end-${workerId}`}>End Time</Label>
              <Input
                id={`shift1-end-${workerId}`}
                type="time"
                value={form.shift1End}
                onChange={(event) => updateForm("shift1End", event.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Coffee className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor={`shift1-break-${workerId}`} className="cursor-pointer">
                Include Break
              </Label>
            </div>
            <Switch
              id={`shift1-break-${workerId}`}
              checked={form.shift1HasBreak}
              onCheckedChange={(checked) => {
                updateForm("shift1HasBreak", checked)
                if (!checked) {
                  updateForm("shift1BreakStart", EMPTY_TIME)
                  updateForm("shift1BreakEnd", EMPTY_TIME)
                }
              }}
            />
          </div>

          {form.shift1HasBreak && (
            <div className="grid grid-cols-2 gap-3 pl-6">
              <div>
                <Label htmlFor={`shift1-break-start-${workerId}`} className="text-xs">
                  Break Start
                </Label>
                <Input
                  id={`shift1-break-start-${workerId}`}
                  type="time"
                  value={form.shift1BreakStart}
                  onChange={(event) => updateForm("shift1BreakStart", event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor={`shift1-break-end-${workerId}`} className="text-xs">
                  Break End
                </Label>
                <Input
                  id={`shift1-break-end-${workerId}`}
                  type="time"
                  value={form.shift1BreakEnd}
                  onChange={(event) => updateForm("shift1BreakEnd", event.target.value)}
                />
              </div>
            </div>
          )}
        </section>

        <section className="space-y-4 border-t pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Label htmlFor={`shift2-toggle-${workerId}`} className="cursor-pointer font-semibold">
                Enable Second Shift
              </Label>
            </div>
            <Switch
              id={`shift2-toggle-${workerId}`}
              checked={form.enableSecondShift}
              onCheckedChange={(checked) => {
                updateForm("enableSecondShift", checked)
                if (!checked) {
                  updateForm("shift2Start", EMPTY_TIME)
                  updateForm("shift2End", EMPTY_TIME)
                  updateForm("shift2HasBreak", false)
                  updateForm("shift2BreakStart", EMPTY_TIME)
                  updateForm("shift2BreakEnd", EMPTY_TIME)
                }
              }}
            />
          </div>

          {form.enableSecondShift && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor={`shift2-start-${workerId}`}>Second Shift Start</Label>
                  <Input
                    id={`shift2-start-${workerId}`}
                    type="time"
                    value={form.shift2Start}
                    onChange={(event) => updateForm("shift2Start", event.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor={`shift2-end-${workerId}`}>Second Shift End</Label>
                  <Input
                    id={`shift2-end-${workerId}`}
                    type="time"
                    value={form.shift2End}
                    onChange={(event) => updateForm("shift2End", event.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Coffee className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor={`shift2-break-${workerId}`} className="cursor-pointer">
                    Second Shift Break
                  </Label>
                </div>
                <Switch
                  id={`shift2-break-${workerId}`}
                  checked={form.shift2HasBreak}
                  onCheckedChange={(checked) => {
                    updateForm("shift2HasBreak", checked)
                    if (!checked) {
                      updateForm("shift2BreakStart", EMPTY_TIME)
                      updateForm("shift2BreakEnd", EMPTY_TIME)
                    }
                  }}
                />
              </div>

              {form.shift2HasBreak && (
                <div className="grid grid-cols-2 gap-3 pl-6">
                  <div>
                    <Label htmlFor={`shift2-break-start-${workerId}`} className="text-xs">
                      Break Start
                    </Label>
                    <Input
                      id={`shift2-break-start-${workerId}`}
                      type="time"
                      value={form.shift2BreakStart}
                      onChange={(event) => updateForm("shift2BreakStart", event.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`shift2-break-end-${workerId}`} className="text-xs">
                      Break End
                    </Label>
                    <Input
                      id={`shift2-break-end-${workerId}`}
                      type="time"
                      value={form.shift2BreakEnd}
                      onChange={(event) => updateForm("shift2BreakEnd", event.target.value)}
                    />
                  </div>
                </div>
              )}

              {interShiftBreakSummary && (
                <p className="text-xs text-muted-foreground">
                  Shift Break: {interShiftBreakSummary}
                </p>
              )}
            </div>
          )}
        </section>

        <section className="flex items-center justify-between border-t pt-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            Total Working Hours
          </div>
          <span className="font-semibold">{workingHoursSummary}</span>
        </section>
      </CardContent>

      <div className="flex justify-end gap-2 px-6 pb-6">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave}>Save Shift Configuration</Button>
      </div>
    </Card>
  )
}
