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
  const { updateMaintenanceTask } = useTasks()
  const router = useRouter()

  const handleRoomClick = (roomNumber: string, tasks: MaintenanceTask[]) => {
    console.log("[v0] Room clicked:", roomNumber, "Tasks:", tasks.length)
    setSelectedRoom(roomNumber)
    setSelectedTasks(tasks)
  }

  const handleTaskComplete = async (taskId: string, data: TaskCompletionData) => {
    try {
      console.log("[v0] Task completed:", taskId, data)

      updateMaintenanceTask(taskId, {
        status: "completed",
        ac_location: data.acLocation,
        photos: data.photos,
        timer_duration: data.timerDuration,
        completed_at: new Date().toISOString(),
      })

      // Update local state
      setSelectedTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: "completed" as const } : t)))
    } catch (error) {
      console.error("[v0] Error completing task:", error)
      throw error
    }
  }

  const handleCloseModal = () => {
    console.log("[v0] Closing modal")
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

      <MaintenanceCalendar onRoomClick={handleRoomClick} />

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
