"use client"

import type React from "react"

import { useState } from "react"
import { ProtectedRoute } from "@/components/protected-route"
import { useAuth } from "@/lib/auth-context"
import { useTasks } from "@/lib/task-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, UserPlus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import type { Department, UserRole } from "@/lib/types"
import { calculateShiftHours } from "@/lib/date-utils"

function AddWorker() {
  const { user } = useAuth()
  const { addWorker } = useTasks()
  const router = useRouter()
  const { toast } = useToast()

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    role: "worker" as UserRole,
    department: "" as Department | "",
    shift_start: "09:00",
    shift_end: "17:00",
  })

  const handleRoleChange = (value: UserRole) => {
    setFormData((prev) => {
      let nextDepartment: Department | "" = prev.department
      if (value === "front_office") {
        nextDepartment = "front_desk"
      } else if (prev.department === "front_desk") {
        nextDepartment = ""
      }

      return {
        ...prev,
        role: value,
        department: nextDepartment,
      }
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (
      !formData.name ||
      !formData.phone ||
      !formData.department ||
      !formData.shift_start ||
      !formData.shift_end ||
      !formData.role
    ) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      })
      return
    }

    addWorker({
      name: formData.name,
      role: formData.role,
      phone: formData.phone,
      department: formData.department as Department,
      shift_start: formData.shift_start,
      shift_end: formData.shift_end,
      has_break: false,
    })

    toast({
      title: "Staff Member Added",
      description: `${formData.name} has been added successfully`,
    })

    router.push("/admin")
  }

  const shiftHours = calculateShiftHours(formData.shift_start, formData.shift_end)
  const departmentOptions: Array<{ value: Department; label: string }> =
    formData.role === "front_office"
      ? [{ value: "front_desk", label: "Front Desk" }]
      : [
          { value: "housekeeping", label: "Housekeeping" },
          { value: "maintenance", label: "Maintenance" },
        ]

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="container mx-auto flex items-center gap-4 px-4 py-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/admin")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Add Worker</h1>
            <p className="text-sm text-muted-foreground">Add housekeeping, maintenance, or front office staff</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Worker Information</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter worker's full name"
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="Enter phone number"
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="role">Role</Label>
                <Select value={formData.role} onValueChange={(value) => handleRoleChange(value as UserRole)}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="worker">Worker</SelectItem>
                    <SelectItem value="supervisor">Supervisor</SelectItem>
                    <SelectItem value="front_office">Front Office</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="department">Department</Label>
                <Select
                  value={formData.department}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, department: value as Department }))}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departmentOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formData.role === "front_office" && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Front office staff are automatically assigned to the Front Desk.
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <Label>Shift Timing</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="shift_start" className="text-sm text-muted-foreground">
                      Start Time
                    </Label>
                    <Input
                      id="shift_start"
                      type="time"
                      value={formData.shift_start}
                      onChange={(e) => setFormData((prev) => ({ ...prev, shift_start: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="shift_end" className="text-sm text-muted-foreground">
                      End Time
                    </Label>
                    <Input
                      id="shift_end"
                      type="time"
                      value={formData.shift_end}
                      onChange={(e) => setFormData((prev) => ({ ...prev, shift_end: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm bg-muted/50 p-3 rounded-md">
                  <span className="text-muted-foreground">Total Shift Duration:</span>
                  <span className="font-semibold">{shiftHours}</span>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => router.push("/admin")} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" className="flex-1">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add Worker
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

export default function AddWorkerPage() {
  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <AddWorker />
    </ProtectedRoute>
  )
}
