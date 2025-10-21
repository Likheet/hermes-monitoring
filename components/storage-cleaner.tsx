"use client"

import { useEffect } from "react"

/**
 * Component that clears all localStorage data on app initialization
 * This ensures the app starts fresh on every page reload
 */
const shouldClearOnLoad = () => {
  if (typeof process === "undefined") {
    return false
  }

  return process.env.NEXT_PUBLIC_CLEAR_STORAGE_ON_LOAD === "true"
}

export function StorageCleaner() {
  useEffect(() => {
    if (typeof window !== "undefined" && shouldClearOnLoad()) {
      localStorage.clear()
    }
  }, [])

  return null
}
