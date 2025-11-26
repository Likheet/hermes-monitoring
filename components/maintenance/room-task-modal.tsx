"use client"

import { useState, useEffect, useRef } from "react"
import { Play, Pause, Check, Upload, AlertTriangle, ArrowLeft, ChevronRight, X } from "lucide-react"
import { TASK_TYPE_LABELS, type MaintenanceTask } from "@/lib/maintenance-types"
import { getACLocationsForRoom } from "@/lib/location-data"
import { RaiseIssueModal } from "@/components/raise-issue-modal"
import type { CategorizedPhotos } from "@/lib/types"

interface RoomTaskModalProps {
  roomNumber: string
  tasks: MaintenanceTask[]
  onClose: () => void
  onTaskComplete: (taskId: string, data: TaskCompletionData) => Promise<void>
}

export interface TaskCompletionData {
  acLocation?: string
  categorizedPhotos: CategorizedPhotos
  timerDuration: number
  notes?: string
}

interface TaskTimerState {
  isRunning: boolean
  elapsed: number
  startedAt?: number
}

export function RoomTaskModal({ roomNumber, tasks, onClose, onTaskComplete }: RoomTaskModalProps) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [timers, setTimers] = useState<Record<string, TaskTimerState>>({})
  const [categorizedPhotos, setCategorizedPhotos] = useState<Record<string, CategorizedPhotos>>({})
  const [acLocations, setAcLocations] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [issueModalOpen, setIssueModalOpen] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout>()

  const selectedTask = tasks.find((t) => t.id === selectedTaskId)
  const availableACLocations = getACLocationsForRoom(roomNumber)
  
  // Check if this is a lift task modal
  const isLiftTask = tasks.length > 0 && tasks[0].task_type === "lift"
  const displayLabel = isLiftTask ? (tasks[0].lift_id || tasks[0].location || roomNumber) : roomNumber
  const entityType = isLiftTask ? "Lift" : "Room"

  // Timer update interval
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setTimers((prev) => {
        const updated = { ...prev }
        Object.keys(updated).forEach((taskId) => {
          if (updated[taskId].isRunning && updated[taskId].startedAt) {
            const elapsed = Math.floor((Date.now() - updated[taskId].startedAt!) / 1000)
            updated[taskId].elapsed = elapsed > 0 ? elapsed : 0
          }
        })
        return updated
      })
    }, 1000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  const startTask = (taskId: string) => {
    setTimers((prev) => ({
      ...prev,
      [taskId]: {
        isRunning: true,
        elapsed: prev[taskId]?.elapsed || 0,
        startedAt: Date.now() - (prev[taskId]?.elapsed || 0) * 1000,
      },
    }))
  }

  const pauseTask = (taskId: string) => {
    setTimers((prev) => ({
      ...prev,
      [taskId]: {
        ...prev[taskId],
        isRunning: false,
        startedAt: undefined,
      },
    }))
  }

  const handleRaiseIssue = (issue: string) => {
    if (selectedTaskId) {
      setNotes((prev) => ({
        ...prev,
        [selectedTaskId]: (prev[selectedTaskId] || "") + "\n[ISSUE] " + issue,
      }))
    }
  }

const MAX_CANVAS_WIDTH = 1280
const MAX_CANVAS_HEIGHT = 960
const TARGET_UPLOAD_BYTES = 600 * 1024 // Soft target used during compression only
const JPEG_QUALITY_STEPS = [0.8, 0.7, 0.6, 0.5, 0.4, 0.3]

async function readImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error("Unable to load image"))
      img.src = typeof reader.result === "string" ? reader.result : ""
    }
    reader.onerror = () => reject(new Error("Failed to read file"))
    reader.readAsDataURL(file)
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality)
  })
}

async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) {
    return file
  }

  try {
    const image = await readImage(file)
    const scale = Math.min(1, MAX_CANVAS_WIDTH / image.width, MAX_CANVAS_HEIGHT / image.height)
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(image.width * scale)
    canvas.height = Math.round(image.height * scale)

    const ctx = canvas.getContext("2d", { willReadFrequently: false })
    if (!ctx) {
      return file
    }
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

    let bestBlob: Blob | null = null

    for (const quality of JPEG_QUALITY_STEPS) {
      const blob = await canvasToBlob(canvas, quality)
      if (!blob) continue
      bestBlob = blob
      if (blob.size <= TARGET_UPLOAD_BYTES) {
        break
      }
    }

    if (!bestBlob) {
      return file
    }

    const extension = file.name.toLowerCase().endsWith(".jpg") || file.name.toLowerCase().endsWith(".jpeg") ? file.name : `${file.name.split(".")[0] || "photo"}.jpg`

    return new File([bestBlob], extension, { type: "image/jpeg", lastModified: Date.now() })
  } catch (error) {
    console.warn("[photos] Falling back to original file due to compression error:", error)
    return file
  }
}

  const uploadPhoto = async (taskId: string, file: File, category: "room_photos" | "proof_photos") => {
    try {
      const optimizedFile = await compressImage(file)

      const formData = new FormData()
      formData.append("file", optimizedFile, optimizedFile.name)
      formData.append("taskId", taskId)

      const response = await fetch("/api/upload-photo", {
        method: "POST",
        body: formData,
        credentials: "include",
      })

      if (!response.ok) throw new Error("Upload failed")

      const { url } = await response.json()

      setCategorizedPhotos((prev) => {
        const existing = prev[taskId] || { room_photos: [], proof_photos: [] }
        return {
          ...prev,
          [taskId]: {
            ...existing,
            [category]: [...existing[category], url],
          },
        }
      })
    } catch (error) {
      console.error("Error uploading photo:", error)
      alert("Failed to upload photo. Please try again.")
    }
  }

  const removePhoto = (taskId: string, category: "room_photos" | "proof_photos", index: number) => {
    setCategorizedPhotos((prev) => {
      const existing = prev[taskId] || { room_photos: [], proof_photos: [] }
      return {
        ...prev,
        [taskId]: {
          ...existing,
          [category]: existing[category].filter((_, i) => i !== index),
        },
      }
    })
  }

  const completeTask = async (task: MaintenanceTask) => {
    const taskPhotos = categorizedPhotos[task.id]

    if (!taskPhotos || taskPhotos.room_photos.length === 0 || taskPhotos.proof_photos.length === 0) {
      alert(`Please upload at least 1 ${isLiftTask ? "lift" : "room"} photo and 1 proof photo before completing the task.`)
      return
    }

    if ((task.task_type === "ac_indoor" || task.task_type === "ac_outdoor") && !acLocations[task.id]) {
      alert("Please select AC location before completing the task.")
      return
    }

    try {
      pauseTask(task.id)

      const data: TaskCompletionData = {
        acLocation: acLocations[task.id],
        categorizedPhotos: taskPhotos,
        timerDuration: Math.max(timers[task.id]?.elapsed || 0, 0),
        notes: notes[task.id],
      }

      await onTaskComplete(task.id, data)
      setSelectedTaskId(null)
    } catch (error) {
      console.error("Error completing task:", error)
      alert("Failed to complete task. Please try again.")
    }
  }

  const formatTime = (seconds: number): string => {
    const safeSeconds = Math.max(0, seconds)
    const hours = Math.floor(safeSeconds / 3600)
    const minutes = Math.floor((safeSeconds % 3600) / 60)
    const secs = safeSeconds % 60
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const allTasksCompleted = tasks.every((t) => t.status === "completed")

  if (!selectedTaskId) {
    return (
      <div className="fixed inset-0 bg-background z-50 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-card border-b-2 border-border p-6 flex items-center gap-4 z-10">
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </button>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-foreground">{entityType} {displayLabel}</h2>
            <p className="text-muted-foreground">
              {tasks.filter((t) => t.status === "completed").length}/{tasks.length} tasks completed
            </p>
          </div>
        </div>

        <div className="p-6 space-y-3">
          {tasks.map((task, index) => {
            const isCompleted = task.status === "completed"
            const timer = timers[task.id] || { isRunning: false, elapsed: 0 }
            const isStarted = timer.elapsed > 0
            const taskPhotos = categorizedPhotos[task.id]
            const totalPhotos = taskPhotos ? taskPhotos.room_photos.length + taskPhotos.proof_photos.length : 0

            return (
              <button
                key={task.id}
                onClick={() => setSelectedTaskId(task.id)}
                className={`w-full flex items-center justify-between p-5 rounded-xl border-2 transition-all hover:shadow-md ${
                  isCompleted
                    ? "border-primary bg-primary/5"
                    : timer.isRunning
                      ? "border-accent bg-accent/5"
                      : isStarted
                        ? "border-muted-foreground/50 bg-muted/30"
                        : "border-border bg-card hover:border-muted-foreground"
                }`}
              >
                <div className="flex items-center gap-4 flex-1 text-left">
                  <div
                    className={`flex items-center justify-center w-10 h-10 rounded-full font-bold ${
                      isCompleted
                        ? "bg-primary text-primary-foreground"
                        : isStarted
                          ? "bg-muted text-foreground"
                          : "bg-muted/50 text-muted-foreground"
                    }`}
                  >
                    {isCompleted ? "✓" : index + 1}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-foreground">{TASK_TYPE_LABELS[task.task_type]}</h3>
                    <div className="flex items-center gap-4 mt-1 text-sm">
                      {isCompleted ? (
                        <span className="text-primary font-medium">✓ Completed</span>
                      ) : isStarted ? (
                        <>
                          <span className="text-muted-foreground">Time: {formatTime(timer.elapsed)}</span>
                          {timer.isRunning && <span className="text-accent font-medium">● In Progress</span>}
                          {!timer.isRunning && <span className="text-muted-foreground">⏸ Paused</span>}
                        </>
                      ) : (
                        <span className="text-muted-foreground">Not Started</span>
                      )}
                      {totalPhotos > 0 && <span className="text-muted-foreground">📷 {totalPhotos}</span>}
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </button>
            )
          })}
        </div>

        {/* Complete Button */}
        {allTasksCompleted && (
          <div className="sticky bottom-0 bg-card border-t-2 border-border p-6">
            <button
              onClick={onClose}
              className="w-full px-6 py-4 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 font-bold text-lg"
            >
              ✓ {entityType} {displayLabel} Complete - Return to Calendar
            </button>
          </div>
        )}
      </div>
    )
  }

  const task = selectedTask!
  const timer = timers[task.id] || { isRunning: false, elapsed: 0 }
  const isTaskStarted = timer.elapsed > 0
  const taskPhotos = categorizedPhotos[task.id] || { room_photos: [], proof_photos: [] }
  const hasEnoughPhotos = taskPhotos.room_photos.length > 0 && taskPhotos.proof_photos.length > 0

  return (
    <div className="fixed inset-0 bg-background z-50 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-card border-b-2 border-border p-6 flex items-center gap-4 z-10">
        <button onClick={() => setSelectedTaskId(null)} className="p-2 hover:bg-muted rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-foreground">{TASK_TYPE_LABELS[task.task_type]}</h2>
          <p className="text-muted-foreground">{entityType} {displayLabel}</p>
        </div>
      </div>

      <div className="p-6 space-y-6 max-w-2xl mx-auto pb-32">
        {/* Timer */}
        <div className="bg-card border-2 border-border rounded-xl p-6">
          <div className="text-center mb-4">
            <div className="text-4xl font-bold font-mono text-foreground">{formatTime(timer.elapsed)}</div>
            <p className="text-sm text-muted-foreground mt-2">
              {!isTaskStarted ? "Not Started" : timer.isRunning ? "In Progress" : "Paused"}
            </p>
          </div>
          <div className="flex gap-2">
            {!timer.isRunning ? (
              <button
                onClick={() => startTask(task.id)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 font-medium"
              >
                <Play className="w-5 h-5" />
                {timer.elapsed > 0 ? "Resume" : "Start Task"}
              </button>
            ) : (
              <button
                onClick={() => pauseTask(task.id)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-accent text-accent-foreground rounded-lg hover:bg-accent/90 font-medium"
              >
                <Pause className="w-5 h-5" />
                Pause
              </button>
            )}
          </div>
        </div>

        {/* AC Location - Only for AC tasks */}
        {(task.task_type === "ac_indoor" || task.task_type === "ac_outdoor") && (
          <div className="bg-card border-2 border-border rounded-xl p-6">
            <label className="block text-sm font-semibold text-foreground mb-2">
              {task.task_type === "ac_indoor" ? "AC Indoor Location *" : "AC Outdoor Location *"}
            </label>
            <select
              value={acLocations[task.id] || ""}
              onChange={(e) => setAcLocations((prev) => ({ ...prev, [task.id]: e.target.value }))}
              className="w-full px-4 py-3 border-2 border-border rounded-lg focus:border-primary focus:outline-none bg-background text-foreground"
              disabled={!isTaskStarted}
            >
              <option value="">{isTaskStarted ? "Select location..." : "Start task to select location"}</option>
              {availableACLocations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
            {isTaskStarted && !acLocations[task.id] && (
              <p className="text-sm text-muted-foreground mt-2">
                {task.task_type === "ac_indoor"
                  ? "Select whether this AC unit is in the Hall or Bedroom"
                  : "Select which AC outdoor unit you're servicing"}
              </p>
            )}
          </div>
        )}

        <div className="bg-card border-2 border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">Photo Documentation</h3>
            {hasEnoughPhotos && <span className="text-sm text-primary font-medium">✓ Photos complete</span>}
          </div>

          {/* Room Photos */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-foreground">
                {isLiftTask ? "Lift" : "Room"} Photos * ({taskPhotos.room_photos.length})
              </label>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  disabled={!isTaskStarted}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) uploadPhoto(task.id, file, "room_photos")
                    e.target.value = ""
                  }}
                />
                <span
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm ${
                    isTaskStarted
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  Upload
                </span>
              </label>
            </div>
            {taskPhotos.room_photos.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {taskPhotos.room_photos.map((url, index) => (
                  <div key={index} className="relative group">
                    {/* eslint-disable-next-line @next/next/no-img-element -- Captured maintenance photos are stored as in-memory URLs */}
                    <img
                      src={url || "/placeholder.svg"}
                      alt={`${isLiftTask ? "Lift" : "Room"} ${index + 1}`}
                      className="w-full h-24 object-cover rounded-lg border-2 border-border"
                    />
                    <button
                      onClick={() => removePhoto(task.id, "room_photos", index)}
                      className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Proof Photos */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-foreground">
                Proof Photos * ({taskPhotos.proof_photos.length})
              </label>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  disabled={!isTaskStarted}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) uploadPhoto(task.id, file, "proof_photos")
                    e.target.value = ""
                  }}
                />
                <span
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm ${
                    isTaskStarted
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  Upload
                </span>
              </label>
            </div>
            {taskPhotos.proof_photos.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {taskPhotos.proof_photos.map((url, index) => (
                  <div key={index} className="relative group">
                    {/* eslint-disable-next-line @next/next/no-img-element -- Captured maintenance photos are stored as in-memory URLs */}
                    <img
                      src={url || "/placeholder.svg"}
                      alt={`Proof ${index + 1}`}
                      className="w-full h-24 object-cover rounded-lg border-2 border-border"
                    />
                    <button
                      onClick={() => removePhoto(task.id, "proof_photos", index)}
                      className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Notes */}
        <div className="bg-card border-2 border-border rounded-xl p-6">
          <label className="block text-sm font-semibold text-foreground mb-2">Notes (Optional)</label>
          <textarea
            value={notes[task.id] || ""}
            onChange={(e) => setNotes((prev) => ({ ...prev, [task.id]: e.target.value }))}
            placeholder={isTaskStarted ? "Any issues or observations..." : "Start task to add notes"}
            rows={3}
            className="w-full px-4 py-3 border-2 border-border rounded-lg focus:border-primary focus:outline-none resize-none bg-background"
            disabled={!isTaskStarted}
          />
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-card border-t-2 border-border p-6 space-y-3">
        <button
          onClick={() => completeTask(task)}
          disabled={!isTaskStarted}
          className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Check className="w-5 h-5" />
          {isTaskStarted ? "Complete Task" : "Start Task to Complete"}
        </button>
        <button
          onClick={() => setIssueModalOpen(true)}
          disabled={!isTaskStarted}
          className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <AlertTriangle className="w-5 h-5" />
          Raise Issue
        </button>
      </div>

      <RaiseIssueModal open={issueModalOpen} onOpenChange={setIssueModalOpen} onSubmit={handleRaiseIssue} />
    </div>
  )
}
