"use client"

import { useState, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Star, Camera, X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { uploadTaskPhoto } from "@/lib/storage-utils"

interface RatingModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (rating: number, qualityComment: string, proofPhotoUrl: string | null) => void
  taskId: string
}

export function RatingModal({ open, onOpenChange, onSubmit, taskId }: RatingModalProps) {
  const [rating, setRating] = useState(0)
  const [hoveredRating, setHoveredRating] = useState(0)
  const [qualityComment, setQualityComment] = useState("")
  const [proofPhoto, setProofPhoto] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [showCamera, setShowCamera] = useState(false)
  const { toast } = useToast()

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      })
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        await videoRef.current.play()
      }
      setStream(mediaStream)
      setShowCamera(true)
    } catch (error) {
      console.error("Camera error:", error)
      toast({
        title: "Camera Error",
        description: "Could not access camera. Please check permissions.",
        variant: "destructive",
      })
    }
  }

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      setStream(null)
    }
    setShowCamera(false)
  }

  const capturePhoto = async () => {
    if (!videoRef.current) {
      console.error("Video ref not available")
      toast({
        title: "Capture Failed",
        description: "Video element not ready",
        variant: "destructive",
      })
      return
    }

    const videoWidth = videoRef.current.videoWidth
    const videoHeight = videoRef.current.videoHeight


    if (videoWidth === 0 || videoHeight === 0) {
      console.error("Invalid video dimensions")
      toast({
        title: "Capture Failed",
        description: "Video not ready. Please wait a moment and try again.",
        variant: "destructive",
      })
      return
    }

    const canvas = document.createElement("canvas")
    canvas.width = videoWidth
    canvas.height = videoHeight
    const ctx = canvas.getContext("2d")

    if (!ctx) {
      console.error("Canvas context not available")
      toast({
        title: "Capture Failed",
        description: "Could not create canvas context",
        variant: "destructive",
      })
      return
    }

    ctx.drawImage(videoRef.current, 0, 0, videoWidth, videoHeight)

    setUploading(true)

    try {
      canvas.toBlob(
        async (blob) => {
          try {
            if (!blob) {
              console.error("Blob creation failed - blob is null")
              toast({
                title: "Capture Failed",
                description: "Could not create image from video. Please try again.",
                variant: "destructive",
              })
              setUploading(false)
              return
            }

            const photoUrl = await uploadTaskPhoto(blob, taskId)
            setProofPhoto(photoUrl)
            stopCamera()
            toast({
              title: "Photo Captured",
              description: "Proof photo uploaded successfully",
            })
          } catch (error) {
            console.error("Upload error:", error)
            toast({
              title: "Upload Failed",
              description: "Could not upload proof photo",
              variant: "destructive",
            })
          } finally {
            setUploading(false)
          }
        },
        "image/jpeg",
        0.8,
      )
    } catch (error) {
      console.error("Canvas toBlob error:", error)
      toast({
        title: "Capture Failed",
        description: "Could not capture photo",
        variant: "destructive",
      })
      setUploading(false)
    }
  }

  const handleSubmit = () => {
    if (rating === 0) {
      toast({
        title: "Rating Required",
        description: "Please select a rating",
        variant: "destructive",
      })
      return
    }

    if (rating < 5 && !proofPhoto) {
      toast({
        title: "Proof Required",
        description: "Please attach a photo showing why the rating is not 5 stars",
        variant: "destructive",
      })
      return
    }

    onSubmit(rating, qualityComment, proofPhoto)
    onOpenChange(false)
    // Reset state
    setRating(0)
    setQualityComment("")
    setProofPhoto(null)
    stopCamera()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="space-y-2">
          <DialogTitle className="text-lg sm:text-xl">Rate Task Quality</DialogTitle>
          <DialogDescription className="text-sm">
            Rate the quality of work completed. Ratings below 5 stars require photo proof.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label className="text-sm sm:text-base">Quality Rating</Label>
            <div className="flex gap-1 sm:gap-2 justify-center">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="transition-transform hover:scale-110 active:scale-95 touch-manipulation p-1"
                >
                  <Star
                    className={`h-8 w-8 sm:h-10 sm:w-10 ${
                      star <= (hoveredRating || rating) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
                    }`}
                  />
                </button>
              ))}
            </div>
            <p className="text-center text-sm text-muted-foreground">
              {rating === 0 ? "Select a rating" : `${rating} star${rating !== 1 ? "s" : ""}`}
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-sm sm:text-base">Quality Comment</Label>
            <Textarea
              placeholder="Add comments about the work quality..."
              value={qualityComment}
              onChange={(e) => setQualityComment(e.target.value)}
              rows={3}
              className="resize-none text-base min-h-[80px]"
            />
          </div>

          {rating > 0 && rating < 5 && (
            <div className="space-y-2">
              <Label className="text-destructive text-sm sm:text-base">Proof Required (Rating below 5 stars)</Label>
              <p className="text-sm text-muted-foreground">
                Please attach a photo showing the issue that prevented a 5-star rating
              </p>

              {!proofPhoto && !showCamera && (
                <Button
                  onClick={startCamera}
                  variant="outline"
                  className="w-full bg-transparent min-h-[48px] touch-manipulation"
                >
                  <Camera className="mr-2 h-4 w-4" />
                  Take Proof Photo
                </Button>
              )}

              {showCamera && (
                <div className="space-y-2">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full rounded-lg bg-black max-h-[40vh] object-contain"
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={capturePhoto}
                      disabled={uploading}
                      className="flex-1 min-h-[48px] touch-manipulation"
                    >
                      <Camera className="mr-2 h-4 w-4" />
                      {uploading ? "Uploading..." : "Capture"}
                    </Button>
                    <Button
                      onClick={stopCamera}
                      variant="outline"
                      className="min-h-[48px] touch-manipulation bg-transparent"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {proofPhoto && (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element -- Camera capture preview relies on data URLs for instant feedback */}
                  <img
                    src={proofPhoto || "/placeholder.svg"}
                    alt="Proof"
                    className="w-full rounded-lg max-h-[40vh] object-contain"
                  />
                  <Button
                    size="icon"
                    variant="destructive"
                    className="absolute top-2 right-2 h-9 w-9 sm:h-8 sm:w-8 shadow-lg"
                    onClick={() => setProofPhoto(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto min-h-[48px] touch-manipulation"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={uploading}
            className="w-full sm:w-auto min-h-[48px] touch-manipulation"
          >
            Submit Rating
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
