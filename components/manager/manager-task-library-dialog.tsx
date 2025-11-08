"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Plus, Loader2, Edit3 } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PhotoCategoryConfig } from "@/components/photo-category-config"
import { EditTaskDefinitionModal } from "@/components/edit-task-definition-modal"
import { useToast } from "@/hooks/use-toast"
import type { User } from "@/lib/types"
import {
  CATEGORY_LABELS,
  TASK_DEFINITIONS,
  type Department,
  type PhotoCategory,
  type Priority,
  type RecurringFrequency,
  type TaskCategory,
  type TaskDefinition,
} from "@/lib/task-definitions"
import {
  getAllTaskDefinitions,
  getCustomTaskDefinitions,
  saveCustomTaskDefinition,
  type CustomTaskDefinition,
} from "@/lib/custom-task-definitions"

interface ManagerTaskLibraryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentUser: User | null
}

interface ManagerTaskForm {
  name: string
  category: TaskCategory
  department: Department
  duration: number
  priority: Priority
  keywords: string
  photoRequired: boolean
  photoCount: number
  photoDocumentationRequired: boolean
  photoCategories: PhotoCategory[]
  requiresRoom: boolean
  requiresACLocation: boolean
  isRecurring: boolean
  recurringFrequency: RecurringFrequency | ""
  requiresSpecificTime: boolean
  recurringTime: string
}

const normalizeDepartment = (department: User["department"] | undefined | null): Department => {
  if (department === "maintenance" || department === "maintenance-dept") {
    return "maintenance"
  }
  return "housekeeping"
}

const createDefaultForm = (user: User | null): ManagerTaskForm => ({
  name: "",
  category: "GUEST_REQUEST",
  department: normalizeDepartment(user?.department),
  duration: 30,
  priority: "medium",
  keywords: "",
  photoRequired: false,
  photoCount: 1,
  photoDocumentationRequired: false,
  photoCategories: [],
  requiresRoom: true,
  requiresACLocation: false,
  isRecurring: false,
  recurringFrequency: "",
  requiresSpecificTime: false,
  recurringTime: "",
})

const frequencyOptions: { value: RecurringFrequency; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Biweekly" },
  { value: "monthly", label: "Monthly" },
  { value: "custom", label: "Custom" },
]

const isCustomDefinition = (
  task: TaskDefinition | CustomTaskDefinition,
): task is CustomTaskDefinition => Boolean((task as CustomTaskDefinition).isCustom)

export function ManagerTaskLibraryDialog({ open, onOpenChange, currentUser }: ManagerTaskLibraryDialogProps) {
  const { toast } = useToast()
  const managerId = currentUser?.id ?? ""

  const [form, setForm] = useState<ManagerTaskForm>(() => createDefaultForm(currentUser))
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [customTasks, setCustomTasks] = useState<CustomTaskDefinition[]>([])
  const [libraryTasks, setLibraryTasks] = useState<Array<TaskDefinition | CustomTaskDefinition>>(TASK_DEFINITIONS)
  const [editingTask, setEditingTask] = useState<(TaskDefinition | CustomTaskDefinition) & { isCustom?: boolean } | null>(
    null,
  )
  const [editOpen, setEditOpen] = useState(false)

  const resetForm = useCallback(() => {
    setForm(createDefaultForm(currentUser))
  }, [currentUser])

  const loadTaskData = useCallback(async () => {
    if (!open) return
    setIsLoading(true)
    try {
      const [customDefs, allDefs] = await Promise.all([getCustomTaskDefinitions(), getAllTaskDefinitions()])
      const ownedCustomTasks = customDefs.filter((task) => (managerId ? task.createdBy === managerId : false))

      const filteredLibrary = allDefs
        .filter((task) => {
          if (isCustomDefinition(task)) {
            return managerId ? task.createdBy === managerId : false
          }
          return true
        })
        .sort((a, b) => a.name.localeCompare(b.name))

      setCustomTasks(ownedCustomTasks)
      setLibraryTasks(filteredLibrary)
    } catch (error) {
      console.error("Failed to load task definitions:", error)
      toast({
        title: "Unable to load tasks",
        description: "Please try again later.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [open, managerId, toast])

  useEffect(() => {
    if (!open) {
      return
    }

    loadTaskData()

    const handler = () => {
      loadTaskData()
    }

    window.addEventListener("customTasksUpdated", handler)
    return () => {
      window.removeEventListener("customTasksUpdated", handler)
    }
  }, [open, loadTaskData])

  useEffect(() => {
    if (!open) {
      resetForm()
    }
  }, [open, resetForm])

  const managerCanCreate = Boolean(managerId)

  const managerCustomCount = useMemo(() => customTasks.length, [customTasks])

  const handleCreateTask = async () => {
    if (!managerCanCreate) {
      toast({
        title: "Login required",
        description: "Please sign in again to add task types.",
        variant: "destructive",
      })
      return
    }

    if (!form.name.trim()) {
      toast({ title: "Missing name", description: "Enter a task name before saving.", variant: "destructive" })
      return
    }

    if (form.photoDocumentationRequired && form.photoCategories.length === 0) {
      toast({
        title: "Photo categories required",
        description: "Add at least one photo category or disable categorized photos.",
        variant: "destructive",
      })
      return
    }

    if (form.photoRequired && form.photoCount < 1) {
      toast({
        title: "Photo count",
        description: "Set how many photos are required.",
        variant: "destructive",
      })
      return
    }

    if (form.isRecurring && !form.recurringFrequency) {
      toast({
        title: "Recurring frequency",
        description: "Choose how often this task repeats.",
        variant: "destructive",
      })
      return
    }

    if (form.isRecurring && form.requiresSpecificTime && !form.recurringTime) {
      toast({
        title: "Preferred time",
        description: "Set the preferred time for this recurring task.",
        variant: "destructive",
      })
      return
    }

    setIsSaving(true)
    try {
      const keywordsArray = form.keywords
        .split(",")
        .map((keyword) => keyword.trim())
        .filter((keyword) => keyword.length > 0)

      const newTask = await saveCustomTaskDefinition({
        name: form.name,
        category: form.category,
        department: form.department,
        duration: form.duration,
        priority: form.priority,
        keywords: keywordsArray,
  photoRequired: form.photoRequired,
  photoCount: form.photoRequired ? form.photoCount : 0,
        photoDocumentationRequired: form.photoDocumentationRequired,
        photoCategories: form.photoDocumentationRequired ? form.photoCategories : undefined,
        requiresRoom: form.requiresRoom,
        requiresACLocation: form.requiresACLocation,
        isRecurring: form.isRecurring,
        recurringFrequency: form.isRecurring ? (form.recurringFrequency as RecurringFrequency) : undefined,
        requiresSpecificTime: form.isRecurring ? form.requiresSpecificTime : false,
        recurringTime:
          form.isRecurring && form.requiresSpecificTime && form.recurringTime ? form.recurringTime : undefined,
        createdBy: managerId,
      })

      toast({
        title: "Task added",
        description: `"${newTask.name}" is now part of your custom library.`,
      })
      resetForm()
      loadTaskData()
    } catch (error) {
      console.error("Failed to create custom task:", error)
      toast({
        title: "Save failed",
        description: "We could not save this task type. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const openEditDialog = (task: TaskDefinition | CustomTaskDefinition) => {
    setEditingTask(task)
    setEditOpen(true)
  }

  const onEditSuccess = async () => {
    await loadTaskData()
    setEditingTask(null)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>Add New Task Type</DialogTitle>
          <DialogDescription>Build your own task types and manage the ones you rely on most.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[calc(90vh-5rem)] overflow-y-auto px-6 pb-6">
          <Tabs defaultValue="add" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="add">Add Task</TabsTrigger>
              <TabsTrigger value="mine">My Custom Tasks</TabsTrigger>
              <TabsTrigger value="library">Task Library</TabsTrigger>
            </TabsList>

            <TabsContent value="add" className="space-y-5 pb-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="manager-task-name">Task Name *</Label>
                  <Input
                    id="manager-task-name"
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                    placeholder="e.g., VIP Room Inspection"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2 sm:col-span-1 md:grid-cols-1 md:col-span-1">
                  <div className="space-y-2">
                    <Label htmlFor="manager-category">Category</Label>
                    <Select
                      value={form.category}
                      onValueChange={(value) => setForm({ ...form, category: value as TaskCategory })}
                    >
                      <SelectTrigger id="manager-category">
                        <SelectValue placeholder="Select category" />
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
                    <Label htmlFor="manager-department">Department</Label>
                    <Select
                      value={form.department}
                      onValueChange={(value) => setForm({ ...form, department: value as Department })}
                    >
                      <SelectTrigger id="manager-department">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="housekeeping">Housekeeping</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="manager-duration">Expected Duration (minutes)</Label>
                  <Input
                    id="manager-duration"
                    type="number"
                    min={5}
                    value={form.duration}
                    onChange={(event) =>
                      setForm({ ...form, duration: Number.parseInt(event.target.value, 10) || form.duration })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manager-priority">Default Priority</Label>
                  <Select value={form.priority} onValueChange={(value) => setForm({ ...form, priority: value as Priority })}>
                    <SelectTrigger id="manager-priority">
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
                <Label htmlFor="manager-keywords">Search Keywords</Label>
                <Textarea
                  id="manager-keywords"
                  rows={2}
                  placeholder="e.g., vip, inspection, audit"
                  value={form.keywords}
                  onChange={(event) => setForm({ ...form, keywords: event.target.value })}
                />
              </div>

              <PhotoCategoryConfig
                photoRequired={form.photoRequired}
                photoCount={form.photoCount}
                photoDocumentationRequired={form.photoDocumentationRequired}
                categories={form.photoCategories}
                onChange={(config) =>
                  setForm({
                    ...form,
                    photoRequired: config.photoRequired,
                    photoCount: config.photoCount,
                    photoDocumentationRequired: config.photoDocumentationRequired,
                    photoCategories: config.categories,
                  })
                }
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex items-center gap-2 rounded-lg border border-dashed border-muted-foreground/40 p-3">
                  <input
                    type="checkbox"
                    checked={form.requiresRoom}
                    onChange={(event) => setForm({ ...form, requiresRoom: event.target.checked })}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">Requires room/area selection</span>
                </label>
                <label className="flex items-center gap-2 rounded-lg border border-dashed border-muted-foreground/40 p-3">
                  <input
                    type="checkbox"
                    checked={form.requiresACLocation}
                    onChange={(event) => setForm({ ...form, requiresACLocation: event.target.checked })}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">Requires AC location</span>
                </label>
              </div>

              <div className="space-y-4 rounded-lg border border-dashed border-primary/30 bg-primary/5 p-4">
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={form.isRecurring}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        isRecurring: event.target.checked,
                        recurringFrequency: event.target.checked ? form.recurringFrequency : "",
                        requiresSpecificTime: event.target.checked ? form.requiresSpecificTime : false,
                        recurringTime: event.target.checked ? form.recurringTime : "",
                      })
                    }
                    className="mt-1 h-4 w-4"
                  />
                  <div className="space-y-1">
                    <span className="text-sm font-medium">Schedule this task to recur</span>
                    <span className="text-xs text-muted-foreground">
                      Perfect for checklists that should appear on a predictable cadence.
                    </span>
                  </div>
                </label>

                {form.isRecurring && (
                  <div className="space-y-4 pl-6">
                    <div className="space-y-2">
                      <Label htmlFor="manager-recurring-frequency">Frequency *</Label>
                      <Select
                        value={form.recurringFrequency || ""}
                        onValueChange={(value) =>
                          setForm({ ...form, recurringFrequency: value as RecurringFrequency | "" })
                        }
                      >
                        <SelectTrigger id="manager-recurring-frequency">
                          <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                        <SelectContent>
                          {frequencyOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <label className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={form.requiresSpecificTime}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            requiresSpecificTime: event.target.checked,
                            recurringTime: event.target.checked ? form.recurringTime || "" : "",
                          })
                        }
                        className="mt-1 h-4 w-4"
                      />
                      <div className="space-y-1">
                        <span className="text-sm font-medium">Send at a specific time</span>
                        <span className="text-xs text-muted-foreground">
                          Great for morning walk-throughs or nightly audits.
                        </span>
                      </div>
                    </label>

                    {form.requiresSpecificTime && (
                      <div className="space-y-2 pl-6">
                        <Label htmlFor="manager-recurring-time">Preferred time *</Label>
                        <Input
                          id="manager-recurring-time"
                          type="time"
                          value={form.recurringTime}
                          onChange={(event) => setForm({ ...form, recurringTime: event.target.value })}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <Button onClick={handleCreateTask} disabled={isSaving}>
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  Save Task Type
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="mine" className="pb-6">
              {isLoading ? (
                <div className="py-12 text-center text-sm text-muted-foreground">Loading your task types…</div>
              ) : managerCustomCount === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  You have not created any custom task types yet.
                </div>
              ) : (
                <div className="h-[360px] overflow-y-auto pr-2">
                  <div className="space-y-3">
                    {customTasks.map((task) => (
                      <Card key={task.id} className="border-border">
                        <CardHeader className="flex flex-row items-center justify-between gap-2">
                          <div>
                            <CardTitle className="text-base font-semibold">{task.name}</CardTitle>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <Badge variant="secondary">{CATEGORY_LABELS[task.category]}</Badge>
                              <span>Department: {task.department}</span>
                              <span>Priority: {task.priority}</span>
                            </div>
                          </div>
                          <Button variant="outline" size="sm" onClick={() => openEditDialog(task)}>
                            <Edit3 className="mr-1.5 h-4 w-4" /> Edit
                          </Button>
                        </CardHeader>
                        <CardContent className="text-xs text-muted-foreground">
                          Added on {new Date(task.createdAt).toLocaleString()}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="library" className="pb-6">
              {isLoading ? (
                <div className="py-12 text-center text-sm text-muted-foreground">Loading task library…</div>
              ) : (
                <div className="h-[360px] overflow-y-auto pr-2">
                  <div className="space-y-3">
                    {libraryTasks.map((task) => (
                      <Card key={task.id} className="border-border">
                        <CardHeader className="flex flex-row items-center justify-between gap-2">
                          <div>
                            <CardTitle className="text-base font-semibold">{task.name}</CardTitle>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <Badge variant="secondary">{CATEGORY_LABELS[task.category]}</Badge>
                              <span>Department: {task.department}</span>
                              <span>Priority: {task.priority}</span>
                              {isCustomDefinition(task) && task.createdBy !== managerId && (
                                <span className="font-medium text-amber-600">Created by admin</span>
                              )}
                            </div>
                          </div>
                          <Button variant="outline" size="sm" onClick={() => openEditDialog(task)}>
                            <Edit3 className="mr-1.5 h-4 w-4" /> Edit
                          </Button>
                        </CardHeader>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>

      {editingTask && (
        <EditTaskDefinitionModal
          task={editingTask}
          open={editOpen}
          onOpenChange={(value) => {
            setEditOpen(value)
            if (!value) {
              setEditingTask(null)
            }
          }}
          createdByUserId={managerId || undefined}
          onSuccess={onEditSuccess}
        />
      )}
    </Dialog>
  )
}
