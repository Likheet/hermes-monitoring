"use client"

import { Wifi, WifiOff } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface ConnectionStatusProps {
  isConnected: boolean
}

export function ConnectionStatus({ isConnected }: ConnectionStatusProps) {
  if (isConnected) {
    return (
      <Badge variant="outline" className="gap-1">
        <Wifi className="h-3 w-3 text-green-500" />
        <span className="text-xs">Live</span>
      </Badge>
    )
  }

  return (
    <Badge variant="outline" className="gap-1">
      <WifiOff className="h-3 w-3 text-orange-500" />
      <span className="text-xs">Offline</span>
    </Badge>
  )
}
