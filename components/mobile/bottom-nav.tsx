"use client"

import { Home, ListTodo, Clock, User } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { triggerHaptic } from "@/lib/haptics"

export function BottomNav() {
  const pathname = usePathname()

  const navItems = [
    { href: "/worker", icon: Home, label: "Home" },
    { href: "/worker/tasks", icon: ListTodo, label: "Tasks" },
    { href: "/worker/handover", icon: Clock, label: "Handover" },
    { href: "/worker/profile", icon: User, label: "Profile" },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background pb-safe">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => triggerHaptic("light")}
              className={cn(
                "flex flex-col items-center justify-center gap-1 flex-1 h-full min-w-[48px]",
                "active:bg-muted transition-colors",
                isActive ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
