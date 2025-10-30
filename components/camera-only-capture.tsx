"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Camera, FlipHorizontal, Zap, ZapOff, Loader2, X, Check, AlertCircle, ImageOff } from "lucide-react"
import { compressImage } from "@/lib/image-utils"
import { uploadTaskPhoto } from "@/lib/storage-utils"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { triggerHaptic, triggerSuccessHaptic, triggerErrorHaptic } from "@/lib/haptics"
import { Badge } from "@/components/ui/badge"

interface CameraOnlyCaptureProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPhotoCapture: (photoUrl: string) => void
  taskId: string
  title?: string
  description?: string
}

type FlashMode = "off" | "on" | "auto"
type FacingMode = "user" | "environment"

export function CameraOnlyCapture({
  open,
  onOpenChange,
  onPhotoCapture,
  taskId,
  title = "Camera Capture",
  description = "Take a photo using your device camera",
}: CameraOnlyCaptureProps) {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [facingMode, setFacingMode] = useState<FacingMode>("environment")
  const [flashMode, setFlashMode] = useState<FlashMode>("auto")
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [hasFlash, setHasFlash] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Start camera when modal opens
  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      setStream(null)
    }
    setCameraReady(false)
  }, [stream])

  const startCamera = useCallback(async () => {
    try {
      setError(null)
      setCameraReady(false)

      // Stop existing stream
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }

      // Request camera access
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      })

      setStream(mediaStream)

      // Check if flash is supported
      const videoTrack = mediaStream.getVideoTracks()[0]
  const capabilities = videoTrack.getCapabilities() as MediaTrackCapabilities & { torch?: boolean }
  const torchSupported = capabilities.torch === true
      setHasFlash(torchSupported)

      // Apply flash mode if supported
      if (torchSupported && flashMode !== "auto") {
        await videoTrack.applyConstraints({
          advanced: [{ torch: flashMode === "on" } as MediaTrackConstraintSet & { torch: boolean }],
        })
      }

      // Attach stream to video element
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play()
          setCameraReady(true)
          triggerHaptic("light")
        }
      }
    } catch (err) {
      console.error("Camera error:", err)
      const error = err as DOMException | Error
      setError(
        error.name === "NotAllowedError"
          ? "Camera access denied. Please allow camera permissions in your browser settings."
          : error.name === "NotFoundError"
            ? "No camera found on this device."
            : "Failed to access camera. Please try again.",
      )
      triggerErrorHaptic()
    }
  }, [flashMode, facingMode, stream])

  useEffect(() => {
    if (open && !capturedPhoto) {
      void startCamera()
    }
    return () => {
      stopCamera()
    }
  }, [capturedPhoto, open, startCamera, stopCamera])

  const handleFlipCamera = async () => {
    triggerHaptic("medium")
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"))
  }

  const handleToggleFlash = async () => {
    if (!hasFlash || !stream) return

    triggerHaptic("light")
    const nextMode: FlashMode = flashMode === "off" ? "on" : flashMode === "on" ? "auto" : "off"
    setFlashMode(nextMode)

    try {
      const videoTrack = stream.getVideoTracks()[0]
      if (nextMode !== "auto") {
        await videoTrack.applyConstraints({
          advanced: [{ torch: nextMode === "on" } as MediaTrackConstraintSet & { torch: boolean }],
        })
      }
    } catch (err) {
      console.error("Flash toggle error:", err)
    }
  }

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return

    triggerHaptic("medium")
    const video = videoRef.current
    const canvas = canvasRef.current

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // Draw video frame to canvas
    const ctx = canvas.getContext("2d")
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      // Convert canvas to data URL
      const dataUrl = canvas.toDataURL("image/jpeg", 0.9)
      setCapturedPhoto(dataUrl)
      stopCamera()
      triggerSuccessHaptic()
    }
  }

  const handleRetake = () => {
    setCapturedPhoto(null)
    setError(null)
    setUploadProgress(0)
    triggerHaptic("light")
    void startCamera()
  }

  const handleConfirm = async () => {
    if (!capturedPhoto) return

    setUploading(true)
    setError(null)
    setUploadProgress(0)

    try {
      if (!navigator.onLine) {
        throw new Error("You are offline. Please check your connection and try again.")
      }

      setUploadProgress(20)

      // Convert data URL to blob
      const response = await fetch(capturedPhoto)
      const blob = await response.blob()

      setUploadProgress(40)

      // Compress image
      const compressed = await compressImage(new File([blob], "photo.jpg", { type: "image/jpeg" }), 300)

      setUploadProgress(60)

      // Upload to storage
      const photoUrl = await uploadTaskPhoto(taskId, compressed)

      setUploadProgress(100)

      if (photoUrl) {
        triggerSuccessHaptic()
        onPhotoCapture(photoUrl)
        setCapturedPhoto(null)
        onOpenChange(false)
      }
    } catch (err) {
      const error = err as Error
      setError(error.message || "Failed to upload photo. Please try again.")
      triggerErrorHaptic()
      console.error("Photo upload error:", err)
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  const handleCancel = () => {
    setCapturedPhoto(null)
    setError(null)
    stopCamera()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[95vh] overflow-hidden p-0">
        <DialogHeader className="p-4 sm:p-6 pb-3">
          <DialogTitle className="text-lg sm:text-xl flex items-center gap-2">
            <Camera className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-sm">{description}</DialogDescription>

          {/* Camera-only notice */}
          <Alert className="mt-3 bg-primary/5 border-primary/20">
            <Camera className="h-4 w-4 text-primary" />
            <AlertDescription className="text-xs">
              <strong>Camera Only:</strong> Gallery uploads are not supported. You must capture a new photo using your
              device camera.
            </AlertDescription>
          </Alert>
        </DialogHeader>

        <div className="space-y-4 px-4 sm:px-6 pb-4 sm:pb-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">{error}</AlertDescription>
            </Alert>
          )}

          {/* Camera Preview or Captured Photo */}
          <div className="relative bg-black rounded-lg overflow-hidden aspect-[4/3] sm:aspect-video">
            {!capturedPhoto ? (
              <>
                {/* Live Camera Feed */}
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                <canvas ref={canvasRef} className="hidden" />

                {/* Camera Loading State */}
                {!cameraReady && !error && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white">
                    <Loader2 className="h-12 w-12 animate-spin mb-3" />
                    <p className="text-sm">Starting camera...</p>
                  </div>
                )}

                {/* Camera Controls Overlay */}
                {cameraReady && (
                  <div className="absolute inset-0 pointer-events-none">
                    {/* Top Controls */}
                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-auto">
                      <Badge variant="secondary" className="bg-black/60 text-white border-white/20">
                        <Camera className="h-3 w-3 mr-1" />
                        Live
                      </Badge>

                      <div className="flex gap-2">
                        {/* Flash Toggle */}
                        {hasFlash && (
                          <Button
                            size="icon"
                            variant="secondary"
                            className="h-10 w-10 rounded-full bg-black/60 hover:bg-black/80 border border-white/20"
                            onClick={handleToggleFlash}
                          >
                            {flashMode === "off" ? (
                              <ZapOff className="h-5 w-5 text-white" />
                            ) : flashMode === "on" ? (
                              <Zap className="h-5 w-5 text-yellow-400" />
                            ) : (
                              <Zap className="h-5 w-5 text-white" />
                            )}
                          </Button>
                        )}

                        {/* Flip Camera */}
                        <Button
                          size="icon"
                          variant="secondary"
                          className="h-10 w-10 rounded-full bg-black/60 hover:bg-black/80 border border-white/20"
                          onClick={handleFlipCamera}
                        >
                          <FlipHorizontal className="h-5 w-5 text-white" />
                        </Button>
                      </div>
                    </div>

                    {/* Bottom Capture Button */}
                    <div className="absolute bottom-6 left-0 right-0 flex justify-center pointer-events-auto">
                      <Button
                        size="icon"
                        className="h-16 w-16 rounded-full bg-white hover:bg-white/90 shadow-2xl border-4 border-white/30"
                        onClick={capturePhoto}
                      >
                        <Camera className="h-7 w-7 text-black" />
                      </Button>
                    </div>

                    {/* Flash Mode Indicator */}
                    {hasFlash && flashMode !== "off" && (
                      <div className="absolute bottom-3 left-3 pointer-events-auto">
                        <Badge variant="secondary" className="bg-black/60 text-white border-white/20 text-xs">
                          {flashMode === "on" ? "Flash: ON" : "Flash: AUTO"}
                        </Badge>
                      </div>
                    )}

                    {/* Facing Mode Indicator */}
                    <div className="absolute bottom-3 right-3 pointer-events-auto">
                      <Badge variant="secondary" className="bg-black/60 text-white border-white/20 text-xs">
                        {facingMode === "user" ? "Front Camera" : "Back Camera"}
                      </Badge>
                    </div>
                  </div>
                )}

                {/* No Gallery Upload Notice */}
                {cameraReady && (
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-0 hover:opacity-100 transition-opacity">
                    <div className="bg-black/80 text-white px-4 py-2 rounded-lg text-xs flex items-center gap-2">
                      <ImageOff className="h-4 w-4" />
                      Gallery uploads disabled
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Captured Photo Preview */}
                {/* eslint-disable-next-line @next/next/no-img-element -- Captured photo is a blob/data URL that requires a native <img> */}
                <img
                  src={capturedPhoto || "/placeholder.svg"}
                  alt="Captured"
                  className="w-full h-full object-contain"
                />
                <div className="absolute top-3 left-3">
                  <Badge variant="secondary" className="bg-black/60 text-white border-white/20">
                    <Check className="h-3 w-3 mr-1" />
                    Captured
                  </Badge>
                </div>
              </>
            )}
          </div>

          {/* Upload Progress */}
          {uploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Uploading photo...</span>
                <span className="font-medium">{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} />
            </div>
          )}

          {/* Action Buttons */}
          {capturedPhoto && (
            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleRetake}
                variant="outline"
                className="flex-1 min-h-[48px] bg-transparent touch-manipulation"
                disabled={uploading}
                size="lg"
              >
                <X className="mr-2 h-4 w-4" />
                Retake
              </Button>
              <Button
                onClick={handleConfirm}
                className="flex-1 min-h-[48px] touch-manipulation"
                disabled={uploading}
                size="lg"
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Confirm
                  </>
                )}
              </Button>
            </div>
          )}

          {!capturedPhoto && cameraReady && (
            <Button
              onClick={handleCancel}
              variant="outline"
              className="w-full min-h-[48px] bg-transparent touch-manipulation"
              size="lg"
            >
              Cancel
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
