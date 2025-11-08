"use client"

import { Home, ClipboardList } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  {
    label: "Home",
    href: "/manager",
    icon: Home,
  },
  {
    label: "Tasks",
    href: "/manager/tasks",
    icon: ClipboardList,
  },
] as const

export function ManagerBottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background shadow-lg md:hidden">
      <div className="grid h-16 grid-cols-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 text-xs transition-colors",
                "hover:bg-muted/50",
                isActive ? "text-primary font-medium bg-muted/30" : "text-muted-foreground",
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
