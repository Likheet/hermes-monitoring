"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Camera, Loader2, AlertCircle, X, Plus, CheckCircle2, Clock, Wrench, CheckCheck } from "lucide-react"
import { compressImage, blobToDataURL } from "@/lib/image-utils"
import { uploadTaskPhoto } from "@/lib/storage-utils"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { triggerHaptic, triggerSuccessHaptic, triggerErrorHaptic } from "@/lib/haptics"
import { Badge } from "@/components/ui/badge"
import type { CategorizedPhotos } from "@/lib/types"
import { toast } from "@/components/ui/use-toast"

interface CategorizedPhotoCaptureModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPhotosCapture: (photos: CategorizedPhotos) => void
  taskId: string
  existingPhotos?: CategorizedPhotos
  minRoomPhotos?: number
  minProofPhotos?: number
  mode?: "task" | "maintenance"
}

type PhotoCategory = "room_photos" | "proof_photos" | "before_photos" | "after_photos"

export function CategorizedPhotoCaptureModal({
  open,
  onOpenChange,
  onPhotosCapture,
  taskId,
  existingPhotos,
  minRoomPhotos = 1,
  minProofPhotos = 1,
  mode = "task",
}: CategorizedPhotoCaptureModalProps) {
  const [roomPhotos, setRoomPhotos] = useState<string[]>(existingPhotos?.room_photos || [])
  const [proofPhotos, setProofPhotos] = useState<string[]>(existingPhotos?.proof_photos || [])
  const [beforePhotos, setBeforePhotos] = useState<string[]>(existingPhotos?.before_photos || [])
  const [afterPhotos, setAfterPhotos] = useState<string[]>(existingPhotos?.after_photos || [])

  const [activeCategory, setActiveCategory] = useState<PhotoCategory>(
    mode === "maintenance" ? "before_photos" : "room_photos",
  )
  const [currentPhoto, setCurrentPhoto] = useState<string | null>(null)
  const [compressedBlob, setCompressedBlob] = useState<Blob | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const taskCategoryConfig = {
    room_photos: {
      label: "Room Photos",
      description: "Full-room photos post-service to verify cleanliness",
      icon: Clock,
      color: "bg-primary",
      minRequired: minRoomPhotos,
    },
    proof_photos: {
      label: "Proof Photos",
      description: "Proof-of-completion photos showing work done",
      icon: Wrench,
      color: "bg-secondary",
      minRequired: minProofPhotos,
    },
  }

  const maintenanceCategoryConfig = {
    before_photos: {
      label: "Before Photos",
      description: "Capture the current state before starting maintenance work",
      icon: Clock,
      color: "bg-blue-500",
      minRequired: 1,
    },
    after_photos: {
      label: "After Photos",
      description: "Show the completed work and final state after maintenance",
      icon: CheckCheck,
      color: "bg-primary",
      minRequired: 1,
    },
  }

  const categoryConfig = mode === "maintenance" ? maintenanceCategoryConfig : taskCategoryConfig

  const getCurrentPhotos = () => {
    if (mode === "maintenance") {
      switch (activeCategory) {
        case "before_photos":
          return beforePhotos
        case "after_photos":
          return afterPhotos
        default:
          return []
      }
    } else {
      return activeCategory === "room_photos" ? roomPhotos : proofPhotos
    }
  }

  const setCurrentPhotos = (photos: string[]) => {
    if (mode === "maintenance") {
      switch (activeCategory) {
        case "before_photos":
          setBeforePhotos(photos)
          break
        case "after_photos":
          setAfterPhotos(photos)
          break
      }
    } else {
      if (activeCategory === "room_photos") {
        setRoomPhotos(photos)
      } else {
        setProofPhotos(photos)
      }
    }
  }

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
        setCurrentPhotos([...getCurrentPhotos(), photoUrl])
        setCurrentPhoto(null)
        setCompressedBlob(null)
        setUploadProgress(0)

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
    setCurrentPhotos(getCurrentPhotos().filter((_, i) => i !== index))
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
    if (mode === "maintenance") {
      return beforePhotos.length >= 1 && afterPhotos.length >= 1
    } else {
      return roomPhotos.length >= minRoomPhotos && proofPhotos.length >= minProofPhotos
    }
  }

  const handleConfirm = () => {
    if (!isValidForSubmission()) {
      if (mode === "maintenance") {
        setError("Please capture at least 1 Before Photo and 1 After Photo")
      } else {
        setError(
          `Please capture at least ${minRoomPhotos} Room Photo${minRoomPhotos > 1 ? "s" : ""} and ${minProofPhotos} Proof Photo${minProofPhotos > 1 ? "s" : ""}`,
        )
      }
      triggerErrorHaptic()
      return
    }

    if (mode === "maintenance") {
      onPhotosCapture({
        room_photos: [],
        proof_photos: [],
        before_photos: beforePhotos,
        after_photos: afterPhotos,
      })
    } else {
      onPhotosCapture({ room_photos: roomPhotos, proof_photos: proofPhotos })
    }

    onOpenChange(false)
  }

  const handleSaveAndContinue = () => {
    if (mode === "maintenance") {
      onPhotosCapture({
        room_photos: [],
        proof_photos: [],
        before_photos: beforePhotos,
        after_photos: afterPhotos,
      })
    } else {
      onPhotosCapture({ room_photos: roomPhotos, proof_photos: proofPhotos })
    }

    toast({
      title: "Photos Saved",
      description: "You can continue adding more photos later",
    })
    onOpenChange(false)
  }

  const handleCancel = () => {
    setRoomPhotos(existingPhotos?.room_photos || [])
    setProofPhotos(existingPhotos?.proof_photos || [])
    setBeforePhotos(existingPhotos?.before_photos || [])
    setAfterPhotos(existingPhotos?.after_photos || [])
    setCurrentPhoto(null)
    setCompressedBlob(null)
    setError(null)
    onOpenChange(false)
  }

  useEffect(() => {
    if (open && existingPhotos) {
      setRoomPhotos(existingPhotos.room_photos || [])
      setProofPhotos(existingPhotos.proof_photos || [])
      setBeforePhotos(existingPhotos.before_photos || [])
      setAfterPhotos(existingPhotos.after_photos || [])
      console.log("[v0] Loaded existing photos:", {
        before: existingPhotos.before_photos?.length || 0,
        after: existingPhotos.after_photos?.length || 0,
      })
    }
  }, [open, existingPhotos])

  const config = categoryConfig[activeCategory as keyof typeof categoryConfig]
  const currentPhotos = getCurrentPhotos()
  const CategoryIcon = config.icon

  const totalRequired = mode === "maintenance" ? 2 : minRoomPhotos + minProofPhotos
  const totalCaptured =
    mode === "maintenance" ? beforePhotos.length + afterPhotos.length : roomPhotos.length + proofPhotos.length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "maintenance" ? "Maintenance Photo Documentation" : "Photo Documentation"}
          </DialogTitle>
          <DialogDescription>
            {mode === "maintenance"
              ? "Capture before and after photos for maintenance documentation. Minimum 2 photos required (1 before + 1 after)."
              : `Capture photos for task completion. Minimum ${totalRequired} photo${totalRequired > 1 ? "s" : ""} required (${minRoomPhotos} room + ${minProofPhotos} proof).`}
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

          <div className={`grid ${mode === "maintenance" ? "grid-cols-2" : "grid-cols-2"} gap-3`}>
            {(Object.keys(categoryConfig) as PhotoCategory[]).map((category) => {
              const cat = categoryConfig[category as keyof typeof categoryConfig]
              let photos: string[] = []

              if (mode === "maintenance") {
                switch (category) {
                  case "before_photos":
                    photos = beforePhotos
                    break
                  case "after_photos":
                    photos = afterPhotos
                    break
                }
              } else {
                photos = category === "room_photos" ? roomPhotos : proofPhotos
              }

              const isComplete = photos.length >= cat.minRequired
              const Icon = cat.icon

              return (
                <button
                  key={category}
                  onClick={() => {
                    setActiveCategory(category)
                    setCurrentPhoto(null)
                    setError(null)
                    triggerHaptic("light")
                  }}
                  className={`relative p-4 rounded-lg border-2 transition-all ${
                    activeCategory === category
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className={`p-2 rounded-lg ${cat.color} text-white`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-sm">{cat.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {photos.length}
                        {cat.minRequired > 0 ? `/${cat.minRequired}` : ""}
                      </div>
                    </div>
                    {isComplete && cat.minRequired > 0 && (
                      <CheckCircle2 className="h-5 w-5 text-primary absolute top-2 right-2" />
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          <div className="bg-muted/50 p-4 rounded-lg border">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${config.color} text-white`}>
                <CategoryIcon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-sm mb-1">{config.label}</h3>
                <p className="text-xs text-muted-foreground">{config.description}</p>
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant={currentPhotos.length >= config.minRequired ? "default" : "secondary"}>
                    {currentPhotos.length} / {config.minRequired} required
                  </Badge>
                  {currentPhotos.length > config.minRequired && (
                    <Badge variant="outline">+{currentPhotos.length - config.minRequired} extra</Badge>
                  )}
                </div>
              </div>
            </div>
          </div>

          {currentPhotos.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Captured {config.label}:</p>
              <div className="grid grid-cols-3 gap-2">
                {currentPhotos.map((photo, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={photo || "/placeholder.svg"}
                      alt={`${config.label} ${index + 1}`}
                      className="w-full aspect-square object-cover rounded-lg border-2"
                    />
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute top-1 right-1 h-7 w-7 shadow-lg"
                      onClick={() => handleRemovePhoto(index)}
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
                {currentPhotos.length === 0 ? `Take ${config.label}` : `Add Another ${config.label.slice(0, -1)}`}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative">
                <img src={currentPhoto || "/placeholder.svg"} alt="Preview" className="w-full rounded-lg border-2" />
                <Badge className={`absolute top-2 left-2 ${config.color} text-white`}>{config.label}</Badge>
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

          {!currentPhoto && totalCaptured > 0 && (
            <div className="flex gap-2 pt-4 border-t">
              <Button onClick={handleCancel} variant="outline" className="flex-1 min-h-[48px] bg-transparent" size="lg">
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
          )}

          {!currentPhoto && totalCaptured > 0 && (
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
                {mode === "maintenance" ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span>Before Photos:</span>
                      <span className={beforePhotos.length >= 1 ? "text-primary font-medium" : ""}>
                        {beforePhotos.length >= 1 ? "✓" : "✗"} {beforePhotos.length}/1 required
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>After Photos:</span>
                      <span className={afterPhotos.length >= 1 ? "text-primary font-medium" : ""}>
                        {afterPhotos.length >= 1 ? "✓" : "✗"} {afterPhotos.length}/1 required
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span>Room Photos:</span>
                      <span className={roomPhotos.length >= minRoomPhotos ? "text-primary font-medium" : ""}>
                        {roomPhotos.length >= minRoomPhotos ? "✓" : "✗"} {roomPhotos.length}/{minRoomPhotos} required
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Proof Photos:</span>
                      <span className={proofPhotos.length >= minProofPhotos ? "text-primary font-medium" : ""}>
                        {proofPhotos.length >= minProofPhotos ? "✓" : "✗"} {proofPhotos.length}/{minProofPhotos}{" "}
                        required
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
