"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ProtectedRoute } from "@/components/protected-route"
import { ManagerBottomNav } from "@/components/manager/manager-bottom-nav"
import { useAuth } from "@/lib/auth-context"
import { useTasks } from "@/lib/task-context"
import { loadTaskHistoryChunk } from "@/lib/supabase-task-operations"
import { useRealtimeTasks } from "@/lib/use-realtime-tasks"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { MapPin, Clock, User as UserIcon, Filter, PlusCircle, ArrowLeft } from "lucide-react"
import type { Task, User, UserRole } from "@/lib/types"
import { formatDistanceToNow } from "@/lib/date-utils"
import Link from "next/link"

const ROLE_LABELS: Record<UserRole, string> = {
  worker: "Worker",
  supervisor: "Supervisor",
  front_office: "Front Office",
  manager: "Manager",
  admin: "Admin",
}

const STATUS_OPTIONS: Array<{ label: string; value: Task["status"] | "ALL" }> = [
  { label: "All Statuses", value: "ALL" },
  { label: "Pending", value: "PENDING" },
  { label: "In Progress", value: "IN_PROGRESS" },
  { label: "Paused", value: "PAUSED" },
  { label: "Pending Verification", value: "COMPLETED" },
  { label: "Verified", value: "VERIFIED" },
  { label: "Rejected", value: "REJECTED" },
]

type StatusFilter = (typeof STATUS_OPTIONS)[number]["value"]

const ASSIGNER_OPTIONS = [
  { label: "All Assigners", value: "ALL" },
  { label: "Assigned by Me", value: "ME" },
] as const

type AssignerFilter = (typeof ASSIGNER_OPTIONS)[number]["value"]

const STATUS_COLORS: Record<Task["status"], string> = {
  PENDING: "bg-yellow-500 text-yellow-50",
  IN_PROGRESS: "bg-blue-500 text-blue-50",
  PAUSED: "bg-orange-500 text-orange-50",
  COMPLETED: "bg-green-500 text-emerald-50",
  VERIFIED: "bg-emerald-600 text-emerald-50",
  REJECTED: "bg-red-500 text-red-50",
}

const HISTORY_STATUS_KEYS = ["COMPLETED", "VERIFIED"] as const
type HistoricalStatus = (typeof HISTORY_STATUS_KEYS)[number]

const HISTORY_CHUNK_SIZE = 120

const isHistoricalStatus = (status: StatusFilter): status is HistoricalStatus =>
  status === "COMPLETED" || status === "VERIFIED"

interface HistoryEntry {
  tasks: Task[]
  cursor: string | null
  hasMore: boolean
  loading: boolean
  error: string | null
}

function ManagerTasksView() {
  const { user } = useAuth()
  const { tasks, users } = useTasks()
  const searchParams = useSearchParams()
  const router = useRouter()
  const lastAppliedParams = useRef<string | null>(null)
  const tasksRef = useRef(tasks)
  const [selectedWorker, setSelectedWorker] = useState<string>("ALL")
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>("ALL")
  const [selectedAssigner, setSelectedAssigner] = useState<AssignerFilter>("ALL")
  const [historyState, setHistoryState] = useState<Record<HistoricalStatus, HistoryEntry>>({
    COMPLETED: { tasks: [], cursor: null, hasMore: true, loading: false, error: null },
    VERIFIED: { tasks: [], cursor: null, hasMore: true, loading: false, error: null },
  })
  const historyStateRef = useRef(historyState)

  useRealtimeTasks({ enabled: true, filter: { role: "manager" } })

  useEffect(() => {
    historyStateRef.current = historyState
  }, [historyState])

  useEffect(() => {
    tasksRef.current = tasks
  }, [tasks])

  useEffect(() => {
    const paramsString = searchParams.toString()
    if (paramsString === lastAppliedParams.current) {
      return
    }

    const statusParam = searchParams.get("status")?.toUpperCase()
    if (statusParam && STATUS_OPTIONS.some((option) => option.value === statusParam)) {
      setSelectedStatus(statusParam as StatusFilter)
    } else {
      setSelectedStatus("ALL")
    }

    const workerParam = searchParams.get("worker")
    setSelectedWorker(workerParam ?? "ALL")

    const assignerParam = searchParams.get("assignedBy")
    setSelectedAssigner(assignerParam === "me" ? "ME" : "ALL")

    lastAppliedParams.current = paramsString
  }, [searchParams])

  const sortedUsers = useMemo(
    () =>
      [...users]
        .filter((member) => member.role !== "admin")
        .sort((a, b) => a.name.localeCompare(b.name)),
    [users],
  )

  const combinedTasks = useMemo(() => {
    const historicalTasks = HISTORY_STATUS_KEYS.flatMap((status) => historyState[status].tasks)

    if (historicalTasks.length === 0) {
      return tasks
    }

    const deduped = new Map<string, Task>()

    for (const task of historicalTasks) {
      deduped.set(task.id, task)
    }

    for (const task of tasks) {
      deduped.set(task.id, task)
    }

    return Array.from(deduped.values())
  }, [historyState, tasks])

  const filteredTasks = useMemo(() => {
    return combinedTasks
      .filter((task) => {
        const matchesWorker = selectedWorker === "ALL" || task.assigned_to_user_id === selectedWorker
        const matchesStatus =
          selectedStatus === "ALL" ||
          (selectedStatus === "COMPLETED"
            ? task.status === "COMPLETED" && (!task.supervisor_remark || !task.supervisor_remark.trim())
            : task.status === selectedStatus)
        const matchesAssigner =
          selectedAssigner === "ALL" || (selectedAssigner === "ME" && task.assigned_by_user_id === user?.id)
        return matchesWorker && matchesStatus && matchesAssigner
      })
      .sort((a, b) => {
        const aDate = getTaskAssignmentDate(a)
        const bDate = getTaskAssignmentDate(b)

        if (aDate && bDate) {
          return bDate.getTime() - aDate.getTime()
        }

        if (aDate) return -1
        if (bDate) return 1
        return 0
      })
  }, [combinedTasks, selectedWorker, selectedStatus, selectedAssigner, user?.id])

  const myAssignmentCount = useMemo(
    () => tasks.filter((task) => task.assigned_by_user_id === user?.id).length,
    [tasks, user?.id],
  )

  const selectedUser: User | undefined = selectedWorker === "ALL" ? undefined : users.find((member) => member.id === selectedWorker)

  const toggleStatusQuickFilter = useCallback((status: Task["status"]) => {
    setSelectedStatus((prev) => (prev === status ? "ALL" : status))
  }, [])

  const toggleAssignerQuickFilter = useCallback(() => {
    setSelectedAssigner((prev) => (prev === "ME" ? "ALL" : "ME"))
  }, [])

  const resetQuickFilters = useCallback(() => {
    setSelectedStatus("ALL")
    setSelectedAssigner("ALL")
  }, [])

  const handleStatusChange = (value: string) => {
    setSelectedStatus(value as StatusFilter)
  }

  const handleAssignerChange = (value: string) => {
    setSelectedAssigner(value as AssignerFilter)
  }

  const resetFilters = () => {
    setSelectedWorker("ALL")
    setSelectedStatus("ALL")
    setSelectedAssigner("ALL")
    lastAppliedParams.current = ""
    router.replace("/manager/tasks", { scroll: false })
  }

  const computeOldestServerUpdatedAt = useCallback(
    (status: HistoricalStatus) => {
      const historical = historyStateRef.current[status].tasks
      const activeMatches = tasksRef.current.filter((task) => {
        if (status === "COMPLETED") {
          return task.status === "COMPLETED" && (!task.supervisor_remark || !task.supervisor_remark.trim())
        }
        return task.status === "VERIFIED"
      })

      const timestamps = [...historical, ...activeMatches]
        .map((task) => task.server_updated_at)
        .filter((value): value is string => Boolean(value))

      if (timestamps.length === 0) {
        return null
      }

      return timestamps.reduce((oldest, current) => (current < oldest ? current : oldest))
    },
    [],
  )

  // Fetch older tasks in batches only when managers request historical data.
  const loadMoreHistoricalTasks = useCallback(
    async (status: HistoricalStatus) => {
      const snapshot = historyStateRef.current[status]
      if (snapshot.loading || !snapshot.hasMore) {
        return
      }

      const beforeCursor = snapshot.cursor ?? computeOldestServerUpdatedAt(status)

      setHistoryState((prev) => ({
        ...prev,
        [status]: { ...prev[status], loading: true, error: null },
      }))

      try {
        const results = await loadTaskHistoryChunk({
          status,
          limit: HISTORY_CHUNK_SIZE,
          before: beforeCursor,
          pendingVerificationOnly: status === "COMPLETED",
          forceRefresh: true,
        })

        setHistoryState((prev) => {
          const previousEntry = prev[status]
          const knownIds = new Set<string>([
            ...tasksRef.current.map((task) => task.id),
            ...previousEntry.tasks.map((task) => task.id),
          ])
          const freshTasks = results.filter((task) => !knownIds.has(task.id))
          const nextTasks = freshTasks.length > 0 ? [...previousEntry.tasks, ...freshTasks] : previousEntry.tasks
          const cursorSource =
            results.length > 0 ? results[results.length - 1].server_updated_at ?? null : beforeCursor
          const nextCursor = cursorSource ?? previousEntry.cursor ?? beforeCursor ?? null
          const hasMore = results.length === HISTORY_CHUNK_SIZE && Boolean(nextCursor)

          return {
            ...prev,
            [status]: {
              tasks: nextTasks,
              cursor: nextCursor,
              hasMore,
              loading: false,
              error: null,
            },
          }
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load additional tasks"
        setHistoryState((prev) => ({
          ...prev,
          [status]: { ...prev[status], loading: false, error: message },
        }))
      }
    },
    [computeOldestServerUpdatedAt],
  )

  const handleLoadMoreHistory = useCallback(() => {
    if (isHistoricalStatus(selectedStatus)) {
      void loadMoreHistoricalTasks(selectedStatus)
    }
  }, [loadMoreHistoricalTasks, selectedStatus])

  const historyEntry = isHistoricalStatus(selectedStatus) ? historyState[selectedStatus] : null
  const historyStatusLabel = isHistoricalStatus(selectedStatus)
    ? selectedStatus === "COMPLETED"
      ? "pending verification"
      : "verified"
    : null

  return (
    <div className="min-h-screen bg-muted/30 pb-24 md:pb-12">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex flex-col gap-4 px-4 py-6 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-3">
            <Link
              href="/manager"
              className="inline-flex h-11 w-11 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:h-4 [&_svg:not([class*='size-'])]:w-4 [&_svg]:shrink-0 focus-visible:outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px] active:scale-[0.98] hover:bg-accent hover:text-accent-foreground active:bg-accent/80 min-h-[44px]"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="sr-only">Back</span>
            </Link>
            <h1 className="text-2xl font-bold">Task Overview</h1>
            <p className="text-sm text-muted-foreground">
              Monitor assignments across every team member from a single place.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild variant="outline" className="min-h-[44px]">
              <Link href="/manager/create-task">
                <PlusCircle className="mr-2 h-4 w-4" />
                Create Task
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto space-y-6 px-4 py-6">
        <section>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Filter className="h-4 w-4 text-muted-foreground" /> Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase text-muted-foreground">Worker</p>
                <Select value={selectedWorker} onValueChange={setSelectedWorker}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select staff">
                      {selectedUser ? `${selectedUser.name} • ${ROLE_LABELS[selectedUser.role]}` : `All Staff (${sortedUsers.length})`}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value="ALL">All Staff ({sortedUsers.length})</SelectItem>
                    {sortedUsers.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        <div className="flex w-full flex-col text-left">
                          <span className="font-medium text-sm">{member.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {ROLE_LABELS[member.role]} • {formatLabel(member.department.replace(/-/g, " "))}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium uppercase text-muted-foreground">Status</p>
                <Select value={selectedStatus} onValueChange={handleStatusChange}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium uppercase text-muted-foreground">Assigner</p>
                <Select value={selectedAssigner} onValueChange={handleAssignerChange}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select assigner" />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSIGNER_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </section>

        <section>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <button
              type="button"
              onClick={resetQuickFilters}
              className="group w-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              aria-pressed={selectedStatus === "ALL" && selectedAssigner === "ALL"}
            >
              <Card
                className={cn(
                  "transition group-hover:border-primary group-hover:shadow-md",
                  selectedStatus === "ALL" && selectedAssigner === "ALL" && "border-primary shadow-sm",
                )}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Visible Tasks
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-semibold text-foreground">{filteredTasks.length}</p>
                </CardContent>
              </Card>
            </button>

            <button
              type="button"
              onClick={() => toggleStatusQuickFilter("PENDING")}
              className="group w-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              aria-pressed={selectedStatus === "PENDING"}
            >
              <Card
                className={cn(
                  "transition group-hover:border-primary group-hover:shadow-md",
                  selectedStatus === "PENDING" && "border-yellow-500 shadow-sm",
                )}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Pending
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-semibold text-yellow-600">
                    {filteredTasks.filter((task) => task.status === "PENDING").length}
                  </p>
                </CardContent>
              </Card>
            </button>

            <button
              type="button"
              onClick={() => toggleStatusQuickFilter("IN_PROGRESS")}
              className="group w-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              aria-pressed={selectedStatus === "IN_PROGRESS"}
            >
              <Card
                className={cn(
                  "transition group-hover:border-primary group-hover:shadow-md",
                  selectedStatus === "IN_PROGRESS" && "border-blue-500 shadow-sm",
                )}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    In Progress
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-semibold text-blue-600">
                    {filteredTasks.filter((task) => task.status === "IN_PROGRESS").length}
                  </p>
                </CardContent>
              </Card>
            </button>

            <button
              type="button"
              onClick={toggleAssignerQuickFilter}
              className="group w-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              aria-pressed={selectedAssigner === "ME"}
            >
              <Card
                className={cn(
                  "transition group-hover:border-primary group-hover:shadow-md",
                  selectedAssigner === "ME" && "border-primary shadow-sm",
                )}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Assigned by You
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-semibold text-primary">{myAssignmentCount}</p>
                </CardContent>
              </Card>
            </button>
          </div>
        </section>

        <section>
          <Card>
            <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-lg">Task List</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {filteredTasks.length === 0
                    ? "No tasks match the current filters."
                    : `Showing ${filteredTasks.length} task${filteredTasks.length === 1 ? "" : "s"}.`}
                </p>
              </div>
              {(selectedUser || selectedAssigner === "ME") && (
                <div className="flex flex-wrap items-center gap-2">
                  {selectedUser && (
                    <Badge variant="outline" className="text-xs font-medium">
                      Viewing assignments for {selectedUser.name}
                    </Badge>
                  )}
                  {selectedAssigner === "ME" && (
                    <Badge variant="outline" className="text-xs font-medium">
                      Showing tasks you assigned
                    </Badge>
                  )}
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {filteredTasks.length === 0 ? (
                <div className="flex min-h-[180px] flex-col items-center justify-center gap-3 text-center">
                  <p className="text-sm text-muted-foreground">Try broadening your filters or pick another staff member.</p>
                  {historyEntry && historyStatusLabel && (
                    <div className="flex flex-col items-center gap-2">
                      {historyEntry.error && (
                        <p className="text-sm text-destructive">{historyEntry.error}</p>
                      )}
                      {historyEntry.hasMore ? (
                        <Button variant="outline" size="sm" onClick={handleLoadMoreHistory} disabled={historyEntry.loading}>
                          {historyEntry.loading
                            ? "Loading..."
                            : `Load older ${historyStatusLabel} tasks`}
                        </Button>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          No additional {historyStatusLabel} tasks found.
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Additional history loads on demand to limit Supabase egress.
                      </p>
                    </div>
                  )}
                  <Button variant="ghost" size="sm" onClick={resetFilters}>
                    Reset filters
                  </Button>
                </div>
              ) : (
                <>
                  {filteredTasks.map((task) => {
                    const assignmentDate = getTaskAssignmentDate(task)

                    return (
                      <article key={task.id} className="rounded-lg border border-border bg-background p-4 shadow-sm">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="text-base font-semibold text-foreground">
                                {task.custom_task_name ?? task.task_type}
                              </h2>
                              <Badge className="bg-secondary text-secondary-foreground">
                                {formatLabel(task.priority_level)}
                              </Badge>
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1">
                                <UserIcon className="h-4 w-4" />
                                {task.assigned_to_user_id ? getUserName(users, task.assigned_to_user_id) : "Unassigned"}
                              </span>
                              {task.room_number && (
                                <span className="inline-flex items-center gap-1">
                                  <MapPin className="h-4 w-4" />
                                  Room {task.room_number}
                                </span>
                              )}
                              <span className="inline-flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                {assignmentDate ? formatDistanceToNow(assignmentDate) : "Timestamp unavailable"}
                              </span>
                            </div>
                            {task.worker_remark && (
                              <p className="text-sm text-muted-foreground">
                                <span className="font-medium">Worker note:</span> {task.worker_remark}
                              </p>
                            )}
                            {task.supervisor_remark && (
                              <p className="text-sm text-muted-foreground">
                                <span className="font-medium">Supervisor note:</span> {task.supervisor_remark}
                              </p>
                            )}
                          </div>
                          <Badge
                            className={cn(
                              "self-start text-[10px] font-semibold uppercase tracking-wide",
                              STATUS_COLORS[task.status],
                            )}
                          >
                            {formatLabel(task.status)}
                          </Badge>
                        </div>
                      </article>
                    )
                  })}
                  {historyEntry && historyStatusLabel && (
                    <div className="flex flex-col items-center gap-2 pt-2 text-center">
                      {historyEntry.error && (
                        <p className="text-sm text-destructive">{historyEntry.error}</p>
                      )}
                      {historyEntry.hasMore ? (
                        <Button variant="outline" size="sm" onClick={handleLoadMoreHistory} disabled={historyEntry.loading}>
                          {historyEntry.loading
                            ? "Loading..."
                            : `Load older ${historyStatusLabel} tasks`}
                        </Button>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          {historyEntry.tasks.length > 0
                            ? `You have reached the end of available ${historyStatusLabel} history.`
                            : `No additional ${historyStatusLabel} tasks found.`}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Additional history loads on demand to limit Supabase egress.
                      </p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </section>
      </main>

      <ManagerBottomNav />
    </div>
  )
}

function getUserName(users: User[], userId: string) {
  return users.find((member) => member.id === userId)?.name ?? "Unknown"
}

function getTaskAssignmentDate(task: Task) {
  const candidates: Array<string | null | undefined> = [
    task.assigned_at?.client,
    task.assigned_at?.server,
    task.server_updated_at,
  ]

  for (const value of candidates) {
    if (!value) continue
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) {
      return date
    }
  }

  return undefined
}

function formatLabel(value: string): string {
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

export default function ManagerTasksPage() {
  return (
    <ProtectedRoute allowedRoles={["manager", "admin"]}>
      <ManagerTasksView />
    </ProtectedRoute>
  )
}
