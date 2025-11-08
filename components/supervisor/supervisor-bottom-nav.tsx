"use client"

import { useMemo } from "react"
import { Home, Users, BarChart3, ClipboardList } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import { useTasks } from "@/lib/task-context"
import type { Task } from "@/lib/types"

const ACTIVE_TASK_STATUSES = new Set<Task["status"]>(["PENDING", "IN_PROGRESS", "PAUSED"])

const isRecurringTask = (task: Task) =>
  Boolean(
    task.is_recurring || task.recurring_frequency || task.custom_task_is_recurring || task.custom_task_recurring_frequency,
  )

export function SupervisorBottomNav() {
  const pathname = usePathname()
  const { user } = useAuth()
  const { tasks } = useTasks()

  const normalizedDepartment = user?.department ? user.department.toLowerCase() : null

  const hasRecurringAssignments = useMemo(() => {
    return tasks.some((task) => {
      if (!isRecurringTask(task) || !ACTIVE_TASK_STATUSES.has(task.status)) {
        return false
      }
      if (!normalizedDepartment) {
        return true
      }
      return task.department?.toLowerCase() === normalizedDepartment
    })
  }, [tasks, normalizedDepartment])

  const navItems = [
    {
      label: "Dashboard",
      href: "/supervisor",
      icon: Home,
      active: pathname === "/supervisor",
    },
    {
      label: "Assignments",
      href: "/supervisor/assignments",
      icon: ClipboardList,
      active: pathname === "/supervisor/assignments",
      showDot: hasRecurringAssignments,
    },
    {
      label: "Workers",
      href: "/supervisor/workers",
      icon: Users,
      active: pathname === "/supervisor/workers",
    },
    {
      label: "Analytics",
      href: "/supervisor/analytics",
      icon: BarChart3,
      active: pathname === "/supervisor/analytics",
    },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t shadow-lg">
      <div className="grid grid-cols-4 h-16">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 text-xs transition-colors hover:bg-muted/50",
                item.active ? "text-primary font-medium bg-muted/30" : "text-muted-foreground",
              )}
            >
              {item.showDot && (
                <>
                  <span className="absolute top-2 right-6 h-2 w-2 rounded-full bg-red-500" aria-hidden="true" />
                  <span className="sr-only">Recurring assignments pending</span>
                </>
              )}
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
