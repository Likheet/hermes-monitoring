"use client"

import { useEffect } from "react"
import { clearStalePhotoCaches } from "@/lib/cache-manager"

/**
 * Component that clears stale caches and manages storage
 * This ensures the app stays synchronized with server data
 */
const shouldClearOnLoad = () => {
  if (typeof process === "undefined") {
    return false
  }

  return process.env.NEXT_PUBLIC_CLEAR_STORAGE_ON_LOAD === "true"
}

export function StorageCleaner() {
  useEffect(() => {
    if (typeof window !== "undefined") {
      // Clear all storage if configured
      if (shouldClearOnLoad()) {
        localStorage.clear()
        console.log("[storage] Full storage cleared (NEXT_PUBLIC_CLEAR_STORAGE_ON_LOAD enabled)")
      } else {
        // Otherwise just clear stale caches
        clearStalePhotoCaches()
      }
    }
  }, [])

  return null
}
