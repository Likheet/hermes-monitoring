"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Plus, PlusSquare, ClipboardList, Clock, CheckCircle2, User as UserIcon, MapPin, LogOut } from "lucide-react"
import { ProtectedRoute } from "@/components/protected-route"
import { ManagerBottomNav } from "@/components/manager/manager-bottom-nav"
import { ManagerTaskLibraryDialog } from "@/components/manager/manager-task-library-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useAuth } from "@/lib/auth-context"
import { useTasks } from "@/lib/task-context"
import { useRealtimeTasks } from "@/lib/use-realtime-tasks"
import { formatDistanceToNow } from "@/lib/date-utils"
import { filterReadyTasks } from "@/lib/task-filters"

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-500",
  IN_PROGRESS: "bg-blue-500",
  PAUSED: "bg-orange-500",
  COMPLETED: "bg-green-500",
  REJECTED: "bg-red-500",
  VERIFIED: "bg-emerald-600",
}


type StatKey = "pending" | "inProgress" | "completed" | "assignedByMe"



function ManagerDashboard() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const { tasks, users } = useTasks()

  const [activeStatKey, setActiveStatKey] = useState<StatKey | null>(null)
  const [isTaskLibraryOpen, setIsTaskLibraryOpen] = useState(false)
  const [nowTick, setNowTick] = useState(() => Date.now())

  useRealtimeTasks({ enabled: true, filter: { role: "manager" } })

  useEffect(() => {
    if (typeof window === "undefined") return

    const intervalId = window.setInterval(() => {
      setNowTick(Date.now())
    }, 30_000)

    return () => window.clearInterval(intervalId)
  }, [])

  const readyTasks = useMemo(() => filterReadyTasks(tasks, nowTick), [tasks, nowTick])

  const handleLogout = async () => {
    await logout()
    router.push("/login")
  }

  const stats = useMemo(() => {
    const now = nowTick
    const DAY_MS = 24 * 60 * 60 * 1000
    const pending = readyTasks.filter((task) => task.status === "PENDING").length
    const inProgress = readyTasks.filter((task) => task.status === "IN_PROGRESS").length
    const completedToday = readyTasks.filter((task) => {
      if (!task.completed_at) return false
      const completedAt = new Date(task.completed_at.client ?? task.completed_at.server ?? "").getTime()
      return Number.isFinite(completedAt) && now - completedAt <= DAY_MS
    }).length
    const assignedByMe = readyTasks.filter((task) => task.assigned_by_user_id === user?.id).length

    return {
      pending,
      inProgress,
      completedToday,
      assignedByMe,
    }
  }, [readyTasks, user?.id, nowTick])

  const statCards = useMemo(() => {
    return [
      {
        key: "pending" as const,
        title: "Pending Tasks",
        value: stats.pending,
        accentClass: "text-yellow-600",
        description: "Tasks waiting to be picked up. Use these to set priorities.",
        href: "/manager/tasks?status=PENDING",
      },
      {
        key: "inProgress" as const,
        title: "In Progress",
        value: stats.inProgress,
        accentClass: "text-blue-600",
        description: "Work that is currently underway for live monitoring.",
        href: "/manager/tasks?status=IN_PROGRESS",
      },
      {
        key: "completed" as const,
        title: "Completed (24h)",
        value: stats.completedToday,
        accentClass: "text-green-600",
        description: "Assignments closed within the last day for quick reporting.",
        href: "/manager/tasks?status=COMPLETED",
      },
      {
        key: "assignedByMe" as const,
        title: "Assigned by You",
        value: stats.assignedByMe,
        accentClass: "text-primary",
        description: "Tasks you issued so you can double-check ownership.",
        href: "/manager/tasks?assignedBy=me",
      },
    ] satisfies Array<{
      key: StatKey
      title: string
      value: number
      accentClass: string
      description: string
      href: string
    }>
  }, [stats])

  const activeStat = activeStatKey ? statCards.find((card) => card.key === activeStatKey) ?? null : null

  const assignmentsByManager = useMemo(
    () =>
      readyTasks
        .filter((task) => task.assigned_by_user_id === user?.id)
        .sort(
          (a, b) =>
            new Date(b.assigned_at.client ?? b.assigned_at.server ?? "").getTime() -
            new Date(a.assigned_at.client ?? a.assigned_at.server ?? "").getTime(),
        )
        .slice(0, 5),
    [readyTasks, user?.id],
  )

  const tasksForManager = useMemo(
    () =>
      readyTasks
        .filter((task) => task.assigned_to_user_id === user?.id)
        .sort(
          (a, b) =>
            new Date(b.assigned_at.client ?? b.assigned_at.server ?? "").getTime() -
            new Date(a.assigned_at.client ?? a.assigned_at.server ?? "").getTime(),
        )
        .slice(0, 5),
    [readyTasks, user?.id],
  )

  const getUserName = (id: string | null | undefined) => {
    if (!id) return "Unassigned"
    return users.find((worker) => worker.id === id)?.name ?? "Unknown"
  }

  const previewTasks = useMemo(() => {
    if (!activeStatKey) return [] as typeof readyTasks

    const limit = 4
    const DAY_MS = 24 * 60 * 60 * 1000
    const now = nowTick

    switch (activeStatKey) {
      case "pending":
        return readyTasks.filter((task) => task.status === "PENDING").slice(0, limit)
      case "inProgress":
        return readyTasks.filter((task) => task.status === "IN_PROGRESS").slice(0, limit)
      case "completed":
        return readyTasks
          .filter((task) => {
            if (!task.completed_at) return false
            const completedAt = new Date(task.completed_at.client ?? task.completed_at.server ?? "").getTime()
            return Number.isFinite(completedAt) && now - completedAt <= DAY_MS
          })
          .slice(0, limit)
      case "assignedByMe":
        return readyTasks.filter((task) => task.assigned_by_user_id === user?.id).slice(0, limit)
      default:
        return []
    }
  }, [activeStatKey, readyTasks, user?.id, nowTick])

  return (
    <div className="min-h-screen bg-muted/30 pb-24 md:pb-12">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Manager Dashboard</h1>
            <p className="text-sm text-muted-foreground">{user?.name}</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild variant="outline" className="min-h-[44px]">
              <Link href="/manager/tasks">
                <ClipboardList className="mr-2 h-4 w-4" />
                View Tasks
              </Link>
            </Button>
            <Button asChild className="min-h-[44px]">
              <Link href="/manager/create-task">
                <Plus className="mr-2 h-4 w-4" />
                Create Task
              </Link>
            </Button>
            <Button variant="ghost" className="min-h-[44px]" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto space-y-6 px-4 py-6">
        <section>
          <Card className="border-dashed border-primary/40 bg-primary/5">
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-lg">Task Type Library</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Build recurring checklists or custom workflows tailored for your property.
                </p>
              </div>
              <Button
                variant="outline"
                className="min-h-[44px] border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                onClick={() => setIsTaskLibraryOpen(true)}
              >
                <PlusSquare className="mr-2 h-4 w-4" />
                Add New Task Type
              </Button>
            </CardHeader>
          </Card>
        </section>

        <section>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {statCards.map((card) => (
              <button
                key={card.key}
                type="button"
                onClick={() => setActiveStatKey(card.key)}
                className="group w-full rounded-lg text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                aria-label={`View summary for ${card.title}`}
              >
                <Card className="transition group-hover:border-primary group-hover:shadow-md">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className={`text-3xl font-semibold ${card.accentClass}`}>{card.value}</p>
                  </CardContent>
                </Card>
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <Card>
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-lg">My Tasks</CardTitle>
                <p className="text-sm text-muted-foreground">Tasks currently assigned to you</p>
              </div>
              <Badge variant="secondary" className="font-medium">
                {tasksForManager.length}
              </Badge>
            </CardHeader>
            <CardContent>
              {tasksForManager.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span>No active tasks assigned to you.</span>
                </div>
              ) : (
                <ul className="space-y-3">
                  {tasksForManager.map((task) => {
                    const assignedAt = new Date(task.assigned_at.client ?? task.assigned_at.server ?? "")
                    const statusClass = STATUS_COLORS[task.status] ?? "bg-muted"

                    return (
                      <li key={task.id}>
                        <Button
                          asChild
                          variant="ghost"
                          className="h-auto w-full justify-start rounded-lg border border-border bg-background p-3 text-left shadow-sm transition hover:bg-accent"
                        >
                          <Link href={`/worker/${task.id}`}>
                            <div className="space-y-1">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-sm font-medium text-foreground">{task.custom_task_name ?? task.task_type}</p>
                                <Badge className={`${statusClass} text-[10px] uppercase tracking-wide text-white`}>
                                  {task.status.replace(/_/g, " ")}
                                </Badge>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                {task.room_number && (
                                  <span className="inline-flex items-center gap-1">
                                    <MapPin className="h-4 w-4" />
                                    Room {task.room_number}
                                  </span>
                                )}
                                {Number.isFinite(assignedAt.getTime()) && (
                                  <span className="inline-flex items-center gap-1">
                                    <Clock className="h-4 w-4" />
                                    {formatDistanceToNow(assignedAt)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </Link>
                        </Button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Recent Assignments</CardTitle>
                <p className="text-sm text-muted-foreground">Latest 5 tasks that you assigned</p>
              </div>
              <Badge variant="secondary" className="font-medium">
                {assignmentsByManager.length}
              </Badge>
            </CardHeader>
            <CardContent>
              {assignmentsByManager.length === 0 ? (
                <p className="text-sm text-muted-foreground">No assignments yet. Create a task to get started.</p>
              ) : (
                <ul className="space-y-3">
                  {assignmentsByManager.map((task) => {
                    const assignedAt = new Date(task.assigned_at.client ?? task.assigned_at.server ?? "")
                    const statusClass = STATUS_COLORS[task.status] ?? "bg-muted"

                    return (
                      <li key={task.id} className="rounded-lg border border-border bg-background p-3 shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-foreground">{task.custom_task_name ?? task.task_type}</p>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1">
                                <UserIcon className="h-3.5 w-3.5" />
                                {getUserName(task.assigned_to_user_id)}
                              </span>
                              {task.room_number && (
                                <span className="inline-flex items-center gap-1">
                                  <MapPin className="h-3.5 w-3.5" />
                                  Room {task.room_number}
                                </span>
                              )}
                              {Number.isFinite(assignedAt.getTime()) && (
                                <span className="inline-flex items-center gap-1">
                                  <Clock className="h-3.5 w-3.5" />
                                  {formatDistanceToNow(assignedAt)}
                                </span>
                              )}
                            </div>
                          </div>
                          <Badge className={`${statusClass} text-[10px] uppercase tracking-wide text-white`}>
                            {task.status.replace(/_/g, " ")}
                          </Badge>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>
      </main>

      <ManagerBottomNav />

      <Dialog
        open={Boolean(activeStat)}
        onOpenChange={(open) => {
          if (!open) {
            setActiveStatKey(null)
          }
        }}
      >
        <DialogContent>
          {activeStat && (
            <>
              <DialogHeader>
                <DialogTitle>{activeStat.title}</DialogTitle>
                <DialogDescription>{activeStat.description}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-xs font-medium uppercase text-muted-foreground">Current Count</p>
                  <p className={`mt-1 text-4xl font-semibold ${activeStat.accentClass}`}>{activeStat.value}</p>
                </div>
                <div className="space-y-3">
                  {previewTasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No tasks to preview here right now. Use "More details" to open the full view.
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {previewTasks.map((task) => {
                        const assignedAt = new Date(task.assigned_at?.client ?? task.assigned_at?.server ?? "")
                        const statusClass = STATUS_COLORS[task.status] ?? "bg-muted"

                        return (
                          <li key={task.id} className="rounded-lg border border-border bg-background p-3 shadow-sm">
                            <div className="flex items-start justify-between gap-2">
                              <div className="space-y-1">
                                <p className="text-sm font-medium text-foreground">
                                  {task.custom_task_name ?? task.task_type}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Assigned to {getUserName(task.assigned_to_user_id)}
                                  {Number.isFinite(assignedAt.getTime()) && ` • ${formatDistanceToNow(assignedAt)}`}
                                </p>
                              </div>
                              <Badge className={`${statusClass} text-[10px] uppercase tracking-wide text-white`}>
                                {task.status.replace(/_/g, " ")}
                              </Badge>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setActiveStatKey(null)}>
                  Close
                </Button>
                <Button
                  onClick={() => {
                    if (activeStat) {
                      router.push(activeStat.href)
                    }
                    setActiveStatKey(null)
                  }}
                >
                  More details
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

        <ManagerTaskLibraryDialog
          open={isTaskLibraryOpen}
          onOpenChange={setIsTaskLibraryOpen}
          currentUser={user}
        />
    </div>
  )
}

export default function ManagerPage() {
  return (
    <ProtectedRoute allowedRoles={["manager", "admin"]}>
      <ManagerDashboard />
    </ProtectedRoute>
  )
}
