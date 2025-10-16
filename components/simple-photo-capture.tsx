"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Camera, X, ImageIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"

interface SimplePhotoCaptureProps {
  taskId: string
  existingPhotos?: string[]
  onPhotosChange: (photos: string[]) => void
  minPhotos?: number
}

export function SimplePhotoCapture({
  taskId,
  existingPhotos = [],
  onPhotosChange,
  minPhotos = 2,
}: SimplePhotoCaptureProps) {
  const [photos, setPhotos] = useState<string[]>(existingPhotos)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const handleCapture = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const file = files[0]

    // Convert to base64 for storage
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64String = reader.result as string
      const newPhotos = [...photos, base64String]
      setPhotos(newPhotos)
      onPhotosChange(newPhotos)

      toast({
        title: "Photo Captured",
        description: `${newPhotos.length} photo(s) captured`,
      })
    }
    reader.readAsDataURL(file)

    // Reset input
    e.target.value = ""
  }

  const handleRemovePhoto = (index: number) => {
    const newPhotos = photos.filter((_, i) => i !== index)
    setPhotos(newPhotos)
    onPhotosChange(newPhotos)

    toast({
      title: "Photo Removed",
      description: `${newPhotos.length} photo(s) remaining`,
    })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base sm:text-lg">Photo Documentation</CardTitle>
          <div className="text-sm text-muted-foreground">
            {photos.length} / {minPhotos} min
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Photo Grid */}
        {photos.length > 0 && (
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {photos.map((photo, index) => (
              <div key={index} className="relative group">
                <img
                  src={photo || "/placeholder.svg"}
                  alt={`Photo ${index + 1}`}
                  className="w-full aspect-square object-cover rounded-lg border-2 border-primary"
                />
                <button
                  onClick={() => handleRemovePhoto(index)}
                  className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  type="button"
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="absolute bottom-1 left-1 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded">
                  {index + 1}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {photos.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center border-2 border-dashed rounded-lg">
            <ImageIcon className="h-12 w-12 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No photos captured yet</p>
            <p className="text-xs text-muted-foreground mt-1">Minimum {minPhotos} photos required</p>
          </div>
        )}

        {/* Capture Button */}
        <Button
          onClick={handleCapture}
          variant="outline"
          size="lg"
          className="w-full min-h-[48px] bg-transparent"
          type="button"
        >
          <Camera className="mr-2 h-5 w-5" />
          {photos.length === 0 ? "Take Photo" : "Add Another Photo"}
        </Button>

        {/* Hidden File Input - Camera Only */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Info Text */}
        <p className="text-xs text-muted-foreground text-center">
          Photos are saved automatically. You can close and reopen this task anytime.
        </p>
      </CardContent>
    </Card>
  )
}
