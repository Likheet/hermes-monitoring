"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import { X, MapPin, Clock, Camera, AlertCircle, User } from "lucide-react"
import type { TaskDefinition, TaskCategory, Priority } from "@/lib/task-definitions"
import { ALL_LOCATIONS, getACLocationsForRoom } from "@/lib/location-data"
import { CATEGORY_COLORS, CATEGORY_LABELS } from "@/lib/task-definitions"
import type { User as WorkerType } from "@/lib/types"
import { getWorkersWithShiftStatusFromUsers } from "@/lib/shift-utils"
import type { Department } from "@/lib/types"

interface TaskAssignmentFormProps {
  task: TaskDefinition
  onCancel: () => void
  onSubmit: (data: TaskAssignmentData) => void
  workers: WorkerType[]
}

export interface TaskAssignmentData {
  taskId: string
  taskName: string
  customTaskName?: string
  category: TaskCategory
  department: Department
  priority: Priority
  duration: number
  location?: string
  acLocation?: string
  additionalDetails?: string
  assignedTo: string
  photoRequired: boolean
  photoCount: number
  isCustomTask: boolean
}

export function TaskAssignmentForm({ task, onCancel, onSubmit, workers }: TaskAssignmentFormProps) {
  // Form state
  const [priority, setPriority] = useState<Priority>(task.priority)
  const [duration, setDuration] = useState(task.duration)
  const [location, setLocation] = useState("")
  const [locationInput, setLocationInput] = useState("")
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false)
  const [acLocation, setAcLocation] = useState("")
  const [additionalDetails, setAdditionalDetails] = useState("")
  const [assignedTo, setAssignedTo] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [customTaskName, setCustomTaskName] = useState("")
  const [selectedDepartment, setSelectedDepartment] = useState<Department>(task.department)
  const [customCategory, setCustomCategory] = useState<TaskCategory>(task.category)
  const [photoRequired, setPhotoRequired] = useState(task.photoRequired)
  const [photoCount, setPhotoCount] = useState(task.photoCount)

  const locationRef = useRef<HTMLDivElement>(null)

  const isOtherTask = task.id === "other-custom-task"

  // Filter workers by department
  const departmentWorkers = useMemo(() => {
    return workers.filter((w) => w.department === selectedDepartment)
  }, [workers, selectedDepartment])

  // Get workers with shift status
  const workersWithShifts = getWorkersWithShiftStatusFromUsers(departmentWorkers)

  // Sort workers: idle first, then busy
  const sortedWorkers = useMemo(() => {
    return [...workersWithShifts].sort((a, b) => {
      const statusOrder = { ON_SHIFT: 0, ENDING_SOON: 1, OFF_DUTY: 2 }
      return statusOrder[a.availability.status] - statusOrder[b.availability.status]
    })
  }, [workersWithShifts])

  // Filter locations based on input
  const filteredLocations = useMemo(() => {
    if (locationInput.length < 1) return ALL_LOCATIONS.slice(0, 10)

    const query = locationInput.toLowerCase()
    return ALL_LOCATIONS.filter((loc) => loc.label.toLowerCase().includes(query)).slice(0, 10)
  }, [locationInput])

  // Get AC locations for selected room
  const acLocations = useMemo(() => {
    if (!task.requiresACLocation || !location) return []
    return getACLocationsForRoom(location)
  }, [location, task.requiresACLocation])

  // Close location suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (locationRef.current && !locationRef.current.contains(event.target as Node)) {
        setShowLocationSuggestions(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Handle location selection
  const handleLocationSelect = (loc: (typeof ALL_LOCATIONS)[0]) => {
    setLocation(loc.value)
    setLocationInput(loc.label)
    setShowLocationSuggestions(false)
    // Clear AC location when room changes
    if (task.requiresACLocation) {
      setAcLocation("")
    }
  }

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (isOtherTask && !customTaskName.trim()) {
      newErrors.customTaskName = "Task name is required for custom tasks"
    }

    if (task.requiresRoom && !location) {
      newErrors.location = "Room number or area is required"
    }

    if (task.requiresACLocation && !acLocation) {
      newErrors.acLocation = "AC location is required"
    }

    if (!assignedTo) {
      newErrors.assignedTo = "Please select a worker"
    }

    if (duration < 1 || duration > 300) {
      newErrors.duration = "Duration must be between 1 and 300 minutes"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Handle form submission
  const handleSubmit = () => {
    if (!validateForm()) return

    const data: TaskAssignmentData = {
      taskId: task.id,
      taskName: isOtherTask ? customTaskName : task.name,
      customTaskName: isOtherTask ? customTaskName : undefined,
      category: isOtherTask ? customCategory : task.category,
      department: selectedDepartment,
      priority,
      duration,
      location: task.requiresRoom ? location : undefined,
      acLocation: task.requiresACLocation ? acLocation : undefined,
      additionalDetails: additionalDetails || undefined,
      assignedTo,
      photoRequired: isOtherTask ? photoRequired : task.photoRequired,
      photoCount: isOtherTask ? photoCount : task.photoCount,
      isCustomTask: isOtherTask,
    }

    onSubmit(data)
  }

  return (
    <div className="mt-6 p-6 bg-card border-2 border-border rounded-xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-xl font-bold text-foreground">{task.name}</h2>
            <span
              className={`px-3 py-1 rounded-lg border text-sm font-medium ${CATEGORY_COLORS[isOtherTask ? customCategory : task.category]}`}
            >
              {CATEGORY_LABELS[isOtherTask ? customCategory : task.category]}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Department: <span className="font-medium capitalize">{selectedDepartment}</span>
          </p>
        </div>
        <button onClick={onCancel} className="p-2 hover:bg-muted rounded-lg transition-colors" aria-label="Cancel">
          <X className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      <div className="space-y-5">
        {isOtherTask && (
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">
              Task Name <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={customTaskName}
              onChange={(e) => setCustomTaskName(e.target.value)}
              placeholder="Enter custom task name..."
              maxLength={100}
              className={`w-full px-4 py-3 border-2 rounded-lg focus:border-ring focus:outline-none bg-background text-foreground ${
                errors.customTaskName ? "border-destructive" : "border-border"
              }`}
            />
            {errors.customTaskName && (
              <p className="mt-1 text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {errors.customTaskName}
              </p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              This will notify the admin to potentially add it as a permanent task type
            </p>
          </div>
        )}

        {isOtherTask && (
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">
              Task Category <span className="text-destructive">*</span>
            </label>
            <select
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value as TaskCategory)}
              className="w-full px-4 py-3 border-2 border-border rounded-lg focus:border-ring focus:outline-none bg-background text-foreground"
            >
              <option value="GUEST_REQUEST">Guest Issue</option>
              <option value="ROOM_CLEANING">Room Cleaning</option>
              <option value="COMMON_AREA">Common Area</option>
              <option value="MAINTENANCE">Maintenance</option>
              <option value="INSPECTION">Inspection</option>
              <option value="LAUNDRY">Laundry</option>
              <option value="SUPPLIES">Supplies</option>
            </select>
            <p className="mt-1 text-xs text-muted-foreground">Select the category that best describes this task</p>
          </div>
        )}

        {isOtherTask && (
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">Department</label>
            <select
              value={selectedDepartment}
              onChange={(e) => {
                setSelectedDepartment(e.target.value as Department)
                setAssignedTo("") // Reset worker selection when department changes
              }}
              className="w-full px-4 py-3 border-2 border-border rounded-lg focus:border-ring focus:outline-none bg-background text-foreground"
            >
              <option value="housekeeping">Housekeeping</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>
        )}

        {isOtherTask && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-foreground">Photo Required</label>
              <button
                type="button"
                onClick={() => {
                  setPhotoRequired(!photoRequired)
                  if (!photoRequired) {
                    setPhotoCount(1) // Default to 1 photo when enabled
                  }
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  photoRequired ? "bg-primary" : "bg-muted"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    photoRequired ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
            {photoRequired && (
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">Number of Photos</label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={photoCount}
                  onChange={(e) => setPhotoCount(Math.max(1, Math.min(5, Number(e.target.value))))}
                  className="w-full px-4 py-2 border-2 border-border rounded-lg focus:border-ring focus:outline-none bg-background text-foreground"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Specify how many photos the worker must upload (1-5)
                </p>
              </div>
            )}
          </div>
        )}

        {/* Priority (Editable) */}
        <div>
          <label className="block text-sm font-semibold text-foreground mb-2">Priority Level</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
            className="w-full px-4 py-3 border-2 border-border rounded-lg focus:border-ring focus:outline-none bg-background text-foreground"
          >
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        {/* Duration (Editable) */}
        <div>
          <label className="block text-sm font-semibold text-foreground mb-2">Expected Duration (minutes)</label>
          <div className="relative">
            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="number"
              min="1"
              max="300"
              step="5"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className={`w-full pl-11 pr-4 py-3 border-2 rounded-lg focus:border-ring focus:outline-none bg-background text-foreground ${
                errors.duration ? "border-destructive" : "border-border"
              }`}
            />
          </div>
          {errors.duration && (
            <p className="mt-1 text-sm text-destructive flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {errors.duration}
            </p>
          )}
        </div>

        {/* Location (Autocomplete) - Only if required */}
        {task.requiresRoom && (
          <div ref={locationRef}>
            <label className="block text-sm font-semibold text-foreground mb-2">Room Number or Area</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                value={locationInput}
                onChange={(e) => {
                  setLocationInput(e.target.value)
                  setShowLocationSuggestions(true)
                }}
                onFocus={() => setShowLocationSuggestions(true)}
                placeholder="Type room number (511) or area (Pool, Lobby)"
                className={`w-full pl-11 pr-4 py-3 border-2 rounded-lg focus:border-ring focus:outline-none bg-background text-foreground ${
                  errors.location ? "border-destructive" : "border-border"
                }`}
              />

              {/* Location Suggestions Dropdown */}
              {showLocationSuggestions && filteredLocations.length > 0 && (
                <div className="absolute z-50 w-full mt-2 bg-card border-2 border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {filteredLocations.map((loc) => (
                    <button
                      key={loc.value}
                      onClick={() => handleLocationSelect(loc)}
                      className="w-full text-left px-4 py-2 hover:bg-muted border-b border-border last:border-b-0"
                    >
                      <span className="text-sm font-medium text-foreground">{loc.label}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {loc.type === "room" ? "(Guest Room)" : "(Common Area)"}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {errors.location && (
              <p className="mt-1 text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {errors.location}
              </p>
            )}
          </div>
        )}

        {/* AC Location - Only for AC maintenance tasks */}
        {task.requiresACLocation && location && acLocations.length > 0 && (
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">AC Location</label>
            <select
              value={acLocation}
              onChange={(e) => setAcLocation(e.target.value)}
              className={`w-full px-4 py-3 border-2 rounded-lg focus:border-ring focus:outline-none bg-background text-foreground ${
                errors.acLocation ? "border-destructive" : "border-border"
              }`}
            >
              <option value="">Select AC location...</option>
              {acLocations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
            {errors.acLocation && (
              <p className="mt-1 text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {errors.acLocation}
              </p>
            )}
          </div>
        )}

        {/* Additional Details - Only for Guest Requests */}
        {task.category === "GUEST_REQUEST" && (
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">Additional Details (Optional)</label>
            <textarea
              value={additionalDetails}
              onChange={(e) => setAdditionalDetails(e.target.value)}
              placeholder="e.g., Guest in Room 511 says AC making loud noise..."
              rows={3}
              maxLength={500}
              className="w-full px-4 py-3 border-2 border-border rounded-lg focus:border-ring focus:outline-none resize-none bg-background text-foreground"
            />
            <p className="mt-1 text-xs text-muted-foreground text-right">{additionalDetails.length}/500 characters</p>
          </div>
        )}

        {/* Assign To Worker */}
        <div>
          <label className="block text-sm font-semibold text-foreground mb-2">Assign To Worker</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className={`w-full pl-11 pr-4 py-3 border-2 rounded-lg focus:border-ring focus:outline-none appearance-none bg-background text-foreground ${
                errors.assignedTo ? "border-destructive" : "border-border"
              }`}
            >
              <option value="">Select a worker...</option>
              {sortedWorkers.map((worker) => (
                <option key={worker.id} value={worker.id}>
                  {worker.name} -{" "}
                  {worker.availability.status === "ON_SHIFT"
                    ? "✅ Available"
                    : worker.availability.status === "ENDING_SOON"
                      ? `⚠️ Shift ending in ${worker.availability.minutesUntilEnd}min`
                      : "❌ Off Duty"}
                </option>
              ))}
            </select>
          </div>
          {errors.assignedTo && (
            <p className="mt-1 text-sm text-destructive flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {errors.assignedTo}
            </p>
          )}
        </div>

        {/* Read-only Info */}
        <div className="pt-4 border-t-2 border-border">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Camera className="w-4 h-4" />
              <span>
                {(isOtherTask ? photoRequired : task.photoRequired)
                  ? `${isOtherTask ? photoCount : task.photoCount} photo${(isOtherTask ? photoCount : task.photoCount) > 1 ? "s" : ""} required`
                  : "No photos required"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="font-medium capitalize">{selectedDepartment}</span> Department
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onCancel}
            className="flex-1 px-6 py-3 border-2 border-border text-foreground font-semibold rounded-lg hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors"
          >
            Assign Task
          </button>
        </div>
      </div>
    </div>
  )
}
