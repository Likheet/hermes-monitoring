"use client"

import { useRef, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { AlertTriangle, X } from "lucide-react"
import Image from "next/image"

interface RaiseIssueModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (issueDescription: string, photos: string[]) => void // Added photos parameter
}

export function RaiseIssueModal({ open, onOpenChange, onSubmit }: RaiseIssueModalProps) {
  const [issueDescription, setIssueDescription] = useState("")
  const [photos, setPhotos] = useState<string[]>([]) // Added photos state
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleAddPhoto = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (photos.length >= 5) {
      event.target.value = ""
      return
    }

    const reader = new FileReader()
    reader.onloadend = () => {
      const base64String = reader.result as string
      setPhotos((prev) => [...prev, base64String])
    }
    reader.readAsDataURL(file)

    event.target.value = ""
  }

  const handleSubmit = () => {
    if (!issueDescription.trim()) return

    onSubmit(issueDescription, photos) // Pass photos to onSubmit
    setIssueDescription("")
    setPhotos([]) // Reset photos
    onOpenChange(false)
  }

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Raise Issue
          </DialogTitle>
          <DialogDescription>
            Describe the issue you&apos;re facing with this task. You can also attach photos. This will be sent to both
            supervisor and front office.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="issue">Issue Description</Label>
            <Textarea
              id="issue"
              placeholder="Describe the issue in detail..."
              value={issueDescription}
              onChange={(e) => setIssueDescription(e.target.value)}
              rows={5}
              className="mt-2"
            />
          </div>

          <div>
            <Label>Attach Photos (Optional)</Label>
            <p className="text-xs text-muted-foreground mb-2">Add photos to help explain the issue</p>
            <Button variant="outline" onClick={handleAddPhoto} disabled={photos.length >= 5}>
              Add Photo
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {photos.length > 0 && (
            <div>
              <Label>Attached Photos ({photos.length})</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {photos.map((photo, index) => (
                  <div key={index} className="relative group">
                    <Image
                      src={photo || "/placeholder.svg"}
                      alt={`Issue photo ${index + 1}`}
                      width={200}
                      height={150}
                      className="rounded-lg object-cover w-full h-32"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleRemovePhoto(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!issueDescription.trim()}>
              Submit Issue
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
