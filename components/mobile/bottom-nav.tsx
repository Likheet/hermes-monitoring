"use client"

import { useMemo } from "react"
import { Home, ListTodo, User, Calendar } from "lucide-react"
import { cn } from "@/lib/utils"
import { triggerHaptic } from "@/lib/haptics"
import { useAuth } from "@/lib/auth-context"
import { useTasks } from "@/lib/task-context"
import type { Task } from "@/lib/types"

const ACTIVE_TASK_STATUSES = new Set<Task["status"]>(["PENDING", "IN_PROGRESS", "PAUSED"])

const isRecurringTask = (task: Task) =>
  Boolean(
    task.is_recurring || task.recurring_frequency || task.custom_task_is_recurring || task.custom_task_recurring_frequency,
  )

interface BottomNavProps {
  activeTab?: string
  onTabChange?: (tab: string) => void
}

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  const { user } = useAuth()
  const { maintenanceTasks, tasks } = useTasks()

  const isMaintenance = user?.department === "maintenance"
  const hasAssignedMaintenanceTasks = maintenanceTasks.some((task) => task.assigned_to === user?.id)
  const canAccessScheduled = isMaintenance || hasAssignedMaintenanceTasks

  const hasRecurringAssignments = useMemo(() => {
    if (!user?.id) return false
    return tasks.some(
      (task) =>
        task.assigned_to_user_id === user.id && isRecurringTask(task) && ACTIVE_TASK_STATUSES.has(task.status),
    )
  }, [tasks, user?.id])

  const baseNavItems = canAccessScheduled
    ? [
        { id: "home", icon: Home, label: "Home" },
        { id: "tasks", icon: ListTodo, label: "Tasks" },
        { id: "scheduled", icon: Calendar, label: "Scheduled" },
        { id: "profile", icon: User, label: "Profile" },
      ]
    : [
        { id: "home", icon: Home, label: "Home" },
        { id: "tasks", icon: ListTodo, label: "Tasks" },
        { id: "profile", icon: User, label: "Profile" },
      ]

  const navItems = baseNavItems.map((item) => ({
    ...item,
    showDot: item.id === "tasks" && hasRecurringAssignments,
  }))

  const handleTabClick = (tabId: string) => {
    triggerHaptic("light")
    onTabChange?.(tabId)
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-100 bg-white pb-safe shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.02)]">
      <div className="flex items-center justify-around h-[72px] px-2">
        {navItems.map((item) => {
          const isActive = activeTab === item.id
          const Icon = item.icon

          return (
            <button
              key={item.id}
              onClick={() => handleTabClick(item.id)}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1.5 flex-1 h-full min-w-[64px] mx-1",
                "active:scale-95 transition-all duration-200",
                isActive
                  ? "text-black"
                  : "text-gray-400 hover:text-gray-600",
              )}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
            >
              {item.showDot && (
                <>
                  <span className="absolute top-3 right-6 h-2 w-2 rounded-full bg-black ring-2 ring-white" aria-hidden="true" />
                  <span className="sr-only">Recurring tasks pending</span>
                </>
              )}
              <Icon className={cn("h-6 w-6 transition-all duration-200", isActive && "stroke-[2.5px]")} />
              <span className={cn("text-[10px] font-medium tracking-wide uppercase transition-all", isActive && "font-bold")}>{item.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
