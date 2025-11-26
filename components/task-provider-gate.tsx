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
  const { isAuthenticated, loading } = useAuth()

  // While loading, show a loading state to prevent components from rendering
  // before we know the authentication status
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500"></div>
      </div>
    )
  }

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
