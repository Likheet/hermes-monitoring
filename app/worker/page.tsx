"use client"

import { ProtectedRoute } from "@/components/protected-route"
import { useAuth } from "@/lib/auth-context"
import { useTasks } from "@/lib/task-context"
import { TaskCard } from "@/components/task-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { LogOut, Bell, AlertCircle, X, Clock, CheckCircle2, XCircle, Trash2, Save, TrendingUp } from "lucide-react"
import { useRouter } from "next/navigation"
import { useRealtimeTasks } from "@/lib/use-realtime-tasks"
import { ConnectionStatus } from "@/components/connection-status"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useEffect, useState } from "react"
import { BottomNav } from "@/components/mobile/bottom-nav"
import { MaintenanceCalendar } from "@/components/maintenance/maintenance-calendar"
import type { MaintenanceTask } from "@/lib/maintenance-types"
import { TASK_TYPE_LABELS } from "@/lib/maintenance-types"
import type { TaskCompletionData } from "@/components/maintenance/room-task-modal"
import { formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { formatShiftRange } from "@/lib/date-utils"
import { ALL_ROOMS } from "@/lib/location-data"

interface Note {
  id: string
  title: string
  content: string
  created_at: Date
  updated_at: Date
}

function WorkerDashboard() {
  const { user, logout } = useAuth()
  const { tasks, dismissRejectedTask, updateMaintenanceTask, maintenanceTasks } = useTasks()
  const router = useRouter()
  const { toast } = useToast()
  const { isConnected } = useRealtimeTasks({
    enabled: true,
    filter: { userId: user?.id },
  })
  const [urgentTaskAlert, setUrgentTaskAlert] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("home")

  const [tasksFilter, setTasksFilter] = useState<"all" | "active" | "completed" | "rejected">("all")

  const [notes, setNotes] = useState<Note[]>([])
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [noteTitle, setNoteTitle] = useState("")
  const [noteContent, setNoteContent] = useState("")

  const [selectedRoom, setSelectedRoom] = useState<string | null>(null)
  const [selectedTasks, setSelectedTasks] = useState<MaintenanceTask[]>([])

  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    console.log("[v0] Worker dashboard loaded for user:", user?.id, user?.name)
  }, [user])

  useEffect(() => {
    if (user?.id) {
      const savedNotes = localStorage.getItem(`notes_${user.id}`)
      if (savedNotes) {
        const parsed = JSON.parse(savedNotes)
        setNotes(
          parsed.map((n: any) => ({ ...n, created_at: new Date(n.created_at), updated_at: new Date(n.updated_at) })),
        )
      }
    }
  }, [user?.id])

  const normalizedDepartment = user?.department?.toLowerCase()
  const isMaintenanceUser = normalizedDepartment === "maintenance"
  const departmentDisplay = user?.department
    ? user.department
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ")
    : ""

  const myTasks = tasks.filter((task) => task.assigned_to_user_id === user?.id)
  const pendingTasks = myTasks.filter((t) => t.status === "PENDING")
  const inProgressTasks = myTasks.filter((t) => t.status === "IN_PROGRESS" || t.status === "PAUSED")
  const completedTasks = myTasks.filter((t) => t.status === "COMPLETED")
  const rejectedTasks = myTasks.filter((t) => t.status === "REJECTED")

  const myMaintenanceTasks = (maintenanceTasks || []).filter(
    (t) => t.assigned_to === user?.id && (t.status === "in_progress" || t.status === "paused"),
  )

  const myCompletedMaintenanceTasks = (maintenanceTasks || []).filter(
    (t) => t.assigned_to === user?.id && t.status === "completed",
  )

  const getMaintenanceTaskLabel = (task: MaintenanceTask) =>
    TASK_TYPE_LABELS[task.task_type] ?? task.task_type.replace(/_/g, " ")

  const getMaintenanceTaskTimestamp = (task: MaintenanceTask) => {
    const timestamps = [task.paused_at, task.started_at, task.completed_at, task.created_at]
      .filter(Boolean)
      .map((value) => new Date(value!).getTime())
      .filter((time) => !Number.isNaN(time))

    return timestamps.length > 0 ? Math.max(...timestamps) : 0
  }

  const getPrimaryMaintenanceTimestamp = (task: MaintenanceTask) => {
    if (task.status === "in_progress" && task.started_at) return task.started_at
    if (task.status === "paused" && task.paused_at) return task.paused_at
    if (task.started_at) return task.started_at
    return task.created_at
  }

  const currentMaintenanceTask = myMaintenanceTasks.length
    ? [...myMaintenanceTasks].sort((a, b) => {
        const statusPriority = (status: MaintenanceTask["status"]) => (status === "in_progress" ? 0 : 1)
        const statusDiff = statusPriority(a.status) - statusPriority(b.status)
        if (statusDiff !== 0) return statusDiff

        return getMaintenanceTaskTimestamp(b) - getMaintenanceTaskTimestamp(a)
      })[0]
    : null

  const maintenanceTaskStatusLabel: Record<MaintenanceTask["status"], string> = {
    pending: "Pending",
    in_progress: "In Progress",
    paused: "Paused",
    completed: "Completed",
  }

  const handleNavigateToMaintenanceTask = (task: MaintenanceTask) => {
    if (!task.room_number) return

    router.push(`/worker/maintenance/${task.room_number}/${task.task_type}/${encodeURIComponent(task.location)}`)
  }

  useEffect(() => {
    console.log("[v0] Worker status check:", {
      userId: user?.id,
      regularTasks: {
        total: myTasks.length,
        inProgress: inProgressTasks.length,
        pending: pendingTasks.length,
      },
      maintenanceTasks: {
        total: maintenanceTasks?.length || 0,
        myActive: myMaintenanceTasks.length,
        myCompleted: myCompletedMaintenanceTasks.length,
        details: myMaintenanceTasks.map((t) => ({
          id: t.id,
          room: t.room_number,
          type: t.task_type,
          status: t.status,
        })),
      },
      workerStatus: inProgressTasks.length > 0 || myMaintenanceTasks.length > 0 ? "BUSY" : "AVAILABLE",
    })
  }, [myTasks, maintenanceTasks, user?.id, myCompletedMaintenanceTasks.length])

  const activeMaintenanceByRoom = myMaintenanceTasks.reduce(
    (acc, task) => {
      if (!acc[task.room_number]) {
        acc[task.room_number] = []
      }
      acc[task.room_number].push(task)
      return acc
    },
    {} as Record<string, typeof myMaintenanceTasks>,
  )

  const partiallyCompletedRooms = Object.entries(
    (maintenanceTasks || [])
      .filter((t) => t.assigned_to === user?.id)
      .reduce(
        (acc, task) => {
          if (!acc[task.room_number]) {
            acc[task.room_number] = []
          }
          acc[task.room_number].push(task)
          return acc
        },
        {} as Record<string, MaintenanceTask[]>,
      ),
  )
    .map(([roomNumber, tasks]) => {
      const completedCount = tasks.filter((t) => t.status === "completed").length
      const totalCount = tasks.length
      return {
        roomNumber,
        completedCount,
        totalCount,
        isPartial: completedCount > 0 && completedCount < totalCount,
        tasks,
      }
    })
    .filter((room) => room.isPartial)
    .sort((a, b) => b.completedCount - a.completedCount)

  const allMyMaintenanceRooms = (maintenanceTasks || [])
    .filter((t) => t.assigned_to === user?.id)
    .reduce(
      (acc, task) => {
        if (!acc[task.room_number]) {
          acc[task.room_number] = []
        }
        acc[task.room_number].push(task)
        return acc
      },
      {} as Record<string, MaintenanceTask[]>,
    )

  const totalRooms = Object.keys(allMyMaintenanceRooms).length
  const completedRooms = Object.values(allMyMaintenanceRooms).filter((tasks) =>
    tasks.every((t) => t.status === "completed"),
  ).length

  const getNearbyRooms = () => {
    const inProgressRooms = Object.keys(activeMaintenanceByRoom)
    if (inProgressRooms.length === 0) return []

    const nearbyRooms: Array<{ roomNumber: string; floor: number; block: string }> = []

    inProgressRooms.forEach((roomNum) => {
      const room = ALL_ROOMS.find((r) => r.number === roomNum)
      if (!room) return

      const sameFloorRooms = ALL_ROOMS.filter(
        (r) =>
          r.floor === room.floor &&
          r.block === room.block &&
          r.number !== roomNum &&
          !Object.keys(activeMaintenanceByRoom).includes(r.number) &&
          !(activeMaintenanceByRoom[r.number]?.every((t) => t.status === "completed") ?? false),
      ).slice(0, 3)

      nearbyRooms.push(...sameFloorRooms.map((r) => ({ roomNumber: r.number, floor: r.floor, block: r.block })))
    })

    return nearbyRooms.slice(0, 6)
  }

  const nearbyRooms = getNearbyRooms()

  useEffect(() => {
    const urgentTask = pendingTasks.find((t) => t.priority_level === "GUEST_REQUEST")
    if (urgentTask) {
      setUrgentTaskAlert(urgentTask.id)
      setTimeout(() => setUrgentTaskAlert(null), 10000)
    }
  }, [pendingTasks])

  const handleLogout = () => {
    logout()
    router.push("/login")
  }

  const handleDismissRejection = (taskId: string) => {
    if (user) {
      dismissRejectedTask(taskId, user.id)
    }
  }

  const saveNotes = (updatedNotes: Note[]) => {
    localStorage.setItem(`notes_${user?.id}`, JSON.stringify(updatedNotes))
    setNotes(updatedNotes)
  }

  const handleSaveNote = () => {
    if (!noteTitle.trim() || !noteContent.trim()) {
      toast({
        title: "Error",
        description: "Please enter both title and content",
        variant: "destructive",
      })
      return
    }

    if (editingNote) {
      const updatedNotes = notes.map((n) =>
        n.id === editingNote.id ? { ...n, title: noteTitle, content: noteContent, updated_at: new Date() } : n,
      )
      saveNotes(updatedNotes)
      toast({ title: "Note updated successfully" })
    } else {
      const newNote: Note = {
        id: `note-${Date.now()}`,
        title: noteTitle,
        content: noteContent,
        created_at: new Date(),
        updated_at: new Date(),
      }
      saveNotes([newNote, ...notes])
      toast({ title: "Note created successfully" })
    }

    setNoteTitle("")
    setNoteContent("")
    setEditingNote(null)
  }

  const handleEditNote = (note: Note) => {
    setEditingNote(note)
    setNoteTitle(note.title)
    setNoteContent(note.content)
  }

  const handleDeleteNote = (noteId: string) => {
    const updatedNotes = notes.filter((n) => n.id !== noteId)
    saveNotes(updatedNotes)
    toast({ title: "Note deleted" })
  }

  const handleCancelNote = () => {
    setNoteTitle("")
    setNoteContent("")
    setEditingNote(null)
  }

  const handleRoomClick = (roomNumber: string, tasks: MaintenanceTask[]) => {
    console.log("[v0] Navigating to room:", roomNumber)
    router.push(`/worker/maintenance/${roomNumber}`)
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "COMPLETED":
      case "VERIFIED":
        return <CheckCircle2 className="h-4 w-4" />
      case "REJECTED":
        return <XCircle className="h-4 w-4" />
      case "IN_PROGRESS":
        return <Clock className="h-4 w-4" />
      case "PAUSED":
        return <AlertCircle className="h-4 w-4" />
      default:
        return null
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETED":
      case "VERIFIED":
        return "bg-accent/10 text-accent-foreground border-accent"
      case "REJECTED":
        return "bg-destructive/10 text-destructive border-destructive"
      case "IN_PROGRESS":
        return "bg-primary/10 text-primary border-primary"
      case "PAUSED":
        return "bg-muted text-muted-foreground border-border"
      default:
        return "bg-muted text-muted-foreground border-border"
    }
  }

  const overdueTasks = myTasks.filter((t) => {
    if (t.status !== "IN_PROGRESS" && t.status !== "PAUSED") return false
    if (!t.started_at || !t.expected_duration_minutes) return false
    const elapsed = Date.now() - new Date(t.started_at.client).getTime()
    const pausedTime = t.pause_history.reduce((total, pause) => {
      if (!pause.resumed_at) return total
      return total + (new Date(pause.resumed_at.client).getTime() - new Date(pause.paused_at.client).getTime())
    }, 0)
    const activeTime = elapsed - pausedTime
    return activeTime > t.expected_duration_minutes * 60 * 1000
  })

  const onTimeTasks = completedTasks.filter((t) => {
    if (!t.actual_duration_minutes || !t.expected_duration_minutes) return false
    return t.actual_duration_minutes <= t.expected_duration_minutes
  })

  const tasksWithRating = completedTasks.filter((t) => t.rating !== null && t.rating !== undefined)
  const avgRating =
    tasksWithRating.length > 0
      ? (tasksWithRating.reduce((sum, t) => sum + (t.rating || 0), 0) / tasksWithRating.length).toFixed(1)
      : "N/A"

  const totalTasks = myTasks.length
  const completionRate = totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 0
  const onTimeRate = completedTasks.length > 0 ? Math.round((onTimeTasks.length / completedTasks.length) * 100) : 0

  const avgCompletionTime =
    completedTasks.length > 0
      ? Math.round(completedTasks.reduce((sum, t) => sum + (t.actual_duration_minutes || 0), 0) / completedTasks.length)
      : 0

  const initials = user?.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()

  const renderContent = () => {
    switch (activeTab) {
      case "tasks":
        const filteredTasks = myTasks.filter((task) => {
          if (tasksFilter === "all") return true
          if (tasksFilter === "active")
            return task.status === "PENDING" || task.status === "IN_PROGRESS" || task.status === "PAUSED"
          if (tasksFilter === "completed") return task.status === "COMPLETED" || task.status === "VERIFIED"
          if (tasksFilter === "rejected") return task.status === "REJECTED"
          return true
        })

        return (
          <main className="container mx-auto px-4 py-6 space-y-4">
            <div className="flex gap-2 overflow-x-auto pb-2">
              {[
                { value: "all", label: "All" },
                { value: "active", label: "Active" },
                { value: "completed", label: "Completed" },
                { value: "rejected", label: "Rejected" },
              ].map((tab) => (
                <Button
                  key={tab.value}
                  variant={tasksFilter === tab.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTasksFilter(tab.value as any)}
                  className="whitespace-nowrap"
                >
                  {tab.label}
                </Button>
              ))}
            </div>

            {filteredTasks.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No tasks found</p>
              </div>
            ) : (
              filteredTasks.map((task) => (
                <Card
                  key={task.id}
                  className="p-4 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => router.push(`/worker/${task.id}`)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className={cn("gap-1", getStatusColor(task.status))}>
                          {getStatusIcon(task.status)}
                          {task.status.replace("_", " ")}
                        </Badge>
                        {task.priority_level === "GUEST_REQUEST" && (
                          <Badge variant="destructive" className="text-xs">
                            High Priority
                          </Badge>
                        )}
                      </div>

                      <h3 className="font-semibold text-lg mb-1">{task.task_type}</h3>
                      <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{task.description}</p>

                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Room {task.room_number}</span>
                        {task.assigned_at && (
                          <span>
                            Assigned {formatDistanceToNow(new Date(task.assigned_at.client), { addSuffix: true })}
                          </span>
                        )}
                      </div>

                      {task.rating && (
                        <div className="mt-2 flex items-center gap-1">
                          <span className="text-sm font-medium">Rating:</span>
                          <span className="text-accent-foreground">{"★".repeat(task.rating)}</span>
                          <span className="text-muted">{"★".repeat(5 - task.rating)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))
            )}
          </main>
        )

      case "notes":
        return (
          <main className="container mx-auto px-4 py-6 space-y-6 max-w-4xl">
            <Card>
              <CardHeader>
                <CardTitle>{editingNote ? "Edit Note" : "New Note"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Note title..."
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  className="text-lg font-medium"
                />
                <Textarea
                  placeholder="Write your note here..."
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  rows={6}
                  className="resize-none"
                />
                <div className="flex gap-2">
                  <Button onClick={handleSaveNote} className="flex-1">
                    <Save className="h-4 w-4 mr-2" />
                    {editingNote ? "Update Note" : "Save Note"}
                  </Button>
                  {editingNote && (
                    <Button variant="outline" size="sm" onClick={handleCancelNote}>
                      Cancel
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              {notes.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No notes yet. Create your first note above!</p>
                </div>
              ) : (
                notes.map((note) => (
                  <Card key={note.id} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-2 flex-1">
                          <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                          <CardTitle className="text-lg">{note.title}</CardTitle>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleEditNote(note)}>
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteNote(note.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </main>
        )

      case "profile":
        return (
          <main className="container mx-auto px-4 py-6 space-y-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <Avatar className="h-20 w-20">
                    <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold">{user?.name}</h2>
                    <p className="text-muted-foreground">{user?.role}</p>
                    <div className="mt-2 space-y-1">
                      <Badge variant="secondary">{departmentDisplay}</Badge>
                      {user?.phone && <p className="text-sm text-muted-foreground">📞 {user.phone}</p>}
                      {user?.shift_start && user?.shift_end && (
                        <p className="text-sm text-muted-foreground">
                          🕐 {formatShiftRange(user.shift_start, user.shift_end)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalTasks}</div>
                  <p className="text-xs text-muted-foreground">{completedTasks.length} completed</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{completionRate}%</div>
                  <p className="text-xs text-muted-foreground">All time average</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg. Completion Time</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{avgCompletionTime}m</div>
                  <p className="text-xs text-muted-foreground">Per task</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{avgRating}</div>
                  <p className="text-xs text-muted-foreground">Out of 5 stars</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">On-Time Rate</CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{onTimeRate}%</div>
                  <p className="text-xs text-muted-foreground">Tasks completed on time</p>
                </CardContent>
              </Card>
            </div>
          </main>
        )

      case "scheduled":
        return (
          <main className="container mx-auto px-4 py-6">
            <MaintenanceCalendar
              onRoomClick={handleRoomClick}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
            />
          </main>
        )

      case "home":
      default:
        return (
          <main className="container mx-auto px-4 py-6 space-y-6">
            {urgentTaskAlert && (
              <Alert className="border-destructive/50 bg-destructive/10">
                <Bell className="h-4 w-4 text-destructive" />
                <AlertDescription className="text-destructive">
                  <strong>Urgent Guest Request!</strong> A new high-priority task has been assigned to you.
                </AlertDescription>
              </Alert>
            )}

            {isMaintenanceUser && currentMaintenanceTask && currentMaintenanceTask.room_number && (
              <Card
                className="cursor-pointer border-2 border-accent bg-accent/20 shadow-lg transition-all hover:shadow-xl hover:border-accent/80"
                onClick={() => handleNavigateToMaintenanceTask(currentMaintenanceTask)}
              >
                <CardContent className="p-6 flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge
                          variant={currentMaintenanceTask.status === "in_progress" ? "default" : "secondary"}
                          className="text-sm font-semibold"
                        >
                          {currentMaintenanceTask.status === "in_progress" ? "● WORKING NOW" : "⏸ PAUSED"}
                        </Badge>
                      </div>
                      <h2 className="text-2xl font-bold text-foreground mb-1">
                        {getMaintenanceTaskLabel(currentMaintenanceTask)}
                      </h2>
                      <p className="text-base font-medium text-muted-foreground">
                        Room {currentMaintenanceTask.room_number}
                        {currentMaintenanceTask.location && ` • ${currentMaintenanceTask.location}`}
                      </p>
                      {(() => {
                        const timestamp = getPrimaryMaintenanceTimestamp(currentMaintenanceTask)
                        if (!timestamp) return null

                        const date = new Date(timestamp)
                        if (Number.isNaN(date.getTime())) return null

                        return (
                          <p className="text-sm text-muted-foreground mt-2">
                            {currentMaintenanceTask.status === "paused" ? "Paused" : "Started"}{" "}
                            {formatDistanceToNow(date, { addSuffix: true })}
                          </p>
                        )
                      })()}
                    </div>
                  </div>

                  <p className="text-base font-medium text-foreground">
                    {currentMaintenanceTask.status === "in_progress"
                      ? "👉 Tap to continue your active maintenance task"
                      : "👉 Tap to resume this paused task"}
                  </p>

                  <Button size="lg" className="w-full sm:w-auto font-semibold">
                    {currentMaintenanceTask.status === "in_progress" ? "Continue Task →" : "Resume Task →"}
                  </Button>
                </CardContent>
              </Card>
            )}

            {(() => {
              console.log("[v0] Home view state:", {
                hasCurrentMaintenanceTask: !!currentMaintenanceTask,
                currentMaintenanceTaskRoom: currentMaintenanceTask?.room_number,
                myMaintenanceTasksCount: myMaintenanceTasks.length,
                myTasksCount: myTasks.length,
                inProgressTasksCount: inProgressTasks.length,
                pendingTasksCount: pendingTasks.length,
                completedTasksCount: completedTasks.length,
                completedMaintenanceTasksCount: myCompletedMaintenanceTasks.length,
                totalCompletedCount: completedTasks.length + myCompletedMaintenanceTasks.length,
              })
              return null
            })()}

            {isMaintenanceUser && totalRooms > 0 && (
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-semibold text-foreground">
                      {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })} Progress
                    </h2>
                    <div className="text-2xl font-bold text-primary">
                      {completedRooms}/{totalRooms}
                    </div>
                  </div>
                  <div className="w-full bg-muted rounded-full h-3">
                    <div
                      className="bg-primary h-3 rounded-full transition-all"
                      style={{ width: `${(completedRooms / totalRooms) * 100}%` }}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {Math.round((completedRooms / totalRooms) * 100)}% of rooms completed this month
                  </p>
                </CardContent>
              </Card>
            )}

            {isMaintenanceUser && nearbyRooms.length > 0 && (
              <section>
                <h2 className="text-base md:text-lg font-semibold mb-3">💡 Smart Suggestions</h2>
                <p className="text-sm text-muted-foreground mb-3">Rooms on the same floor as your current work</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {nearbyRooms.map((room) => {
                    const roomTasks = (maintenanceTasks || []).filter(
                      (t) => t.room_number === room.roomNumber && t.assigned_to === user?.id,
                    )
                    const completedCount = roomTasks.filter((t) => t.status === "completed").length

                    return (
                      <Card
                        key={room.roomNumber}
                        className="cursor-pointer hover:shadow-md transition-shadow border-accent/50"
                        onClick={() => router.push(`/worker/maintenance/${room.roomNumber}`)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-semibold text-lg">{room.roomNumber}</h3>
                            <Badge variant="outline" className="text-xs">
                              Floor {room.floor}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {completedCount}/{roomTasks.length} tasks
                          </p>
                          <Button size="sm" className="w-full">
                            Start
                          </Button>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </section>
            )}

            {isMaintenanceUser && Object.keys(activeMaintenanceByRoom).length > 0 && (
              <section>
                <h2 className="text-base md:text-lg font-semibold mb-3 text-black">🔧 Active Maintenance Tasks</h2>
                <div className="space-y-3">
                  {Object.entries(activeMaintenanceByRoom).map(([roomNumber, tasks]) => {
                    const inProgressCount = tasks.filter((t) => t.status === "in_progress").length
                    const pausedCount = tasks.filter((t) => t.status === "paused").length

                    return (
                      <Card
                        key={roomNumber}
                        className="cursor-pointer hover:shadow-md transition-shadow border-accent/50 bg-accent/5"
                        onClick={() => router.push(`/worker/maintenance/${roomNumber}`)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <h3 className="font-semibold text-lg mb-1">Room {roomNumber}</h3>
                              <p className="text-sm text-muted-foreground mb-2">
                                {inProgressCount > 0 && (
                                  <span className="text-accent font-medium">● {inProgressCount} in progress</span>
                                )}
                                {inProgressCount > 0 && pausedCount > 0 && <span className="mx-2">•</span>}
                                {pausedCount > 0 && (
                                  <span className="text-muted-foreground">⏸ {pausedCount} paused</span>
                                )}
                              </p>
                              <div className="flex gap-2 flex-wrap">
                                {tasks.map((task) => (
                                  <Badge
                                    key={task.id}
                                    variant={task.status === "in_progress" ? "default" : "outline"}
                                    className="text-xs"
                                  >
                                    {task.task_type === "ac_indoor"
                                      ? "AC Indoor"
                                      : task.task_type === "ac_outdoor"
                                        ? "AC Outdoor"
                                        : task.task_type === "fan"
                                          ? "Fan"
                                          : "Exhaust"}
                                    {task.status === "in_progress" && " ●"}
                                    {task.status === "paused" && " ⏸"}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-2xl font-bold text-accent">{tasks.length}</div>
                              <p className="text-xs text-muted-foreground bg-background">Active</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </section>
            )}

            {myTasks.filter((t) => t.status === "REJECTED").length > 0 && (
              <section>
                <h2 className="text-base md:text-lg font-semibold mb-3 text-destructive">Rejected Tasks</h2>
                <div className="space-y-4">
                  {myTasks
                    .filter((t) => t.status === "REJECTED")
                    .map((task) => (
                      <Card key={task.id} className="border-destructive/50 bg-destructive/10">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2 flex-1">
                              <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                              <CardTitle className="text-lg">{task.task_type}</CardTitle>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDismissRejection(task.id)}
                              className="h-8 w-8 text-destructive hover:bg-destructive/20"
                              title="Dismiss rejection"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <p className="text-sm font-medium text-destructive">
                            <strong>Rejection Reason:</strong> {task.supervisor_remark || "No reason provided"}
                          </p>
                          {task.rejection_proof_photo_url && (
                            <div className="mt-2">
                              <p className="text-sm font-medium text-destructive mb-2">Proof Photo:</p>
                              <img
                                src={task.rejection_proof_photo_url || "/placeholder.svg"}
                                alt="Rejection proof"
                                className="w-full max-w-sm rounded-lg border-2 border-destructive/50"
                              />
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground">Room: {task.room_number}</p>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              </section>
            )}

            {inProgressTasks.length > 0 && (
              <section>
                <h2 className="text-base md:text-lg font-semibold mb-3">In Progress</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {inProgressTasks.map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                </div>
              </section>
            )}

            {pendingTasks.length > 0 && (
              <section>
                <h2 className="text-base md:text-lg font-semibold mb-3">Pending Tasks</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {pendingTasks.map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                </div>
              </section>
            )}

            {completedTasks.length > 0 && (
              <section>
                <h2 className="text-base md:text-lg font-semibold mb-3">Completed</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {completedTasks.map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                </div>
              </section>
            )}

            {myTasks.length === 0 && myMaintenanceTasks.length === 0 && partiallyCompletedRooms.length === 0 && (
              <div className="flex min-h-[400px] items-center justify-center">
                <div className="text-center space-y-2">
                  <p className="text-muted-foreground">No tasks assigned</p>
                  {(completedTasks.length > 0 || myCompletedMaintenanceTasks.length > 0) && (
                    <p className="text-sm text-muted-foreground">
                      You've completed {completedTasks.length + myCompletedMaintenanceTasks.length} task(s) today
                    </p>
                  )}
                </div>
              </div>
            )}
          </main>
        )
    }
  }

  return (
    <div className="flex flex-col h-screen bg-muted/30">
      <header className="border-b bg-background sticky top-0 z-40 shrink-0">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold">
              {activeTab === "home"
                ? "My Tasks"
                : activeTab === "tasks"
                  ? "All Tasks"
                  : activeTab === "notes"
                    ? "My Notes"
                    : activeTab === "profile"
                      ? "Profile"
                      : "Schedule"}
            </h1>
            {activeTab !== "scheduled" && (
              <p className="text-xs md:text-sm text-muted-foreground">
                {user?.name}
                {departmentDisplay && (
                  <span className="ml-1 text-muted-foreground">- {departmentDisplay}</span>
                )}
                {(inProgressTasks.length > 0 || myMaintenanceTasks.length > 0) && (
                  <span className="ml-2 text-accent font-medium">● Busy</span>
                )}
                {inProgressTasks.length === 0 && myMaintenanceTasks.length === 0 && (
                  <span className="ml-2 text-muted-foreground">○ Available</span>
                )}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ConnectionStatus isConnected={isConnected} />
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="min-h-[44px] min-w-[44px] bg-transparent"
            >
              <LogOut className="h-5 w-5 md:mr-2" />
              <span className="hidden md:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto pb-20">{renderContent()}</div>

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  )
}

export default function WorkerPage() {
  return (
    <ProtectedRoute allowedRoles={["worker"]}>
      <WorkerDashboard />
    </ProtectedRoute>
  )
}
