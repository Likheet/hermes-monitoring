"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CATEGORY_LABELS } from "@/lib/task-definitions"
import type {
  TaskCategory,
  Department,
  Priority,
  TaskDefinition,
  PhotoCategory,
  RecurringFrequency,
} from "@/lib/task-definitions"
import type { CustomTaskDefinition } from "@/lib/custom-task-definitions"
import { updateCustomTaskDefinition, saveCustomTaskDefinition } from "@/lib/custom-task-definitions"
import { useToast } from "@/hooks/use-toast"
import { PhotoCategoryConfig } from "@/components/photo-category-config"

const RECURRING_FREQUENCY_OPTIONS: { value: RecurringFrequency; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Biweekly" },
  { value: "monthly", label: "Monthly" },
]

interface EditTaskDefinitionModalProps {
  task: (TaskDefinition | CustomTaskDefinition) & { isCustom?: boolean }
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function EditTaskDefinitionModal({ task, open, onOpenChange, onSuccess }: EditTaskDefinitionModalProps) {
  const { toast } = useToast()

  const getBooleanValue = (value: unknown, defaultValue = false): boolean => {
    if (typeof value === "boolean") {
      return value
    }
    return defaultValue
  }

  const [formData, setFormData] = useState({
    name: task.name,
    category: task.category,
    department: task.department,
    duration: task.duration,
    priority: task.priority,
    photoRequired: getBooleanValue(task.photoRequired, false),
    photoCount: task.photoCount || 1,
    photoDocumentationRequired: getBooleanValue(task.photoDocumentationRequired, false),
    photoCategories: task.photoCategories || ([] as PhotoCategory[]),
    keywords: task.keywords.join(", "),
    requiresRoom: task.requiresRoom,
    requiresACLocation: task.requiresACLocation,
    isRecurring: getBooleanValue(task.isRecurring, false),
    recurringFrequency: (task.recurringFrequency || "") as RecurringFrequency | "",
    requiresSpecificTime: getBooleanValue(task.requiresSpecificTime, false),
    recurringTime: task.recurringTime || "",
  })

  useEffect(() => {
    setFormData({
      name: task.name,
      category: task.category,
      department: task.department,
      duration: task.duration,
      priority: task.priority,
      photoRequired: getBooleanValue(task.photoRequired, false),
      photoCount: task.photoCount || 1,
      photoDocumentationRequired: getBooleanValue(task.photoDocumentationRequired, false),
      photoCategories: task.photoCategories || ([] as PhotoCategory[]),
      keywords: task.keywords.join(", "),
      requiresRoom: task.requiresRoom,
      requiresACLocation: task.requiresACLocation,
      isRecurring: getBooleanValue(task.isRecurring, false),
      recurringFrequency: (task.recurringFrequency || "") as RecurringFrequency | "",
      requiresSpecificTime: getBooleanValue(task.requiresSpecificTime, false),
      recurringTime: task.recurringTime || "",
    })
  }, [task])

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "Task name is required",
        variant: "destructive",
      })
      return
    }

    if (formData.photoDocumentationRequired && formData.photoCategories.length === 0) {
      toast({
        title: "Error",
        description: "Please configure photo categories or use a template",
        variant: "destructive",
      })
      return
    }

    if (formData.photoRequired && formData.photoCount < 1) {
      toast({
        title: "Error",
        description: "Please specify the number of photos required",
        variant: "destructive",
      })
      return
    }

    if (formData.isRecurring && !formData.recurringFrequency) {
      toast({
        title: "Error",
        description: "Please choose how often this task recurs",
        variant: "destructive",
      })
      return
    }

    if (formData.isRecurring && formData.requiresSpecificTime && !formData.recurringTime) {
      toast({
        title: "Error",
        description: "Please set the preferred time for recurring tasks that need a specific time",
        variant: "destructive",
      })
      return
    }

    const keywordsArray = formData.keywords
      .split(",")
      .map((k) => k.trim())
      .filter((k) => k.length > 0)

    let updated: CustomTaskDefinition | null
    if (task.isCustom) {
      // Update existing custom task
      updated = await updateCustomTaskDefinition(task.id, {
        name: formData.name,
        category: formData.category,
        department: formData.department,
        duration: formData.duration,
        priority: formData.priority,
        photoRequired: formData.photoRequired,
        photoCount: formData.photoCount,
        photoDocumentationRequired: formData.photoDocumentationRequired,
        photoCategories: formData.photoCategories.length > 0 ? formData.photoCategories : undefined,
        keywords: keywordsArray,
        requiresRoom: formData.requiresRoom,
        requiresACLocation: formData.requiresACLocation,
        isRecurring: formData.isRecurring || undefined,
        recurringFrequency: formData.isRecurring ? (formData.recurringFrequency as RecurringFrequency) : undefined,
        requiresSpecificTime: formData.isRecurring ? formData.requiresSpecificTime : undefined,
        recurringTime:
          formData.isRecurring && formData.requiresSpecificTime && formData.recurringTime
            ? formData.recurringTime
            : undefined,
      })
    } else {
      // Create a custom task override with the same ID as the built-in task
      updated = await saveCustomTaskDefinition({
        id: task.id, // Use the same ID to override the built-in task
        name: formData.name,
        category: formData.category,
        department: formData.department,
        duration: formData.duration,
        priority: formData.priority,
        photoRequired: formData.photoRequired,
        photoCount: formData.photoCount,
        photoDocumentationRequired: formData.photoDocumentationRequired,
        photoCategories: formData.photoCategories.length > 0 ? formData.photoCategories : undefined,
        keywords: keywordsArray,
        requiresRoom: formData.requiresRoom,
        requiresACLocation: formData.requiresACLocation,
        isRecurring: formData.isRecurring || undefined,
        recurringFrequency: formData.isRecurring ? (formData.recurringFrequency as RecurringFrequency) : undefined,
        requiresSpecificTime: formData.isRecurring ? formData.requiresSpecificTime : undefined,
        recurringTime:
          formData.isRecurring && formData.requiresSpecificTime && formData.recurringTime
            ? formData.recurringTime
            : undefined,
        createdBy: "admin",
      })
    }

    if (updated) {
      toast({
        title: "Success",
        description: `"${updated.name}" has been updated`,
      })
      onSuccess()
      onOpenChange(false)
    } else {
      toast({
        title: "Error",
        description: "Failed to save task",
        variant: "destructive",
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Task Definition</DialogTitle>
          <DialogDescription>
            Update the task definition. Changes will apply to future task assignments.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-task-name">Task Name *</Label>
            <Input
              id="edit-task-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value as TaskCategory })}
              >
                <SelectTrigger id="edit-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-department">Department</Label>
              <Select
                value={formData.department}
                onValueChange={(value) => setFormData({ ...formData, department: value as Department })}
              >
                <SelectTrigger id="edit-department">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="housekeeping">Housekeeping</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-duration">Expected Duration (minutes)</Label>
              <Input
                id="edit-duration"
                type="number"
                min="5"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: Number.parseInt(e.target.value) || 30 })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-priority">Default Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) => setFormData({ ...formData, priority: value as Priority })}
              >
                <SelectTrigger id="edit-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-keywords">Search Keywords (comma-separated)</Label>
            <Textarea
              id="edit-keywords"
              value={formData.keywords}
              onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
              rows={2}
            />
          </div>

          <PhotoCategoryConfig
            photoRequired={formData.photoRequired}
            photoCount={formData.photoCount}
            photoDocumentationRequired={formData.photoDocumentationRequired}
            categories={formData.photoCategories}
            onChange={(config) =>
              setFormData({
                ...formData,
                photoRequired: config.photoRequired,
                photoCount: config.photoCount,
                photoDocumentationRequired: config.photoDocumentationRequired,
                photoCategories: config.categories,
              })
            }
          />

          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-lg border border-dashed border-muted-foreground/40 p-3 bg-muted/30">
              <input
                type="checkbox"
                id="edit-is-recurring"
                checked={formData.isRecurring}
                onChange={(e) => {
                  const checked = e.target.checked
                  setFormData({
                    ...formData,
                    isRecurring: checked,
                    recurringFrequency: checked ? formData.recurringFrequency : "",
                    requiresSpecificTime: checked ? formData.requiresSpecificTime : false,
                    recurringTime: checked ? formData.recurringTime : "",
                  })
                }}
                className="h-4 w-4 mt-1"
              />
              <div className="space-y-1">
                <Label htmlFor="edit-is-recurring" className="cursor-pointer">
                  Mark as recurring task
                </Label>
                <p className="text-xs text-muted-foreground">
                  Recurring tasks stay on the front-office radar so the team can schedule them proactively.
                </p>
              </div>
            </div>

            {formData.isRecurring && (
              <div className="ml-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-recurring-frequency">Recurring frequency *</Label>
                  <Select
                    value={formData.recurringFrequency || ""}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        recurringFrequency: value as RecurringFrequency,
                      })
                    }
                  >
                    <SelectTrigger id="edit-recurring-frequency">
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      {RECURRING_FREQUENCY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      id="edit-requires-specific-time"
                      checked={formData.requiresSpecificTime}
                      onChange={(e) => {
                        const checked = e.target.checked
                        setFormData({
                          ...formData,
                          requiresSpecificTime: checked,
                          recurringTime: checked ? formData.recurringTime : "",
                        })
                      }}
                      className="h-4 w-4 mt-1"
                    />
                    <div className="space-y-1">
                      <Label htmlFor="edit-requires-specific-time" className="cursor-pointer">
                        Requires specific start time
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        When enabled, set the preferred time so the task is queued for front-office scheduling.
                      </p>
                    </div>
                  </div>

                  {formData.requiresSpecificTime && (
                    <div className="ml-6 space-y-2">
                      <Label htmlFor="edit-recurring-time">Preferred time *</Label>
                      <Input
                        id="edit-recurring-time"
                        type="time"
                        value={formData.recurringTime}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            recurringTime: e.target.value,
                          })
                        }
                        className="sm:w-48"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="edit-requires-room"
                checked={formData.requiresRoom}
                onChange={(e) => setFormData({ ...formData, requiresRoom: e.target.checked })}
                className="h-4 w-4"
              />
              <Label htmlFor="edit-requires-room" className="cursor-pointer">
                Requires room number
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="edit-requires-ac-location"
                checked={formData.requiresACLocation}
                onChange={(e) => setFormData({ ...formData, requiresACLocation: e.target.checked })}
                className="h-4 w-4"
              />
              <Label htmlFor="edit-requires-ac-location" className="cursor-pointer">
                Requires AC location selection
              </Label>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
