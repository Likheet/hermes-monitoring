"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { MaintenanceScheduleList } from "@/components/admin/maintenance-schedule-list"
import { MaintenanceScheduleForm } from "@/components/admin/maintenance-schedule-form"
import { useTasks } from "@/lib/task-context"
import type { MaintenanceSchedule } from "@/lib/maintenance-types"
import { useToast } from "@/hooks/use-toast"

export default function MaintenanceSchedulePage() {
  const router = useRouter()
  const { addSchedule, updateSchedule } = useTasks()
  const { toast } = useToast()
  const [showForm, setShowForm] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<MaintenanceSchedule | undefined>()

  const handleCreateNew = () => {
    setEditingSchedule(undefined)
    setShowForm(true)
  }

  const handleEdit = (schedule: MaintenanceSchedule) => {
    setEditingSchedule(schedule)
    setShowForm(true)
  }

  const handleCloseForm = () => {
    setShowForm(false)
    setEditingSchedule(undefined)
  }

  const handleSaveSchedule = async (scheduleData: Partial<MaintenanceSchedule>) => {
    try {
      if (editingSchedule) {
        console.log("[v0] Updating schedule:", editingSchedule.id, scheduleData)
        updateSchedule(editingSchedule.id, scheduleData)
        toast({
          title: "Schedule Updated",
          description: "The maintenance schedule has been updated successfully.",
        })
      } else {
        console.log("[v0] Creating schedule:", scheduleData)
        addSchedule(scheduleData as Omit<MaintenanceSchedule, "id" | "created_at">)
        toast({
          title: "Schedule Created",
          description: "The maintenance schedule has been created successfully.",
        })
      }

      handleCloseForm()
    } catch (error) {
      console.error("[v0] Error saving schedule:", error)
      toast({
        title: "Error",
        description: "Failed to save schedule. Please try again.",
        variant: "destructive",
      })
      throw error
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        <button
          onClick={() => router.push("/admin")}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 font-medium"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Admin Dashboard
        </button>

        <MaintenanceScheduleList onCreateNew={handleCreateNew} onEdit={handleEdit} />

        {showForm && (
          <MaintenanceScheduleForm schedule={editingSchedule} onClose={handleCloseForm} onSave={handleSaveSchedule} />
        )}
      </div>
    </div>
  )
}
