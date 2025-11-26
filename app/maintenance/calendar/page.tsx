"use client"

import { useState } from "react"
import { ProtectedRoute } from "@/components/protected-route"
import { MaintenanceCalendar } from "@/components/maintenance/maintenance-calendar"
import { RoomTaskModal } from "@/components/maintenance/room-task-modal"
import { useTasks } from "@/lib/task-context"
import type { MaintenanceTask } from "@/lib/maintenance-types"
import type { TaskCompletionData } from "@/components/maintenance/room-task-modal"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"

function MaintenanceCalendarContent() {
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null)
  const [selectedTasks, setSelectedTasks] = useState<MaintenanceTask[]>([])
  const { updateMaintenanceTask, maintenanceTasks } = useTasks()
  const router = useRouter()

  const handleRoomClick = (roomNumber: string, tasks: MaintenanceTask[]) => {
    setSelectedRoom(roomNumber)
    setSelectedTasks(tasks)
  }

  const handleTaskComplete = async (taskId: string, data: TaskCompletionData) => {
    try {

      updateMaintenanceTask(taskId, {
        status: "completed",
        ac_location: data.acLocation,
        photos: [
          ...(data.categorizedPhotos.room_photos || []),
          ...(data.categorizedPhotos.proof_photos || []),
        ],
        categorized_photos: {
          before_photos: data.categorizedPhotos.room_photos,
          after_photos: data.categorizedPhotos.proof_photos,
        },
        timer_duration: data.timerDuration,
        completed_at: new Date().toISOString(),
        notes: data.notes,
      })

      // Update local state
      setSelectedTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: "completed" as const } : t)))
    } catch (error) {
      console.error("Error completing task:", error)
      throw error
    }
  }

  const handleCloseModal = () => {
    setSelectedRoom(null)
    setSelectedTasks([])
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <Button variant="outline" onClick={() => router.push("/worker")} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
      </div>

      <MaintenanceCalendar onRoomClick={handleRoomClick} tasks={maintenanceTasks ?? []} />

      {selectedRoom && (
        <RoomTaskModal
          roomNumber={selectedRoom}
          tasks={selectedTasks}
          onClose={handleCloseModal}
          onTaskComplete={handleTaskComplete}
        />
      )}
    </div>
  )
}

export default function MaintenanceCalendarPage() {
  return (
    <ProtectedRoute allowedRoles={["worker"]}>
      <MaintenanceCalendarContent />
    </ProtectedRoute>
  )
}
