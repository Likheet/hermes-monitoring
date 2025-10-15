"use client"

import { useEffect } from "react"

/**
 * Component that clears all localStorage data on app initialization
 * This ensures the app starts fresh on every page reload
 */
export function StorageCleaner() {
  useEffect(() => {
    // Clear all localStorage on mount (page load/refresh)
    if (typeof window !== "undefined") {
      localStorage.clear()
      console.log("[v0] localStorage cleared on app initialization")
    }
  }, [])

  return null
}
