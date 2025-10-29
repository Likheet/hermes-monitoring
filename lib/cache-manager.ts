"use client"

/**
 * Cache Manager - Handles cleanup and invalidation of stale caches
 */

const CACHE_VERSION_KEY = "hermes-cache-version"
const CURRENT_CACHE_VERSION = "v3" // Increment this to invalidate all caches
const CACHE_TIMESTAMP_KEY = "hermes-cache-timestamp"
const MAX_CACHE_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

/**
 * Clears all photo caches if cache version has changed OR caches are too old
 */
export function clearStalePhotoCaches() {
  if (typeof window === "undefined") return

  try {
    const storedVersion = window.localStorage.getItem(CACHE_VERSION_KEY)
    const storedTimestamp = window.localStorage.getItem(CACHE_TIMESTAMP_KEY)
    const now = Date.now()
    
    // Check if caches are too old
    const cacheAge = storedTimestamp ? now - parseInt(storedTimestamp, 10) : Infinity
    const cacheTooOld = cacheAge > MAX_CACHE_AGE_MS
    
    // Only clear if version changed OR cache is too old
    if (storedVersion !== CURRENT_CACHE_VERSION || cacheTooOld) {
      console.log("[cache] Clearing stale caches", { 
        reason: storedVersion !== CURRENT_CACHE_VERSION ? "version change" : "age",
        storedVersion, 
        currentVersion: CURRENT_CACHE_VERSION,
        cacheAgeDays: Math.floor(cacheAge / (24 * 60 * 60 * 1000))
      })
      
      // Clear all task photo caches
      const keys = Object.keys(window.localStorage)
      keys.forEach(key => {
        if (key.startsWith("hermes-task-photos-")) {
          window.localStorage.removeItem(key)
        }
      })
      
      // Update cache version and timestamp
      window.localStorage.setItem(CACHE_VERSION_KEY, CURRENT_CACHE_VERSION)
      window.localStorage.setItem(CACHE_TIMESTAMP_KEY, now.toString())
      
      console.log("[cache] Stale caches cleared successfully")
    } else {
      // Update timestamp to keep cache fresh
      window.localStorage.setItem(CACHE_TIMESTAMP_KEY, now.toString())
    }
  } catch (error) {
    console.error("[cache] Failed to clear stale caches:", error)
  }
}

/**
 * Clears photo cache for a specific task
 */
export function clearTaskPhotoCache(taskId: string) {
  if (typeof window === "undefined") return
  
  try {
    window.localStorage.removeItem(`hermes-task-photos-${taskId}`)
  } catch (error) {
    console.error("[cache] Failed to clear task photo cache:", error)
  }
}

/**
 * Force clears all hermes-related caches
 */
export function clearAllHermesCache() {
  if (typeof window === "undefined") return
  
  try {
    const keys = Object.keys(window.localStorage)
    keys.forEach(key => {
      if (key.startsWith("hermes-")) {
        window.localStorage.removeItem(key)
      }
    })
    
    console.log("[cache] All Hermes caches cleared")
  } catch (error) {
    console.error("[cache] Failed to clear all caches:", error)
  }
}
