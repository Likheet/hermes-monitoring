"use client"

import { Home, Users, BarChart3, ClipboardList } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

export function SupervisorBottomNav() {
  const pathname = usePathname()

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
                "flex flex-col items-center justify-center gap-1 text-xs transition-colors hover:bg-muted/50",
                item.active ? "text-primary font-medium bg-muted/30" : "text-muted-foreground",
              )}
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
