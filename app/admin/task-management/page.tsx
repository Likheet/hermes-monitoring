"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ProtectedRoute } from "@/components/protected-route"
import { useAuth } from "@/lib/auth-context"
import { useTasks } from "@/lib/task-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Plus, Trash2, Search, AlertCircle, CheckCircle, Clock, MapPin, Camera, Edit } from "lucide-react"
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/task-definitions"
import type { TaskCategory, Department, Priority } from "@/lib/task-definitions"
import type { Task } from "@/lib/types"
import {
  getCustomTaskDefinitions,
  saveCustomTaskDefinition,
  deleteCustomTaskDefinition,
  getAllTaskDefinitions,
  type CustomTaskDefinition,
} from "@/lib/custom-task-definitions"
import { useToast } from "@/hooks/use-toast"
import { EditTaskDefinitionModal } from "@/components/edit-task-definition-modal"

function TaskManagementPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { tasks, users } = useTasks()
  const { toast } = useToast()

  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<TaskCategory | "ALL">("ALL")
  const [customTaskDefs, setCustomTaskDefs] = useState<CustomTaskDefinition[]>([])
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<any>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)

  const createDefaultNewTaskForm = () => ({
    name: "",
    category: "GUEST_REQUEST" as TaskCategory,
    department: "housekeeping" as Department,
    duration: 30,
    priority: "medium" as Priority,
    photoRequired: true,
    photoCount: 1,
    keywords: "",
    requiresRoom: false,
    requiresACLocation: false,
  })

  const [newTaskForm, setNewTaskForm] = useState(createDefaultNewTaskForm)

  useEffect(() => {
    setCustomTaskDefs(getCustomTaskDefinitions())
  }, [])

  const customTasks = tasks.filter(
    (task) =>
      task.is_custom_task ||
      task.custom_task_name ||
      task.task_type === "Other (Custom Task)" ||
      task.task_type.startsWith("[CUSTOM]"),
  )

  const getUserName = (userId: string) => users.find((u) => u.id === userId)?.name || "Front Office"

  const allTaskDefinitions = getAllTaskDefinitions()

  const filteredTasks = allTaskDefinitions.filter((task) => {
    const matchesSearch =
      task.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.keywords.some((k) => k.toLowerCase().includes(searchQuery.toLowerCase()))
    const matchesCategory = selectedCategory === "ALL" || task.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const handleAddCustomTask = () => {
    if (!newTaskForm.name.trim()) {
      toast({
        title: "Error",
        description: "Task name is required",
        variant: "destructive",
      })
      return
    }

    const keywordsArray = newTaskForm.keywords
      .split(",")
      .map((k) => k.trim())
      .filter((k) => k.length > 0)

    const newTask = saveCustomTaskDefinition({
      name: newTaskForm.name,
      category: newTaskForm.category,
      department: newTaskForm.department,
      duration: newTaskForm.duration,
      priority: newTaskForm.priority,
      photoRequired: newTaskForm.photoRequired,
      photoCount: newTaskForm.photoCount,
      keywords: keywordsArray,
      requiresRoom: newTaskForm.requiresRoom,
      requiresACLocation: newTaskForm.requiresACLocation,
      createdBy: user?.id || "unknown",
    })

    setCustomTaskDefs(getCustomTaskDefinitions())
    setIsAddDialogOpen(false)

    setNewTaskForm(createDefaultNewTaskForm())

    toast({
      title: "Success",
      description: `"${newTask.name}" has been added to the task library`,
    })
  }

  const openAddDialogWithCustomTask = (task: Task) => {
    const name = task.custom_task_name || task.task_type
    const category = (task.custom_task_category as TaskCategory) || "GUEST_REQUEST"
    const priority = (task.custom_task_priority as Priority) || "medium"
    const photoRequiredValue = task.custom_task_photo_required ?? task.photo_required ?? false
    const photoRequired = !!photoRequiredValue
    const photoCount =
      task.custom_task_photo_count ?? (photoRequired ? Math.max(1, task.photo_urls.length || 1) : 0)

    setNewTaskForm({
      name,
      category,
      department: task.department as Department,
      duration: task.expected_duration_minutes || 30,
      priority,
      photoRequired,
      photoCount,
      keywords: name.toLowerCase(),
      requiresRoom: !!task.room_number,
      requiresACLocation: false,
    })

    setIsAddDialogOpen(true)

    toast({
      title: "Custom request loaded",
      description: `"${name}" has been copied into the Add New Task Type form.`,
    })
  }

  const handleRemoveTask = (taskId: string) => {
    const task = customTaskDefs.find((t) => t.id === taskId)
    if (!task) return

    if (confirm(`Are you sure you want to remove "${task.name}" from the task library?`)) {
      deleteCustomTaskDefinition(taskId)
      setCustomTaskDefs(getCustomTaskDefinitions())

      toast({
        title: "Removed",
        description: `"${task.name}" has been removed from the task library`,
      })
    }
  }

  const handleEditTask = (task: any) => {
    setEditingTask(task)
    setIsEditDialogOpen(true)
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="container mx-auto flex items-center gap-4 px-4 py-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/admin")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Task Management</h1>
            <p className="text-sm text-muted-foreground">Manage task library and review custom task requests</p>
          </div>
          <Dialog
            open={isAddDialogOpen}
            onOpenChange={(open) => {
              setIsAddDialogOpen(open)
              if (!open) {
                setNewTaskForm(createDefaultNewTaskForm())
              }
            }}
          >
            <DialogTrigger asChild>
              <Button onClick={() => setNewTaskForm(createDefaultNewTaskForm())}>
                <Plus className="mr-2 h-4 w-4" />
                Add New Task Type
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Task Type</DialogTitle>
                <DialogDescription>
                  Create a new task type that will be available for front-office to assign
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="task-name">Task Name *</Label>
                  <Input
                    id="task-name"
                    placeholder="e.g., Replace Door Lock"
                    value={newTaskForm.name}
                    onChange={(e) => setNewTaskForm({ ...newTaskForm, name: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select
                      value={newTaskForm.category}
                      onValueChange={(value) => setNewTaskForm({ ...newTaskForm, category: value as TaskCategory })}
                    >
                      <SelectTrigger id="category">
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
                    <Label htmlFor="department">Department</Label>
                    <Select
                      value={newTaskForm.department}
                      onValueChange={(value) => setNewTaskForm({ ...newTaskForm, department: value as Department })}
                    >
                      <SelectTrigger id="department">
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
                    <Label htmlFor="duration">Expected Duration (minutes)</Label>
                    <Input
                      id="duration"
                      type="number"
                      min="5"
                      value={newTaskForm.duration}
                      onChange={(e) =>
                        setNewTaskForm({ ...newTaskForm, duration: Number.parseInt(e.target.value) || 30 })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="priority">Default Priority</Label>
                    <Select
                      value={newTaskForm.priority}
                      onValueChange={(value) => setNewTaskForm({ ...newTaskForm, priority: value as Priority })}
                    >
                      <SelectTrigger id="priority">
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
                  <Label htmlFor="keywords">Search Keywords (comma-separated)</Label>
                  <Textarea
                    id="keywords"
                    placeholder="e.g., lock, door, key, broken"
                    value={newTaskForm.keywords}
                    onChange={(e) => setNewTaskForm({ ...newTaskForm, keywords: e.target.value })}
                    rows={2}
                  />
                  <p className="text-xs text-muted-foreground">
                    These keywords help front-office find this task when searching
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="photo-required"
                      checked={newTaskForm.photoRequired}
                      onChange={(e) => setNewTaskForm({ ...newTaskForm, photoRequired: e.target.checked })}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="photo-required" className="cursor-pointer">
                      Photo documentation required
                    </Label>
                  </div>

                  {newTaskForm.photoRequired && (
                    <div className="ml-6 space-y-2">
                      <Label htmlFor="photo-count">Minimum photos required</Label>
                      <Input
                        id="photo-count"
                        type="number"
                        min="1"
                        max="5"
                        value={newTaskForm.photoCount}
                        onChange={(e) =>
                          setNewTaskForm({ ...newTaskForm, photoCount: Number.parseInt(e.target.value) || 1 })
                        }
                        className="w-24"
                      />
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="requires-room"
                      checked={newTaskForm.requiresRoom}
                      onChange={(e) => setNewTaskForm({ ...newTaskForm, requiresRoom: e.target.checked })}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="requires-room" className="cursor-pointer">
                      Requires room number
                    </Label>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="requires-ac-location"
                      checked={newTaskForm.requiresACLocation}
                      onChange={(e) => setNewTaskForm({ ...newTaskForm, requiresACLocation: e.target.checked })}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="requires-ac-location" className="cursor-pointer">
                      Requires AC location selection
                    </Label>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddCustomTask}>Add Task Type</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-7xl space-y-6">
        {customTasks.length > 0 && (
          <Card className="border-accent">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-accent" />
                {customTasks.length} Custom Task Request{customTasks.length > 1 ? "s" : ""} Pending Review
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Front-office staff have created custom tasks that aren't in the standard library. Review them below and
                add them as permanent task types. Click any request to auto-fill the creation form with its details.
              </p>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="custom" className="space-y-4">
          <TabsList>
            <TabsTrigger value="custom">
              Custom Requests
              {customTasks.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {customTasks.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="library">
              Task Library ({allTaskDefinitions.length})
              {customTaskDefs.length > 0 && (
                <Badge variant="outline" className="ml-2">
                  {customTaskDefs.length} custom
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="custom" className="space-y-4">
            {customTasks.length > 0 ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Click a request to copy its details into the Add New Task Type form.
                </p>
                <div className="grid gap-4">
                  {customTasks.map((task) => {
                    const name = task.custom_task_name || task.task_type
                    const categoryLabel =
                      task.custom_task_category && CATEGORY_LABELS[task.custom_task_category]
                        ? CATEGORY_LABELS[task.custom_task_category]
                        : "Custom Request"
                    const priorityLabel = task.custom_task_priority
                      ? task.custom_task_priority.toUpperCase()
                      : task.priority_level.replace(/_/g, " ")
                    const photoRequiredValue = task.custom_task_photo_required ?? task.photo_required
                    const photoRequired = !!photoRequiredValue
                    const photoCount = task.custom_task_photo_count ?? (photoRequired ? 1 : 0)

                    return (
                      <Card
                        key={task.id}
                        role="button"
                        tabIndex={0}
                        className="cursor-pointer transition border border-border hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => openAddDialogWithCustomTask(task)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault()
                            openAddDialogWithCustomTask(task)
                          }
                        }}
                      >
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 space-y-3">
                              <div>
                                <h3 className="text-lg font-semibold">{name}</h3>
                                <div className="flex flex-wrap items-center gap-2 mt-1 text-sm">
                                  <Badge variant="outline" className="capitalize">
                                    {task.department}
                                  </Badge>
                                  <Badge variant="secondary">{categoryLabel}</Badge>
                                  <Badge variant="outline" className="uppercase tracking-wide">
                                    {priorityLabel}
                                  </Badge>
                                  {task.room_number && (
                                    <span className="text-muted-foreground flex items-center gap-1">
                                      <MapPin className="h-3 w-3" />
                                      Room {task.room_number}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {task.worker_remark && (
                                <div className="p-3 bg-muted rounded-lg">
                                  <p className="text-sm text-muted-foreground">Additional Details:</p>
                                  <p className="text-sm mt-1">"{task.worker_remark}"</p>
                                </div>
                              )}

                              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-4 w-4" />
                                  {task.expected_duration_minutes} min
                                </span>
                                {photoRequired && (
                                  <span className="flex items-center gap-1">
                                    <Camera className="h-4 w-4" />
                                    {photoCount} photo{photoCount === 1 ? "" : "s"}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-2">
                              <Button
                                variant="outline"
                                className="gap-2"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  openAddDialogWithCustomTask(task)
                                }}
                              >
                                <Plus className="h-4 w-4" />
                                Load in Form
                              </Button>
                              <p className="text-xs text-muted-foreground text-right">
                                Created by {getUserName(task.assigned_by_user_id)} on{" "}
                                {new Date(task.assigned_at.client).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <CheckCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Custom Task Requests</h3>
                  <p className="text-sm text-muted-foreground">
                    When front-office creates custom tasks, they'll appear here for review.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="library" className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search tasks by name or keywords..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value as TaskCategory | "ALL")}
                    className="px-4 py-2 border rounded-lg bg-background"
                  >
                    <option value="ALL">All Categories</option>
                    {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-3">
              {filteredTasks.map((task) => {
                const isCustomTask = "isCustom" in task && task.isCustom
                return (
                  <Card key={task.id} className={isCustomTask ? "border-accent/50" : ""}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold">{task.name}</h3>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${CATEGORY_COLORS[task.category]}`}>
                              {CATEGORY_LABELS[task.category]}
                            </span>
                            {isCustomTask && (
                              <Badge variant="outline" className="text-accent border-accent">
                                Custom
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <Badge variant="outline" className="capitalize">
                              {task.department}
                            </Badge>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {task.duration} min
                            </span>
                            {task.photoRequired && (
                              <span className="flex items-center gap-1">
                                <Camera className="h-3 w-3" />
                                {task.photoCount} photo{task.photoCount > 1 ? "s" : ""}
                              </span>
                            )}
                            {task.requiresRoom && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                Room required
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditTask(task)}
                            className="hover:bg-accent/10"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {isCustomTask && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveTask(task.id)}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            {filteredTasks.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">No tasks found matching your search.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {editingTask && (
          <EditTaskDefinitionModal
            task={editingTask}
            open={isEditDialogOpen}
            onOpenChange={setIsEditDialogOpen}
            onSuccess={() => {
              setCustomTaskDefs(getCustomTaskDefinitions())
              setEditingTask(null)
            }}
          />
        )}
      </main>
    </div>
  )
}

export default function TaskManagement() {
  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <TaskManagementPage />
    </ProtectedRoute>
  )
}
