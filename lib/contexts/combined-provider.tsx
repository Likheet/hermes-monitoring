"use client"

import { type ReactNode } from "react"
import { TaskProvider } from "./tasks-context"
import { UsersProvider } from "./users-context"
import { SchedulesProvider } from "./schedules-context"

interface CombinedProviderProps {
  children: ReactNode
}

export function CombinedProvider({ children }: CombinedProviderProps) {
  return (
    <UsersProvider>
      <TaskProvider>
        <SchedulesProvider>
          {children}
        </SchedulesProvider>
      </TaskProvider>
    </UsersProvider>
  )
}