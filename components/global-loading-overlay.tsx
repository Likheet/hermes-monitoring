"use client"

import { OrbitalLoader } from "@/components/ui/orbital-loader"
import { useTasks } from "@/lib/task-context"

export function GlobalLoadingOverlay() {
  const { isBusy } = useTasks()

  if (!isBusy) {
    return null
  }

  return (
    <div className="pointer-events-auto fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
      <div role="status" aria-live="assertive" className="rounded-lg bg-white px-6 py-4 shadow-xl">
        <OrbitalLoader message="Loading..." messagePlacement="bottom" />
      </div>
    </div>
  )
}
