"use client"

import { Home, ListTodo, FileText, User, Calendar } from "lucide-react"
import { cn } from "@/lib/utils"
import { triggerHaptic } from "@/lib/haptics"
import { useAuth } from "@/lib/auth-context"

interface BottomNavProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  const { user } = useAuth()

  const isMaintenance = user?.department === "maintenance"

  const navItems = isMaintenance
    ? [
        { id: "home", icon: Home, label: "Home" },
        { id: "scheduled", icon: Calendar, label: "Scheduled" },
        { id: "notes", icon: FileText, label: "Notes" },
        { id: "profile", icon: User, label: "Profile" },
      ]
    : [
        { id: "home", icon: Home, label: "Home" },
        { id: "tasks", icon: ListTodo, label: "Tasks" },
        { id: "notes", icon: FileText, label: "Notes" },
        { id: "profile", icon: User, label: "Profile" },
      ]

  const handleTabClick = (tabId: string) => {
    triggerHaptic("light")
    onTabChange(tabId)
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background pb-safe">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive = activeTab === item.id
          const Icon = item.icon

          return (
            <button
              key={item.id}
              onClick={() => handleTabClick(item.id)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 flex-1 h-full min-w-[48px]",
                "active:bg-muted transition-colors",
                isActive ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
