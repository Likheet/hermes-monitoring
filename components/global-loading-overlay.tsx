"use client"

import { useTasks } from "@/lib/task-context"

export function GlobalLoadingOverlay() {
  const { isBusy } = useTasks()

  if (!isBusy) {
    return null
  }

  return (
    <div className="pointer-events-auto fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
      <div
        role="status"
        aria-live="assertive"
        className="flex items-center gap-3 rounded-lg bg-white px-6 py-4 text-lg font-semibold text-slate-700 shadow-xl"
      >
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-sky-500" />
        Loading...
      </div>
    </div>
  )
}
