"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { WifiOff } from "lucide-react"
import { isOnline, setupOnlineListener } from "@/lib/timer-utils"

export function OfflineIndicator() {
  const [online, setOnline] = useState(true)

  useEffect(() => {
    setOnline(isOnline())
    const cleanup = setupOnlineListener(setOnline)
    return cleanup
  }, [])

  if (online) return null

  return (
    <Badge variant="destructive" className="fixed top-4 right-4 z-50 flex items-center gap-2">
      <WifiOff className="h-4 w-4" />
      Offline Mode
    </Badge>
  )
}
