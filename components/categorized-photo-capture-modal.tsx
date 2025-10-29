"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Camera, Loader2, AlertCircle, X, Plus, CheckCircle2 } from "lucide-react"
import { compressImage, blobToDataURL } from "@/lib/image-utils"
import { uploadTaskPhoto } from "@/lib/storage-utils"
import type { PhotoBucket } from "@/lib/photo-utils"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { triggerHaptic, triggerSuccessHaptic, triggerErrorHaptic } from "@/lib/haptics"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/components/ui/use-toast"

interface PhotoCategory {
  name: string
  count: number
  description?: string
}

interface CategorizedPhotoCaptureModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (photos: PhotoBucket) => void
  taskId: string
  photoCategories: PhotoCategory[]
  existingPhotos?: PhotoBucket
}

export function CategorizedPhotoCaptureModal({
  open,
  onOpenChange,
  onSave,
  taskId,
  photoCategories,
  existingPhotos,
}: CategorizedPhotoCaptureModalProps) {
  const [photos, setPhotos] = useState<PhotoBucket>(() => {
    const initial: PhotoBucket = {}
    photoCategories.forEach((cat) => {
      const key = cat.name.toLowerCase().replace(/\s+/g, "_")
      initial[key] = existingPhotos?.[key] || []
    })
    return initial
  })

  const [activeCategory, setActiveCategory] = useState<string>(
    photoCategories[0]?.name.toLowerCase().replace(/\s+/g, "_") || "",
  )
  const [currentPhoto, setCurrentPhoto] = useState<string | null>(null)
  const [compressedBlob, setCompressedBlob] = useState<Blob | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const lastExistingPhotosHashRef = useRef<string>("")
  const modalOpenedRef = useRef<boolean>(false)

  useEffect(() => {
    if (!open) {
      modalOpenedRef.current = false
      return
    }

    // On first open, always reload from existingPhotos
    const isFirstOpen = !modalOpenedRef.current
    modalOpenedRef.current = true

    const currentHash = JSON.stringify(existingPhotos ?? {})
    
    // Skip reload if hash hasn't changed AND it's not the first open
    if (!isFirstOpen && currentHash === lastExistingPhotosHashRef.current) {
      return
    }

    console.log("[photo-modal] Reloading photos from existingPhotos", { isFirstOpen, existingPhotos })
    lastExistingPhotosHashRef.current = currentHash
    
    const reloaded: PhotoBucket = {}
    photoCategories.forEach((cat) => {
      const key = cat.name.toLowerCase().replace(/\s+/g, "_")
      reloaded[key] = existingPhotos?.[key] || []
    })
    setPhotos(reloaded)
  }, [open, existingPhotos, photoCategories])

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
      const error = err as Error
      setError(error.message || "Failed to process image. Please try again.")
      triggerErrorHaptic()
      console.error("Image compression error:", err)
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
        setPhotos((prev) => ({
          ...prev,
          [activeCategory]: [...(prev[activeCategory] || []), photoUrl],
        }))
        setCurrentPhoto(null)
        setCompressedBlob(null)
        setUploadProgress(0)

        if (fileInputRef.current) {
          fileInputRef.current.value = ""
        }
      }
    } catch (err) {
      const error = err as Error
      setError(error.message || "Failed to upload photo. Please try again.")
      triggerErrorHaptic()
      console.error("Photo upload error:", err)
    } finally {
      setUploading(false)
    }
  }

  const handleRemovePhoto = (categoryKey: string, index: number) => {
    setPhotos((prev) => ({
      ...prev,
      [categoryKey]: (prev[categoryKey] || []).filter((_, i) => i !== index),
    }))
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

  const isValidForSubmission = () => {
    const validationResults = photoCategories.map((cat) => {
      const key = cat.name.toLowerCase().replace(/\s+/g, "_")
      const count = (photos[key] || []).length
      const required = cat.count
      const valid = count >= required
      return { category: cat.name, key, count, required, valid }
    })
    
    console.log("[photo-modal] Validation check:", validationResults)
    
    return validationResults.every(r => r.valid)
  }

  const handleConfirm = async () => {
    if (!isValidForSubmission()) {
      const missingCategories = photoCategories
        .filter((cat) => {
          const key = cat.name.toLowerCase().replace(/\s+/g, "_")
          return (photos[key] || []).length < cat.count
        })
        .map((cat) => cat.name)
        .join(", ")

      console.error("[photo-modal] Validation failed. Missing:", missingCategories, "Current photos:", photos)
      setError(`Please capture all required photos. Missing: ${missingCategories}`)
      triggerErrorHaptic()
      return
    }

    console.log("[photo-modal] Validation passed, saving photos:", photos)
    await Promise.resolve(onSave(photos))
    onOpenChange(false)
  }

  const handleSaveAndContinue = async () => {
    await Promise.resolve(onSave(photos))
    toast({
      title: "Photos Saved",
      description: "You can continue adding more photos later",
    })
    onOpenChange(false)
  }

  const handleCancel = () => {
    const initial: Record<string, string[]> = {}
    photoCategories.forEach((cat) => {
      const key = cat.name.toLowerCase().replace(/\s+/g, "_")
      initial[key] = existingPhotos?.[key] || []
    })
    setPhotos(initial)
    setCurrentPhoto(null)
    setCompressedBlob(null)
    setError(null)
    onOpenChange(false)
  }

  const activeCategoryConfig = photoCategories.find(
    (cat) => cat.name.toLowerCase().replace(/\s+/g, "_") === activeCategory,
  )
  const currentPhotos = photos[activeCategory] || []

  const totalRequired = photoCategories.reduce((sum, cat) => sum + cat.count, 0)
  const totalCaptured = Object.values(photos).reduce((sum, arr) => sum + (arr?.length || 0), 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Photo Documentation</DialogTitle>
          <DialogDescription>
            Capture {totalRequired} photo{totalRequired > 1 ? "s" : ""} across {photoCategories.length} categor
            {photoCategories.length > 1 ? "ies" : "y"}. All photos are required for task completion.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <span className="text-sm">{error}</span>
              </AlertDescription>
            </Alert>
          )}

          <div
            className={`grid gap-3 ${photoCategories.length === 2 ? "grid-cols-2" : photoCategories.length === 3 ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-3"}`}
          >
            {photoCategories.map((category) => {
              const key = category.name.toLowerCase().replace(/\s+/g, "_")
              const categoryPhotos = photos[key] || []
              const isComplete = categoryPhotos.length >= category.count

              return (
                <button
                  key={key}
                  onClick={() => {
                    setActiveCategory(key)
                    setCurrentPhoto(null)
                    setError(null)
                    triggerHaptic("light")
                  }}
                  className={`relative p-4 rounded-lg border-2 transition-all ${
                    activeCategory === key ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className={`p-2 rounded-lg ${isComplete ? "bg-primary" : "bg-muted"} text-white`}>
                      <Camera className="h-5 w-5" />
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-sm">{category.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {categoryPhotos.length}/{category.count}
                      </div>
                    </div>
                    {isComplete && <CheckCircle2 className="h-5 w-5 text-primary absolute top-2 right-2" />}
                  </div>
                </button>
              )
            })}
          </div>

          {activeCategoryConfig && (
            <div className="bg-muted/50 p-4 rounded-lg border">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary text-white">
                  <Camera className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-sm mb-1">{activeCategoryConfig.name}</h3>
                  {activeCategoryConfig.description && (
                    <p className="text-xs text-muted-foreground mb-2">{activeCategoryConfig.description}</p>
                  )}
                  <div className="flex items-center gap-2">
                    <Badge variant={currentPhotos.length >= activeCategoryConfig.count ? "default" : "secondary"}>
                      {currentPhotos.length} / {activeCategoryConfig.count} required
                    </Badge>
                    {currentPhotos.length > activeCategoryConfig.count && (
                      <Badge variant="outline">+{currentPhotos.length - activeCategoryConfig.count} extra</Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Captured photos grid */}
          {currentPhotos.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Captured {activeCategoryConfig?.name}:</p>
              <div className="grid grid-cols-3 gap-2">
                {currentPhotos.map((photo, index) => (
                  <div key={index} className="relative group">
                    {/* eslint-disable-next-line @next/next/no-img-element -- Captured photos are stored as data URLs for instant preview */}
                    <img
                      src={photo || "/placeholder.svg"}
                      alt={`${activeCategoryConfig?.name} ${index + 1}`}
                      className="w-full aspect-square object-cover rounded-lg border-2"
                    />
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute top-1 right-1 h-7 w-7 shadow-lg"
                      onClick={() => handleRemovePhoto(activeCategory, index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <div className="absolute bottom-1 left-1 bg-black/70 text-white text-xs px-2 py-0.5 rounded">
                      #{index + 1}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Photo capture UI */}
          {!currentPhoto ? (
            <div className="space-y-3">
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
                className="w-full min-h-[56px] text-base"
                disabled={uploading}
                size="lg"
              >
                <Camera className="mr-2 h-5 w-5" />
                {currentPhotos.length === 0
                  ? `Take ${activeCategoryConfig?.name}`
                  : `Add Another ${activeCategoryConfig?.name}`}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- Camera preview uses data URLs */}
                <img src={currentPhoto || "/placeholder.svg"} alt="Preview" className="w-full rounded-lg border-2" />
                <Badge className="absolute top-2 left-2 bg-primary text-white">{activeCategoryConfig?.name}</Badge>
              </div>

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
                  size="lg"
                >
                  Retake
                </Button>
                <Button onClick={handleAddPhoto} className="flex-1 min-h-[48px]" disabled={uploading} size="lg">
                  {uploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Photo
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Action buttons */}
          {!currentPhoto && totalCaptured > 0 && (
            <>
              <div className="flex gap-2 pt-4 border-t">
                <Button
                  onClick={handleCancel}
                  variant="outline"
                  className="flex-1 min-h-[48px] bg-transparent"
                  size="lg"
                >
                  Cancel
                </Button>
                {!isValidForSubmission() && (
                  <Button onClick={handleSaveAndContinue} variant="secondary" className="flex-1 min-h-[48px]" size="lg">
                    Save & Continue Later
                  </Button>
                )}
                <Button
                  onClick={handleConfirm}
                  className="flex-1 min-h-[48px]"
                  disabled={!isValidForSubmission()}
                  size="lg"
                >
                  {isValidForSubmission() ? (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Confirm ({totalCaptured} photos)
                    </>
                  ) : (
                    <>Missing Required Photos</>
                  )}
                </Button>
              </div>

              <div className="bg-muted/30 p-3 rounded-lg text-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Documentation Status:</span>
                  {isValidForSubmission() ? (
                    <Badge variant="default" className="bg-primary">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Complete
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Incomplete</Badge>
                  )}
                </div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  {photoCategories.map((cat) => {
                    const key = cat.name.toLowerCase().replace(/\s+/g, "_")
                    const count = (photos[key] || []).length
                    const isComplete = count >= cat.count
                    return (
                      <div key={key} className="flex items-center justify-between">
                        <span>{cat.name}:</span>
                        <span className={isComplete ? "text-primary font-medium" : ""}>
                          {isComplete ? "✓" : "✗"} {count}/{cat.count} required
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
