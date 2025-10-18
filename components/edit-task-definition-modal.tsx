"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CATEGORY_LABELS } from "@/lib/task-definitions"
import type { TaskCategory, Department, Priority, TaskDefinition, PhotoCategory } from "@/lib/task-definitions"
import type { CustomTaskDefinition } from "@/lib/custom-task-definitions"
import { updateCustomTaskDefinition, saveCustomTaskDefinition } from "@/lib/custom-task-definitions"
import { useToast } from "@/hooks/use-toast"
import { PhotoCategoryConfig } from "@/components/photo-category-config"

interface EditTaskDefinitionModalProps {
  task: (TaskDefinition | CustomTaskDefinition) & { isCustom?: boolean }
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function EditTaskDefinitionModal({ task, open, onOpenChange, onSuccess }: EditTaskDefinitionModalProps) {
  const { toast } = useToast()
  const [formData, setFormData] = useState({
    name: task.name,
    category: task.category,
    department: task.department,
    duration: task.duration,
    priority: task.priority,
    photoRequired: task.photoRequired || false,
    photoCount: task.photoCount || 1,
    photoDocumentationRequired: task.photoDocumentationRequired || false,
    photoCategories: task.photoCategories || ([] as PhotoCategory[]),
    keywords: task.keywords.join(", "),
    requiresRoom: task.requiresRoom,
    requiresACLocation: task.requiresACLocation,
  })

  useEffect(() => {
    setFormData({
      name: task.name,
      category: task.category,
      department: task.department,
      duration: task.duration,
      priority: task.priority,
      photoRequired: task.photoRequired || false,
      photoCount: task.photoCount || 1,
      photoDocumentationRequired: task.photoDocumentationRequired || false,
      photoCategories: task.photoCategories || ([] as PhotoCategory[]),
      keywords: task.keywords.join(", "),
      requiresRoom: task.requiresRoom,
      requiresACLocation: task.requiresACLocation,
    })
  }, [task])

  const handleSave = () => {
    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "Task name is required",
        variant: "destructive",
      })
      return
    }

    const keywordsArray = formData.keywords
      .split(",")
      .map((k) => k.trim())
      .filter((k) => k.length > 0)

    let updated
    if (task.isCustom) {
      // Update existing custom task
      updated = updateCustomTaskDefinition(task.id, {
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
      })
    } else {
      // Create a custom task override with the same ID as the built-in task
      updated = saveCustomTaskDefinition({
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
