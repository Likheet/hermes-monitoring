"use client"

import { useState } from "react"
import { Loader2, AlertCircle } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { TaskImage } from "@/components/task-image"

interface PhotoZoomModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  photoUrl: string
  alt?: string
}

export function PhotoZoomModal({ open, onOpenChange, photoUrl, alt = "Task photo" }: PhotoZoomModalProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>{alt}</DialogTitle>
          <DialogDescription>Zoomed task documentation photo. Press Escape or use the close button to exit.</DialogDescription>
        </DialogHeader>
        <div className="relative min-h-[400px] flex items-center justify-center bg-black">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-white" />
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white">
              <AlertCircle className="h-8 w-8" />
              <p className="text-sm">Failed to load image</p>
            </div>
          )}
          {!error && (
            <TaskImage
              src={photoUrl}
              alt={alt}
              width={1280}
              height={960}
              className="max-h-[80vh] w-auto object-contain"
              onLoad={() => setLoading(false)}
              onError={() => {
                setLoading(false)
                setError(true)
              }}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
