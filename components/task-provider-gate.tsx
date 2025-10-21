"use client"

import type { ReactNode } from "react"
import { useAuth } from "@/lib/auth-context"
import { TaskProvider } from "@/lib/task-context"
import { FullScreenNotificationOverlay } from "@/components/notifications/full-screen-notification"
import { GlobalLoadingOverlay } from "@/components/global-loading-overlay"

interface TaskProviderGateProps {
  children: ReactNode
}

export function TaskProviderGate({ children }: TaskProviderGateProps) {
  const { isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return <>{children}</>
  }

  return (
    <TaskProvider>
      {children}
      <FullScreenNotificationOverlay />
      <GlobalLoadingOverlay />
    </TaskProvider>
  )
}
