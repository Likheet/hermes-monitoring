"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Camera, Loader2, AlertCircle, X, Plus } from "lucide-react"
import { compressImage, blobToDataURL } from "@/lib/image-utils"
import { uploadTaskPhoto } from "@/lib/storage-utils"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { triggerHaptic, triggerSuccessHaptic, triggerErrorHaptic } from "@/lib/haptics"

interface PhotoCaptureModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPhotosCapture: (photoUrls: string[]) => void
  taskId: string
  existingPhotos?: string[]
}

export function PhotoCaptureModal({
  open,
  onOpenChange,
  onPhotosCapture,
  taskId,
  existingPhotos = [],
}: PhotoCaptureModalProps) {
  const [capturedPhotos, setCapturedPhotos] = useState<string[]>(existingPhotos)
  const [currentPhoto, setCurrentPhoto] = useState<string | null>(null)
  const [compressedBlob, setCompressedBlob] = useState<Blob | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setCapturedPhotos(existingPhotos)
  }, [existingPhotos])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setError(null)
      const compressed = await compressImage(file, 300)
      setCompressedBlob(compressed)

      const dataUrl = await blobToDataURL(compressed)
      setCurrentPhoto(dataUrl)
      triggerHaptic("light")
    } catch (err) {
      setError("Failed to process image. Please try again.")
      triggerErrorHaptic()
      console.error("[v0] Image compression error:", err)
    }
  }

  const handleAddPhoto = async () => {
    if (!currentPhoto || !compressedBlob) return

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
        setCapturedPhotos((prev) => [...prev, photoUrl])
        setCurrentPhoto(null)
        setCompressedBlob(null)
        setUploadProgress(0)

        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = ""
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to upload photo. Please try again.")
      triggerErrorHaptic()
      console.error("[v0] Photo upload error:", err)
    } finally {
      setUploading(false)
    }
  }

  const handleRemovePhoto = (index: number) => {
    setCapturedPhotos((prev) => prev.filter((_, i) => i !== index))
    triggerHaptic("light")
  }

  const handleRetake = () => {
    setCurrentPhoto(null)
    setCompressedBlob(null)
    setError(null)
    setUploadProgress(0)
    triggerHaptic("light")
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleConfirm = () => {
    if (capturedPhotos.length === 0) {
      setError("Please capture at least one photo")
      return
    }
    onPhotosCapture(capturedPhotos)
    setCapturedPhotos([])
    setCurrentPhoto(null)
    onOpenChange(false)
  }

  const handleCancel = () => {
    setCapturedPhotos(existingPhotos)
    setCurrentPhoto(null)
    setCompressedBlob(null)
    setError(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="space-y-2">
          <DialogTitle className="text-lg sm:text-xl">Capture Photos</DialogTitle>
          <DialogDescription className="text-sm">
            {capturedPhotos.length === 0
              ? "Take photos to complete this task"
              : `${capturedPhotos.length} photo(s) captured`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <span className="text-sm">{error}</span>
              </AlertDescription>
            </Alert>
          )}

          {capturedPhotos.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Captured Photos:</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {capturedPhotos.map((photo, index) => (
                  <div key={index} className="relative">
                    <img
                      src={photo || "/placeholder.svg"}
                      alt={`Captured ${index + 1}`}
                      className="w-full aspect-square object-cover rounded-lg border"
                    />
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute top-1 right-1 h-8 w-8 sm:h-7 sm:w-7 shadow-lg"
                      onClick={() => handleRemovePhoto(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!currentPhoto ? (
            <div className="flex flex-col items-center gap-4">
              {capturedPhotos.length === 0 && (
                <div className="flex h-40 sm:h-48 w-full items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/50">
                  <Camera className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground" />
                </div>
              )}
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
                className="w-full min-h-[48px] text-base touch-manipulation"
                disabled={uploading}
                variant={capturedPhotos.length > 0 ? "outline" : "default"}
              >
                <Plus className="mr-2 h-5 w-5" />
                {capturedPhotos.length > 0 ? "Add Another Photo" : "Take Photo"}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <img
                src={currentPhoto || "/placeholder.svg"}
                alt="Current"
                className="w-full rounded-lg max-h-[50vh] object-contain"
              />

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
                  className="flex-1 min-h-[48px] bg-transparent touch-manipulation"
                  disabled={uploading}
                >
                  Retake
                </Button>
                <Button
                  onClick={handleAddPhoto}
                  className="flex-1 min-h-[48px] touch-manipulation"
                  disabled={uploading}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    "Add Photo"
                  )}
                </Button>
              </div>
            </div>
          )}

          {capturedPhotos.length > 0 && !currentPhoto && (
            <div className="flex gap-2 pt-2 border-t">
              <Button
                onClick={handleCancel}
                variant="outline"
                className="flex-1 min-h-[48px] bg-transparent touch-manipulation"
              >
                Cancel
              </Button>
              <Button onClick={handleConfirm} className="flex-1 min-h-[48px] touch-manipulation">
                Confirm ({capturedPhotos.length} photo{capturedPhotos.length !== 1 ? "s" : ""})
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
