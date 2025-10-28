"use client"

import { useState } from "react"
import { ProtectedRoute } from "@/components/protected-route"
import { useAuth } from "@/lib/auth-context"
import { useTasks } from "@/lib/task-context"
import { MaintenanceCalendar } from "@/components/maintenance/maintenance-calendar"
import { BottomNav } from "@/components/mobile/bottom-nav"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useRealtimeTasks } from "@/lib/use-realtime-tasks"
import { LogOut } from "lucide-react"
import { useRouter } from "next/navigation"

export const dynamic = "force-dynamic"

function MaintenanceDashboard() {
  const { user, logout } = useAuth()
  const { maintenanceTasks, tasks } = useTasks()
  const router = useRouter()

  useRealtimeTasks({
    enabled: true,
    filter: { department: user?.department },
  })

  const [activeTab, setActiveTab] = useState<"calendar" | "tasks">("calendar")

  const departmentTasks = tasks.filter(
    (task) => task.department?.toLowerCase() === user?.department?.toLowerCase() || task.assigned_to_user_id === user?.id,
  )

  return (
    <div className="flex h-screen flex-col bg-muted/30">
      <header className="sticky top-0 z-40 border-b bg-background">
        <div className="container mx-auto flex items-center justify-between gap-3 px-4 py-4">
          <div>
            <h1 className="text-xl font-semibold sm:text-2xl">
              {activeTab === "calendar" ? "Maintenance Schedule" : "My Tasks"}
            </h1>
            <p className="text-sm text-muted-foreground">{user?.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="bg-transparent"
              onClick={() => {
                logout()
                router.push("/login")
              }}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-20">
        <div className="container mx-auto space-y-6 px-4 py-6">
          {activeTab === "calendar" ? (
            <MaintenanceCalendar tasks={maintenanceTasks ?? []} />
          ) : (
            <section>
              <Card>
                <CardHeader>
                  <CardTitle>Assigned Tasks</CardTitle>
                </CardHeader>
                <CardContent>
                  {departmentTasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No tasks assigned right now.</p>
                  ) : (
                    <ul className="space-y-3">
                      {departmentTasks.map((task) => (
                        <li key={task.id} className="rounded-md border bg-background px-3 py-2 text-sm">
                          <div className="font-medium">{task.task_type}</div>
                          <div className="text-xs text-muted-foreground">
                            Room {task.room_number} • Status: {task.status.replace(/_/g, " ")}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </section>
          )}
        </div>
      </main>

      <BottomNav
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as "calendar" | "tasks")}
        tabs={[
          { value: "calendar", label: "Calendar" },
          { value: "tasks", label: "Tasks" },
        ]}
      />
    </div>
  )
}

export default function MaintenancePage() {
  return (
    <ProtectedRoute allowedRoles={["maintenance"]}>
      <MaintenanceDashboard />
    </ProtectedRoute>
  )
}
