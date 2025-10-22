"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import { X, MapPin, Clock, Camera, AlertCircle, AlertTriangle, User, Repeat } from "lucide-react"
import type { TaskDefinition, TaskCategory, Priority, RecurringFrequency } from "@/lib/task-definitions"
import { ALL_LOCATIONS, getACLocationsForRoom } from "@/lib/location-data"
import { CATEGORY_COLORS, CATEGORY_LABELS } from "@/lib/task-definitions"
import type { User as WorkerType } from "@/lib/types"
import {
  getWorkersWithShiftStatusFromUsers,
  getWorkersWithShiftStatusFromUsersAndSchedules,
  isWorkerOnShiftFromUser,
  isWorkerOnShiftWithSchedule,
  type WorkerAvailability,
} from "@/lib/shift-utils"
import type { Department } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"

const DEPARTMENT_ORDER: Department[] = ["housekeeping", "maintenance", "front_desk"]

// Departments that should not be available for task assignment
const EXCLUDED_TASK_ASSIGNMENT_DEPARTMENTS: Department[] = ["admin", "housekeeping-dept", "maintenance-dept"]

const RECURRING_FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  daily: "Daily",
  weekly: "Weekly",
  biweekly: "Biweekly",
  monthly: "Monthly",
}

interface TaskAssignmentFormProps {
  task: TaskDefinition
  onCancel: () => void
  onSubmit: (data: TaskAssignmentData) => void
  workers: WorkerType[]
  currentUser?: WorkerType | null
  workersLoaded?: boolean
  workersLoadError?: boolean
  shiftSchedules?: Array<{
    worker_id: string
    schedule_date: string
    shift_start: string
    shift_end: string
    has_break: boolean
    break_start?: string
    break_end?: string
    is_override: boolean
    override_reason?: string
  }>
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
  isRecurring: boolean
  recurringFrequency?: RecurringFrequency | null
  requiresSpecificTime?: boolean
  recurringTime?: string | null
}

export function TaskAssignmentForm({ task, onCancel, onSubmit, workers, initialData, currentUser, shiftSchedules }: TaskAssignmentFormProps) {
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
  const [assignedTo, setAssignedTo] = useState<string>(initialData?.assignedTo ?? "")
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [customTaskName, setCustomTaskName] = useState("")
  const [selectedDepartment, setSelectedDepartment] = useState<Department>(task.department)
  const [customCategory, setCustomCategory] = useState<TaskCategory>(task.category)
  const [photoRequired, setPhotoRequired] = useState(task.photoRequired)
  const [photoCount, setPhotoCount] = useState(task.photoCount)
  const [photoDocumentationRequired, setPhotoDocumentationRequired] = useState(task.photoDocumentationRequired || false)
  const [photoCategories, setPhotoCategories] = useState(task.photoCategories || [])
  //
  const [crossDeptCandidate, setCrossDeptCandidate] = useState<WorkerWithAvailability | null>(null)

  const timezoneOffset = useMemo(() => new Date().getTimezoneOffset(), [])
  const shiftOptions = useMemo(() => ({ timezoneOffsetMinutes: timezoneOffset }), [timezoneOffset])

  // Controlled Select state to prevent DOM errors
  const [selectOpen, setSelectOpen] = useState(false)
  const [frozenStaff, setFrozenStaff] = useState<Record<Department, WorkerWithAvailability[]>>({
    housekeeping: [],
    maintenance: [],
    front_desk: [],
    admin: [],
    "housekeeping-dept": [],
    "maintenance-dept": [],
  })

  const definitionIsRecurring = Boolean(task.isRecurring)
  const definitionRecurringFrequency = task.recurringFrequency ?? null
  const recurringFrequencyLabel = task.recurringFrequency
    ? RECURRING_FREQUENCY_LABELS[task.recurringFrequency]
    : null
  const definitionRequiresSpecificTime = Boolean(task.requiresSpecificTime)
  const definitionRecurringTime =
    definitionRequiresSpecificTime && task.recurringTime ? task.recurringTime : null

  const locationRef = useRef<HTMLDivElement>(null)

  const departmentLabels: Record<Department, string> = {
    housekeeping: "Housekeeping",
    maintenance: "Maintenance",
    front_desk: "Front Desk",
    admin: "Admin",
    "housekeeping-dept": "Housekeeping Department",
    "maintenance-dept": "Maintenance Department",
  }

  const isOtherTask = task.id === "other-custom-task"

  type WorkerWithAvailability = ReturnType<typeof getWorkersWithShiftStatusFromUsers>[number]

  const workersWithShifts = useMemo(() => {
    const now = new Date()
    const currentTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
    const todayStr = now.toISOString().split('T')[0]
    
    console.log("=".repeat(80))
    console.log("[TaskAssignment] ⏰ CURRENT TIME:", currentTimeStr, "DATE:", todayStr)
    console.log("=".repeat(80))
    
    console.log("[TaskAssignment] 📋 RAW DATA:")
    console.log("  - Workers count:", workers.length)
    console.log("  - Has shiftSchedules?", !!shiftSchedules)
    console.log("  - ShiftSchedules count:", shiftSchedules?.length || 0)
    
    if (shiftSchedules && shiftSchedules.length > 0) {
      console.log("\n[TaskAssignment] 📅 SHIFT SCHEDULES (Today only):")
      const todaySchedules = shiftSchedules.filter(s => s.schedule_date === todayStr)
      console.log("  - Today's schedules:", todaySchedules.length)
      todaySchedules.forEach(s => {
        const worker = workers.find(w => w.id === s.worker_id)
        console.log(`    • ${worker?.name || s.worker_id}:`, {
          shift: `${s.shift_start} - ${s.shift_end}`,
          is_override: s.is_override,
          override_reason: s.override_reason || 'none',
          schedule_date: s.schedule_date
        })
      })
    }
    
    console.log("\n[TaskAssignment] 👷 WORKER PROFILES (Default Shifts):")
    workers.forEach(w => {
      console.log(`  • ${w.name}:`, {
        department: w.department,
        default_shift: `${w.shift_start} - ${w.shift_end}`,
        has_break: w.has_break
      })
    })
    
    const allWorkers = shiftSchedules
      ? getWorkersWithShiftStatusFromUsersAndSchedules(workers, shiftSchedules, shiftOptions)
      : getWorkersWithShiftStatusFromUsers(workers, shiftOptions)
    
    console.log("\n[TaskAssignment] ✅ FINAL AVAILABILITY RESULTS:")
    allWorkers.forEach(w => {
      const statusIcon = w.availability.status === "OFF_DUTY" ? "❌" : "✅"
      console.log(`  ${statusIcon} ${w.name}:`, {
        status: w.availability.status,
        shift_times: `${w.shift_start} - ${w.shift_end}`,
        ...(w.availability.shiftStart && { calculated_shift: `${w.availability.shiftStart} - ${w.availability.shiftEnd}` })
      })
    })
    console.log("=".repeat(80))
    
    // Filter out workers from excluded departments
    return allWorkers.filter((worker) => !EXCLUDED_TASK_ASSIGNMENT_DEPARTMENTS.includes(worker.department as Department))
  }, [workers, shiftSchedules, shiftOptions])

  const staffIncludingCurrent = useMemo<WorkerWithAvailability[]>(() => {
    if (!currentUser) return workersWithShifts

    const alreadyIncluded = workersWithShifts.some((worker) => worker.id === currentUser.id)
    if (alreadyIncluded) return workersWithShifts

    const currentUserAvailability = shiftSchedules
      ? isWorkerOnShiftWithSchedule(currentUser, shiftSchedules, shiftOptions)
      : isWorkerOnShiftFromUser(currentUser, shiftOptions)

    return [
      ...workersWithShifts,
      {
        ...currentUser,
        availability: currentUserAvailability,
      },
    ]
  }, [workersWithShifts, currentUser, shiftSchedules])

  const sortedStaff = useMemo(() => {
    const orderByStatus = (status: WorkerAvailability["status"]) => (status === "OFF_DUTY" ? 1 : 0)

    return [...staffIncludingCurrent].sort((a, b) => {
      const statusCompare = orderByStatus(a.availability.status) - orderByStatus(b.availability.status)
      if (statusCompare !== 0) return statusCompare

      const deptCompare =
        DEPARTMENT_ORDER.indexOf(a.department as Department) - DEPARTMENT_ORDER.indexOf(b.department as Department)
      if (deptCompare !== 0) return deptCompare

      return a.name.localeCompare(b.name)
    })
  }, [staffIncludingCurrent])

  const staffGroupedByDepartment = useMemo<Record<Department, WorkerWithAvailability[]>>(() => {
    return DEPARTMENT_ORDER.reduce(
      (acc, dept) => {
        acc[dept] = sortedStaff.filter((worker) => worker.department === dept)
        return acc
      },
      { housekeeping: [], maintenance: [], front_desk: [], admin: [], "housekeeping-dept": [], "maintenance-dept": [] } as Record<Department, WorkerWithAvailability[]>,
    )
  }, [sortedStaff])

  // Freeze staff list while Select is open to prevent DOM reconciliation errors
  useEffect(() => {
    if (!selectOpen) {
      setFrozenStaff(staffGroupedByDepartment)
    }
  }, [selectOpen, staffGroupedByDepartment])

  // Use frozen staff while Select is open, live staff when closed
  const staffToRender = selectOpen ? frozenStaff : staffGroupedByDepartment

  const hasOnDutyStaff = useMemo(
    () => sortedStaff.some((worker) => worker.availability.status !== "OFF_DUTY"),
    [sortedStaff],
  )

  const selectedWorkerEntry = useMemo(
    () => sortedStaff.find((worker) => worker.id === assignedTo),
    [sortedStaff, assignedTo],
  )

  const selectedWorkerLabel = selectedWorkerEntry
    ? `${selectedWorkerEntry.name} (${departmentLabels[selectedWorkerEntry.department as Department]}) • ${
        selectedWorkerEntry.availability.status !== "OFF_DUTY" ? "On Duty" : "Off-Duty"
      }`
    : undefined

  const clearAssignedToError = () =>
    setErrors((prev) => {
      if (!prev.assignedTo) return prev
      const { assignedTo: _removed, ...rest } = prev
      return rest
    })

  const finalizeAssignment = (worker: WorkerWithAvailability) => {
    setAssignedTo(worker.id)
    clearAssignedToError()
  }

  const handleAssigneeSelection = (value: string) => {
    if (!value) {
      setAssignedTo("")
      return
    }

    const worker = sortedStaff.find((candidate) => candidate.id === value)
    if (!worker) {
      setAssignedTo("")
      return
    }

    if (worker.department !== selectedDepartment) {
      setCrossDeptCandidate(worker)
      return
    }

    finalizeAssignment(worker)
  }

  const handleCancelCrossDeptAssignment = () => {
    setCrossDeptCandidate(null)
  }

  const handleConfirmCrossDeptAssignment = () => {
    if (crossDeptCandidate) {
      finalizeAssignment(crossDeptCandidate)
      setCrossDeptCandidate(null)
    }
  }

  const taskDisplayName = useMemo(
    () => (isOtherTask ? (customTaskName.trim() || task.name) : task.name),
    [isOtherTask, customTaskName, task.name],
  )

  const taskDepartmentLabel = departmentLabels[selectedDepartment]
  const crossDeptWorkerLabel = crossDeptCandidate
    ? departmentLabels[crossDeptCandidate.department as Department]
    : ""

  useEffect(() => {
    if (assignedTo && !sortedStaff.some((worker) => worker.id === assignedTo)) {
      setAssignedTo("")
    }
  }, [assignedTo, sortedStaff])

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

    const assignedEntry = sortedStaff.find((worker) => worker.id === assignedTo)
    if (!assignedEntry) {
      setErrors((prev) => ({ ...prev, assignedTo: "Please select an on-duty staff member" }))
      return
    }

    if (assignedEntry.availability.status === "OFF_DUTY") {
      setErrors((prev) => ({ ...prev, assignedTo: "Selected staff member is currently off duty" }))
      return
    }

    clearAssignedToError()

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
      isRecurring: !isOtherTask && definitionIsRecurring,
      recurringFrequency: !isOtherTask && definitionIsRecurring ? definitionRecurringFrequency : null,
      requiresSpecificTime: !isOtherTask && definitionIsRecurring ? definitionRequiresSpecificTime : false,
      recurringTime:
        !isOtherTask && definitionIsRecurring && definitionRequiresSpecificTime ? definitionRecurringTime : null,
    }

    console.log("[v0] Task assignment data:", {
      taskName: data.taskName,
      photoRequired: data.photoRequired,
      photoCount: data.photoCount,
      photoDocumentationRequired: data.photoDocumentationRequired,
      photoCategoriesCount: data.photoCategories.length,
      //
      isCustomTask: data.isCustomTask,
      isRecurring: data.isRecurring,
      recurringFrequency: data.recurringFrequency,
      requiresSpecificTime: data.requiresSpecificTime,
      recurringTime: data.recurringTime,
    })

    onSubmit(data)
  }

  const totalPhotosRequired = photoDocumentationRequired
    ? photoCategories.reduce((sum, cat) => sum + cat.count, 0)
    : photoCount
  const photoTypesCount = photoDocumentationRequired ? photoCategories.length : 0
  //

    return (
      <>
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
            {!isOtherTask && definitionIsRecurring && (
              <Badge variant="outline" className="flex items-center gap-1 border-dashed border-muted-foreground/50">
                <Repeat className="h-3.5 w-3.5" />
                {recurringFrequencyLabel || "Recurring"}
                {definitionRequiresSpecificTime && definitionRecurringTime ? ` @ ${definitionRecurringTime}` : ""}
              </Badge>
            )}
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
              <option value="front_desk">Front Desk</option>
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
            <User className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Select 
              value={assignedTo} 
              onValueChange={handleAssigneeSelection}
              open={selectOpen}
              onOpenChange={setSelectOpen}
            >
              <SelectTrigger aria-invalid={Boolean(errors.assignedTo)} className="pl-9">
                <SelectValue placeholder="Select an assignee...">{selectedWorkerLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent className="min-w-[18rem]">
                {DEPARTMENT_ORDER.map((dept) => {
                  const workersInDept = staffToRender[dept]
                  if (!workersInDept.length) return null

                  return (
                    <SelectGroup key={dept}>
                      <SelectLabel>{departmentLabels[dept]}</SelectLabel>
                      {workersInDept.map((worker) => {
                        const isOnDuty = worker.availability.status !== "OFF_DUTY"
                        return (
                          <SelectItem
                            key={worker.id}
                            value={worker.id}
                            disabled={!isOnDuty}
                            className={cn(!isOnDuty && "opacity-65 cursor-not-allowed")}
                          >
                            <div className="flex w-full items-center justify-between gap-2">
                              <div className="flex flex-col text-left">
                                <span className="font-medium">{worker.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {departmentLabels[worker.department as Department]}
                                </span>
                              </div>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-xs shrink-0",
                                  isOnDuty
                                    ? "border-emerald-200 bg-emerald-100 text-emerald-700"
                                    : "border-slate-200 bg-slate-100 text-slate-500",
                                )}
                              >
                                {isOnDuty ? "On Duty" : "Off-Duty"}
                              </Badge>
                            </div>
                          </SelectItem>
                        )
                      })}
                    </SelectGroup>
                  )
                })}
                {sortedStaff.length === 0 && (
                  <div className="px-3 py-6 text-sm text-muted-foreground">No staff members available.</div>
                )}
              </SelectContent>
            </Select>
          </div>
          {!hasOnDutyStaff && (
            <p className="mt-1 text-xs text-muted-foreground">
              {"No one is currently on duty\u2014showing all staff members."}
            </p>
          )}
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
            {!isOtherTask && definitionIsRecurring && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Repeat className="w-4 h-4" />
                <span>
                  {recurringFrequencyLabel || "Recurring"}
                  {definitionRequiresSpecificTime && definitionRecurringTime ? ` @ ${definitionRecurringTime}` : ""}
                </span>
              </div>
            )}
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

    <AlertDialog
      open={Boolean(crossDeptCandidate)}
      onOpenChange={(open) => {
        if (!open) {
          handleCancelCrossDeptAssignment()
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-amber-100 p-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <AlertDialogTitle>Confirm cross-department assignment</AlertDialogTitle>
          </div>
          <AlertDialogDescription>
            This is a {taskDisplayName} ({taskDepartmentLabel}) task being assigned to{" "}
            {crossDeptWorkerLabel || "another department"} staff. Are you sure you want to proceed?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancelCrossDeptAssignment}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirmCrossDeptAssignment}>Confirm Assignment</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
  )
}
