"use client"

import { useEffect } from "react"

const shouldSuppressLogs = () => {
  if (typeof process === "undefined") {
    return false
  }

  const env = process.env.NEXT_PUBLIC_ENABLE_DEBUG_LOGS

  // Suppress logs unless explicitly opted in with NEXT_PUBLIC_ENABLE_DEBUG_LOGS="true"
  return env !== "true"
}

export function LogSuppressor() {
  useEffect(() => {
    if (!shouldSuppressLogs()) {
      return
    }

    const originalLog = console.log
    const originalDebug = console.debug

    console.log = () => {}
    console.debug = () => {}

    return () => {
      console.log = originalLog
      console.debug = originalDebug
    }
  }, [])

  return null
}
