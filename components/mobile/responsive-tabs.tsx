"use client"

import type React from "react"

import { cn } from "@/lib/utils"
import { triggerHaptic } from "@/lib/haptics"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"

interface Tab {
  id: string
  label: string
  badge?: number
  icon?: React.ComponentType<{ className?: string }>
}

interface ResponsiveTabsProps {
  tabs: Tab[]
  activeTab: string
  onTabChange: (tabId: string) => void
  className?: string
}

export function ResponsiveTabs({ tabs, activeTab, onTabChange, className }: ResponsiveTabsProps) {
  const handleTabClick = (tabId: string) => {
    triggerHaptic("light")
    onTabChange(tabId)
  }

  return (
    <div className={cn("border-b bg-background", className)}>
      <ScrollArea className="w-full">
        <div className="flex items-center gap-1 px-2 md:px-4">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id
            const Icon = tab.icon

            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className={cn(
                  "relative flex items-center gap-2 px-3 md:px-4 py-3 text-sm font-medium whitespace-nowrap",
                  "transition-colors duration-150 border-b-2 -mb-px",
                  "min-h-[48px] md:min-h-[44px]",
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted",
                )}
                aria-current={isActive ? "page" : undefined}
              >
                {Icon && <Icon className="h-4 w-4 shrink-0" />}
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span
                    className={cn(
                      "ml-1 px-1.5 py-0.5 text-xs font-semibold rounded-full min-w-[20px] text-center",
                      isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>
        <ScrollBar orientation="horizontal" className="h-2" />
      </ScrollArea>
    </div>
  )
}
