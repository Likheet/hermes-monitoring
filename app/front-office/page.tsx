"use client"

import { ProtectedRoute } from "@/components/protected-route"
import { useAuth } from "@/lib/auth-context"
import { useTasks } from "@/lib/task-context"
import { WorkerStatusCard } from "@/components/worker-status-card"
import { Button } from "@/components/ui/button"
import { LogOut, Plus, ClipboardList, Clock, AlertTriangle } from "lucide-react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useRealtimeTasks } from "@/lib/use-realtime-tasks"
import { ConnectionStatus } from "@/components/connection-status"
import { RejectedTaskCard } from "@/components/rejected-task-card"
import { IssueCard } from "@/components/issue-card"

function FrontOfficeDashboard() {
  const { user, logout } = useAuth()
  const { tasks, issues, users, maintenanceTasks } = useTasks()
  const router = useRouter()
  const { isConnected } = useRealtimeTasks({ enabled: true })

  const workers = users.filter((u) => u.role === "worker")

  console.log(
    "[v0] Front office - workers:",
    workers.map((w) => ({
      name: w.name,
      shift_start: w.shift_start,
      shift_end: w.shift_end,
    })),
  )

  const getWorkerCurrentTask = (workerId: string) => {
    const regularTask = tasks.find(
      (t) => t.assigned_to_user_id === workerId && (t.status === "IN_PROGRESS" || t.status === "PAUSED"),
    )
    if (regularTask) return regularTask

    const maintenanceTask = (maintenanceTasks || []).find(
      (t) => t.assigned_to === workerId && (t.status === "in_progress" || t.status === "paused"),
    )
    return maintenanceTask
  }

  const availableWorkers = workers.filter((w) => !getWorkerCurrentTask(w.id))
  const busyWorkers = workers.filter((w) => getWorkerCurrentTask(w.id))
  const rejectedTasks = tasks.filter((t) => t.status === "REJECTED")

  const openIssues = issues.filter((issue) => issue.status === "OPEN")

  const handleLogout = () => {
    logout()
    router.push("/login")
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-2xl font-bold">Front Office</h1>
            <p className="text-sm text-muted-foreground">{user?.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <ConnectionStatus isConnected={isConnected} />
            <Link href="/front-office/shifts">
              <Button variant="outline">
                <Clock className="mr-2 h-4 w-4" />
                Shifts
              </Button>
            </Link>
            <Link href="/front-office/assignments">
              <Button variant="outline">
                <ClipboardList className="mr-2 h-4 w-4" />
                My Assignments
              </Button>
            </Link>
            <Link href="/front-office/create-task">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Task
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Available Workers</h2>
            <span className="text-sm text-muted-foreground">{availableWorkers.length} available</span>
          </div>
          {availableWorkers.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {availableWorkers.map((worker) => (
                <WorkerStatusCard key={worker.id} worker={worker} />
              ))}
            </div>
          ) : (
            <div className="flex min-h-[200px] items-center justify-center border-2 border-dashed rounded-lg">
              <p className="text-muted-foreground">No workers available</p>
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Busy Workers</h2>
            <span className="text-sm text-muted-foreground">{busyWorkers.length} working</span>
          </div>
          {busyWorkers.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {busyWorkers.map((worker) => (
                <WorkerStatusCard key={worker.id} worker={worker} currentTask={getWorkerCurrentTask(worker.id)} />
              ))}
            </div>
          ) : (
            <div className="flex min-h-[200px] items-center justify-center border-2 border-dashed rounded-lg">
              <p className="text-muted-foreground">No workers currently busy</p>
            </div>
          )}
        </section>

        {openIssues.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Reported Issues
              </h2>
              <span className="text-sm text-muted-foreground">{openIssues.length} open</span>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {openIssues.map((issue) => {
                const task = tasks.find((t) => t.id === issue.task_id)
                if (!task) return null
                return (
                  <IssueCard
                    key={issue.id}
                    issue={issue}
                    task={task}
                    onResolve={(issueId) => {
                      console.log("[v0] Resolving issue:", issueId)
                    }}
                  />
                )
              })}
            </div>
          </section>
        )}

        {rejectedTasks.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Rejected Tasks</h2>
              <span className="text-sm text-muted-foreground">{rejectedTasks.length} rejected</span>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {rejectedTasks.map((task) => (
                <RejectedTaskCard key={task.id} task={task} />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

export default function FrontOfficePage() {
  return (
    <ProtectedRoute allowedRoles={["front_office"]}>
      <FrontOfficeDashboard />
    </ProtectedRoute>
  )
}
