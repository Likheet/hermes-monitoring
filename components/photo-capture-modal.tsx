"use client"

import type React from "react"
import { useState, useRef } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Camera, Loader2, AlertCircle } from "lucide-react"
import { compressImage, blobToDataURL } from "@/lib/image-utils"
import { uploadTaskPhoto } from "@/lib/storage-utils"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { triggerHaptic, triggerSuccessHaptic, triggerErrorHaptic } from "@/lib/haptics"

interface PhotoCaptureModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPhotoCapture: (photoUrl: string) => void
  taskId: string
}

export function PhotoCaptureModal({ open, onOpenChange, onPhotoCapture, taskId }: PhotoCaptureModalProps) {
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null)
  const [compressedBlob, setCompressedBlob] = useState<Blob | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setError(null)
      const compressed = await compressImage(file, 300)
      setCompressedBlob(compressed)

      const dataUrl = await blobToDataURL(compressed)
      setCapturedPhoto(dataUrl)
      triggerHaptic("light")
    } catch (err) {
      setError("Failed to process image. Please try again.")
      triggerErrorHaptic()
      console.error("[v0] Image compression error:", err)
    }
  }

  const handleConfirm = async () => {
    if (!capturedPhoto || !compressedBlob) return

    setUploading(true)
    setError(null)
    setUploadProgress(0)

    try {
      if (!navigator.onLine) {
        throw new Error("You are offline. Please check your connection and try again.")
      }

      setUploadProgress(30)

      const photoUrl = await uploadTaskPhoto(taskId, compressedBlob)

      setUploadProgress(100)

      if (photoUrl) {
        triggerSuccessHaptic()
        onPhotoCapture(photoUrl)
        setCapturedPhoto(null)
        setCompressedBlob(null)
        setUploadProgress(0)
        onOpenChange(false)
      }
    } catch (err: any) {
      setError(err.message || "Failed to upload photo. Please try again.")
      triggerErrorHaptic()
      console.error("[v0] Photo upload error:", err)
    } finally {
      setUploading(false)
    }
  }

  const handleRetake = () => {
    setCapturedPhoto(null)
    setCompressedBlob(null)
    setError(null)
    setUploadProgress(0)
    triggerHaptic("light")
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleRetry = () => {
    setError(null)
    handleConfirm()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Capture Photo</DialogTitle>
          <DialogDescription>Take a photo to complete this task</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span className="text-sm">{error}</span>
                {capturedPhoto && (
                  <Button size="sm" variant="outline" onClick={handleRetry} disabled={uploading}>
                    Retry
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}

          {!capturedPhoto ? (
            <div className="flex flex-col items-center gap-4">
              <div className="flex h-64 w-full items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/50">
                <Camera className="h-16 w-16 text-muted-foreground" />
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
                id="photo-input"
              />
              <Button
                onClick={() => {
                  triggerHaptic("medium")
                  fileInputRef.current?.click()
                }}
                className="w-full min-h-[48px] text-base"
                disabled={uploading}
              >
                <Camera className="mr-2 h-5 w-5" />
                Take Photo
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <img src={capturedPhoto || "/placeholder.svg"} alt="Captured" className="w-full rounded-lg" />

              {uploading && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Uploading...</span>
                    <span className="font-medium">{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} />
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={handleRetake}
                  variant="outline"
                  className="flex-1 min-h-[48px] bg-transparent"
                  disabled={uploading}
                >
                  Retake
                </Button>
                <Button onClick={handleConfirm} className="flex-1 min-h-[48px]" disabled={uploading}>
                  {uploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    "Confirm"
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
