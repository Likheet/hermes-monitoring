"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import { X, MapPin, Clock, Camera, AlertCircle, User } from "lucide-react"
import type { TaskDefinition, TaskCategory, Priority } from "@/lib/task-definitions"
import { ALL_LOCATIONS, getACLocationsForRoom } from "@/lib/location-data"
import { CATEGORY_COLORS, CATEGORY_LABELS } from "@/lib/task-definitions"
import type { User as WorkerType } from "@/lib/types"
import {
  getWorkersWithShiftStatusFromUsers,
  isWorkerOnShiftFromUser,
  type WorkerAvailability,
} from "@/lib/shift-utils"
import type { Department } from "@/lib/types"

interface TaskAssignmentFormProps {
  task: TaskDefinition
  onCancel: () => void
  onSubmit: (data: TaskAssignmentData) => void
  workers: WorkerType[]
  currentUser?: WorkerType | null
  workersLoaded?: boolean
  workersLoadError?: boolean
  initialData?: {
    assignedTo?: string
    location?: string
    remarks?: string
  }
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
  remarks?: string
  assignedTo: string
  photoRequired: boolean
  photoCount: number
  photoDocumentationRequired: boolean
  photoCategories: Array<{ name: string; count: number; description?: string }>
  //
  isCustomTask: boolean
}

export function TaskAssignmentForm({ task, onCancel, onSubmit, workers, initialData, currentUser }: TaskAssignmentFormProps) {
  // Form state
  const [priority, setPriority] = useState<Priority>(task.priority)
  const [duration, setDuration] = useState(task.duration)
  const [location, setLocation] = useState(initialData?.location || "")
  const [locationInput, setLocationInput] = useState(() => {
    if (initialData?.location) {
      const loc = ALL_LOCATIONS.find((l) => l.value === initialData.location)
      return loc?.label || initialData.location
    }
    return ""
  })
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false)
  const [acLocation, setAcLocation] = useState("")
  const [remarks, setRemarks] = useState(initialData?.remarks || "")
  const [assignedTo, setAssignedTo] = useState(initialData?.assignedTo || "")
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [customTaskName, setCustomTaskName] = useState("")
  const [selectedDepartment, setSelectedDepartment] = useState<Department>(task.department)
  const [customCategory, setCustomCategory] = useState<TaskCategory>(task.category)
  const [photoRequired, setPhotoRequired] = useState(task.photoRequired)
  const [photoCount, setPhotoCount] = useState(task.photoCount)
  const [photoDocumentationRequired, setPhotoDocumentationRequired] = useState(task.photoDocumentationRequired || false)
  const [photoCategories, setPhotoCategories] = useState(task.photoCategories || [])
  //

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
    const statusOrder: Record<WorkerAvailability["status"], number> = {
      ON_SHIFT: 0,
      ON_BREAK: 1,
      ENDING_SOON: 2,
      OFF_DUTY: 3,
    }

    return [...workersWithShifts].sort((a, b) => statusOrder[a.availability.status] - statusOrder[b.availability.status])
  }, [workersWithShifts])

  const assigneeOptions = useMemo(() => {
    if (!currentUser) return sortedWorkers

    const alreadyIncluded = sortedWorkers.some((worker) => worker.id === currentUser.id)
    if (alreadyIncluded) return sortedWorkers

    return [
      {
        ...currentUser,
        availability: isWorkerOnShiftFromUser(currentUser),
      },
      ...sortedWorkers,
    ]
  }, [sortedWorkers, currentUser])

  const formatAvailabilityLabel = (availability: WorkerAvailability) => {
    switch (availability.status) {
      case "ON_SHIFT":
        return "✅ Available"
      case "ENDING_SOON":
        return availability.minutesUntilEnd ? `⚠️ Shift ending in ${availability.minutesUntilEnd}min` : "⚠️ Ending soon"
      case "ON_BREAK":
        return "☕ On Break"
      default:
        return "❌ Off Duty"
    }
  }

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
      newErrors.assignedTo = "Please select an assignee"
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
      remarks: remarks || undefined,
      assignedTo,
      photoRequired: isOtherTask ? photoRequired : task.photoRequired,
      photoCount: isOtherTask ? photoCount : task.photoCount,
      photoDocumentationRequired: isOtherTask ? photoDocumentationRequired : task.photoDocumentationRequired || false,
      photoCategories: isOtherTask ? photoCategories : task.photoCategories || [],
      //
      isCustomTask: isOtherTask,
    }

    console.log("[v0] Task assignment data:", {
      taskName: data.taskName,
      photoRequired: data.photoRequired,
      photoCount: data.photoCount,
      photoDocumentationRequired: data.photoDocumentationRequired,
      photoCategoriesCount: data.photoCategories.length,
      //
      isCustomTask: data.isCustomTask,
    })

    onSubmit(data)
  }

  const totalPhotosRequired = photoDocumentationRequired
    ? photoCategories.reduce((sum, cat) => sum + cat.count, 0)
    : photoCount
  const photoTypesCount = photoDocumentationRequired ? photoCategories.length : 0
  //

  return (
    <div className="mt-4 sm:mt-6 p-4 sm:p-6 bg-card border-2 border-border rounded-xl">
      <div className="flex items-start justify-between mb-4 sm:mb-6 gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 sm:gap-3 mb-2 flex-wrap">
            <h2 className="text-lg sm:text-xl font-bold text-foreground truncate">{task.name}</h2>
            <span
              className={`px-2 sm:px-3 py-1 rounded-lg border text-xs sm:text-sm font-medium shrink-0 ${CATEGORY_COLORS[isOtherTask ? customCategory : task.category]}`}
            >
              {CATEGORY_LABELS[isOtherTask ? customCategory : task.category]}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Department: <span className="font-medium capitalize">{selectedDepartment}</span>
          </p>
        </div>
        <button
          onClick={onCancel}
          className="p-2 hover:bg-muted rounded-lg transition-colors shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Cancel"
        >
          <X className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      <div className="space-y-4 sm:space-y-5">
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
              className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border-2 rounded-lg focus:border-ring focus:outline-none bg-background text-foreground ${
                errors.customTaskName ? "border-destructive" : "border-border"
              }`}
            />
            {errors.customTaskName && (
              <p className="mt-1 text-xs sm:text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errors.customTaskName}</span>
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
              className={`w-full pl-10 sm:pl-11 pr-3 sm:pr-4 py-2.5 sm:py-3 text-sm sm:text-base border-2 rounded-lg focus:border-ring focus:outline-none bg-background text-foreground ${
                errors.duration ? "border-destructive" : "border-border"
              }`}
            />
          </div>
          {errors.duration && (
            <p className="mt-1 text-xs sm:text-sm text-destructive flex items-center gap-1">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errors.duration}</span>
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

        {/* Remarks field - now available for all tasks */}
        <div>
          <label className="block text-sm font-semibold text-foreground mb-2">Remarks (Optional)</label>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Add any additional notes or instructions for the worker..."
            rows={3}
            maxLength={500}
            className="w-full px-4 py-3 border-2 border-border rounded-lg focus:border-ring focus:outline-none resize-none bg-background text-foreground"
          />
          <p className="mt-1 text-xs text-muted-foreground text-right">{remarks.length}/500 characters</p>
        </div>

        {/* Assignee selection */}
        <div>
          <label className="block text-sm font-semibold text-foreground mb-2">Assign To</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className={`w-full pl-11 pr-4 py-3 border-2 rounded-lg focus:border-ring focus:outline-none appearance-none bg-background text-foreground ${
                errors.assignedTo ? "border-destructive" : "border-border"
              }`}
            >
              <option value="">Select an assignee...</option>
              {assigneeOptions.map((worker) => {
                const isSelf = worker.id === currentUser?.id
                const availabilityLabel = formatAvailabilityLabel(worker.availability)
                const label = isSelf
                  ? `Assign to myself (${worker.name}) - ${availabilityLabel}`
                  : `${worker.name} - ${availabilityLabel}`
                return (
                  <option key={worker.id} value={worker.id}>
                    {label}
                  </option>
                )
              })}
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
                {(isOtherTask ? photoDocumentationRequired : task.photoDocumentationRequired || false)
                  ? `${totalPhotosRequired} photo${totalPhotosRequired > 1 ? "s" : ""} (${photoTypesCount} type${photoTypesCount > 1 ? "s" : ""})`
                  : (isOtherTask ? photoRequired : task.photoRequired)
                    ? `${isOtherTask ? photoCount : task.photoCount} photo${(isOtherTask ? photoCount : task.photoCount) > 1 ? "s" : ""} required`
                    : "No photos required"}
                {/* */}
              </span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="font-medium capitalize">{selectedDepartment}</span> Department
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-2">
          <button
            onClick={onCancel}
            className="w-full sm:flex-1 px-4 sm:px-6 py-3 min-h-[48px] text-sm sm:text-base border-2 border-border text-foreground font-semibold rounded-lg hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="w-full sm:flex-1 px-4 sm:px-6 py-3 min-h-[48px] text-sm sm:text-base bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors"
          >
            Assign Task
          </button>
        </div>
      </div>
    </div>
  )
}
