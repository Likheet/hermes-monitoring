"use client"

import { useEffect, useState } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { playNotificationSound } from "@/lib/notification-utils"
import { triggerHaptic } from "@/lib/haptics"
import Link from "next/link"

interface NotificationToastProps {
  title: string
  message: string
  taskId?: string
  onDismiss: () => void
}

export function NotificationToast({ title, message, taskId, onDismiss }: NotificationToastProps) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    // Play sound and haptic feedback
    playNotificationSound()
    triggerHaptic("medium")

    // Auto-dismiss after 5 seconds
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(onDismiss, 300) // Wait for animation
    }, 5000)

    return () => clearTimeout(timer)
  }, [onDismiss])

  if (!visible) return null

  return (
    <Card className="fixed top-4 right-4 z-50 w-80 p-4 shadow-lg animate-in slide-in-from-top-5" role="alert">
      <div className="flex items-start gap-3">
        <div className="flex-1 space-y-1">
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-sm text-muted-foreground">{message}</p>
          {taskId && (
            <Link
              href={`/worker/${taskId}`}
              className="text-xs text-primary hover:underline inline-block mt-2"
              onClick={onDismiss}
            >
              View task →
            </Link>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => {
            setVisible(false)
            setTimeout(onDismiss, 300)
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  )
}
