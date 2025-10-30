"use client"

import { Home, ListTodo, User, Calendar } from "lucide-react"
import { cn } from "@/lib/utils"
import { triggerHaptic } from "@/lib/haptics"
import { useAuth } from "@/lib/auth-context"
import { useTasks } from "@/lib/task-context"

interface BottomNavProps {
  activeTab?: string
  onTabChange?: (tab: string) => void
}

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  const { user } = useAuth()
  const { maintenanceTasks } = useTasks()

  const isMaintenance = user?.department === "maintenance"
  const hasAssignedMaintenanceTasks = maintenanceTasks.some((task) => task.assigned_to === user?.id)
  const canAccessScheduled = isMaintenance || hasAssignedMaintenanceTasks

  const navItems = canAccessScheduled
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

  const handleTabClick = (tabId: string) => {
    triggerHaptic("light")
    onTabChange?.(tabId)
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 pb-safe">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = activeTab === item.id
          const Icon = item.icon

          return (
            <button
              key={item.id}
              onClick={() => handleTabClick(item.id)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 flex-1 h-full min-w-[64px] rounded-lg",
                "active:scale-95 transition-all duration-150",
                isActive
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
              )}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className={cn("h-6 w-6 transition-transform", isActive && "scale-110")} />
              <span className={cn("text-xs font-medium", isActive && "font-semibold")}>{item.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
