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
import { Camera, X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { uploadTaskPhoto } from "@/lib/storage-utils"

interface RejectionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (remark: string, proofPhotoUrl: string | null) => void
  taskId: string
}

export function RejectionModal({ open, onOpenChange, onSubmit, taskId }: RejectionModalProps) {
  const [remark, setRemark] = useState("")
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
      }
      setStream(mediaStream)
      setShowCamera(true)
  } catch {
      toast({
        title: "Camera Error",
        description: "Could not access camera",
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
    if (!videoRef.current) return

    const canvas = document.createElement("canvas")
    canvas.width = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.drawImage(videoRef.current, 0, 0)

    setUploading(true)
    try {
      canvas.toBlob(
        async (blob) => {
          if (!blob) return

          const photoUrl = await uploadTaskPhoto(taskId, blob)
          setProofPhoto(photoUrl)
          stopCamera()
          toast({
            title: "Photo Captured",
            description: "Proof photo uploaded successfully",
          })
        },
        "image/jpeg",
        0.8,
      )
  } catch {
      toast({
        title: "Upload Failed",
        description: "Could not upload proof photo",
        variant: "destructive",
      })
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = () => {
    if (!remark.trim()) {
      toast({
        title: "Remark Required",
        description: "Please explain why the task is being rejected",
        variant: "destructive",
      })
      return
    }

    onSubmit(remark, proofPhoto)
    onOpenChange(false)
    // Reset state
    setRemark("")
    setProofPhoto(null)
    stopCamera()
  }

  const handleCancel = () => {
    onOpenChange(false)
    setRemark("")
    setProofPhoto(null)
    stopCamera()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reject Task</DialogTitle>
          <DialogDescription>
            Provide a reason for rejecting this task and optionally attach proof photo
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="rejection-remark">Rejection Reason *</Label>
            <Textarea
              id="rejection-remark"
              placeholder="Explain why the task is being rejected..."
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label>Proof Photo (Optional)</Label>
            <p className="text-sm text-muted-foreground">Attach a photo showing the issue</p>

            {!proofPhoto && !showCamera && (
              <Button onClick={startCamera} variant="outline" className="w-full bg-transparent">
                <Camera className="mr-2 h-4 w-4" />
                Take Proof Photo
              </Button>
            )}

            {showCamera && (
              <div className="space-y-2">
                <video ref={videoRef} autoPlay playsInline className="w-full rounded-lg" />
                <div className="flex gap-2">
                  <Button onClick={capturePhoto} disabled={uploading} className="flex-1">
                    <Camera className="mr-2 h-4 w-4" />
                    {uploading ? "Uploading..." : "Capture"}
                  </Button>
                  <Button onClick={stopCamera} variant="outline">
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {proofPhoto && (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- Camera capture preview relies on data URLs for instant feedback */}
                <img src={proofPhoto || "/placeholder.svg"} alt="Rejection proof" className="w-full rounded-lg" />
                <Button
                  size="icon"
                  variant="destructive"
                  className="absolute top-2 right-2"
                  onClick={() => setProofPhoto(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleSubmit} disabled={uploading}>
            Reject Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
