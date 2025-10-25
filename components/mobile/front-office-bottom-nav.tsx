"use client"

import type { ComponentType } from "react"
import { Home, Clock, ClipboardList, ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import { triggerHaptic } from "@/lib/haptics"
import type { FrontOfficeTab } from "@/lib/front-office-tabs"

interface FrontOfficeBottomNavProps {
  activeTab: FrontOfficeTab
  onTabChange: (tab: FrontOfficeTab) => void
}

export function FrontOfficeBottomNav({ activeTab, onTabChange }: FrontOfficeBottomNavProps) {
  const navItems: Array<{ id: FrontOfficeTab; icon: ComponentType<{ className?: string }>; label: string }> = [
    { id: "home", icon: Home, label: "Home" },
    { id: "shifts", icon: Clock, label: "Shifts" },
    { id: "assignments", icon: ClipboardList, label: "Assignments" },
    { id: "supervisor", icon: ShieldCheck, label: "Supervisor" },
  ]

  const handleTabClick = (tabId: FrontOfficeTab) => {
    triggerHaptic("light")
    onTabChange(tabId)
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
