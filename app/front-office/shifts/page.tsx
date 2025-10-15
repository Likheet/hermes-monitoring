"use client"

import { useState } from "react"
import { ProtectedRoute } from "@/components/protected-route"
import { useAuth } from "@/lib/auth-context"
import { useTasks } from "@/lib/task-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Clock, Save } from "lucide-react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { calculateShiftHours, formatShiftRange } from "@/lib/date-utils"

function ShiftManagement() {
  const { user } = useAuth()
  const { users, updateWorkerShift } = useTasks()
  const router = useRouter()
  const { toast } = useToast()

  const workers = users.filter((u) => u.role === "worker")

  const [editingShifts, setEditingShifts] = useState<Record<string, { start: string; end: string }>>(
    Object.fromEntries(workers.map((w) => [w.id, { start: w.shift_start, end: w.shift_end }])),
  )

  const handleSaveShift = (workerId: string) => {
    const shift = editingShifts[workerId]
    updateWorkerShift(workerId, shift.start, shift.end, user!.id)
    toast({
      title: "Shift Updated",
      description: "Worker shift timing has been updated successfully",
    })
  }

  const hasChanges = (workerId: string) => {
    const worker = workers.find((w) => w.id === workerId)
    if (!worker) return false
    const edited = editingShifts[workerId]
    return edited.start !== worker.shift_start || edited.end !== worker.shift_end
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
            <p className="text-sm text-muted-foreground">Manage worker shift timings</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          {workers.map((worker) => {
            const edited = editingShifts[worker.id]
            const shiftHours = calculateShiftHours(edited.start, edited.end)

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

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Total Shift Duration:</span>
                      <span className="font-semibold">{shiftHours}</span>
                    </div>
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
                </CardContent>
              </Card>
            )
          })}
        </div>
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
