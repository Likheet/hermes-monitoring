/**
 * Compresses an image file to reduce egress and storage costs
 * @param file - The image file to compress
 * @param maxWidth - Maximum width in pixels (default: 1920)
 * @param quality - JPEG quality 0-1 (default: 0.8)
 * @returns Compressed image as a Blob
 */
async function compressImage(
  file: Blob,
  maxWidth: number = 1920,
  quality: number = 0.8
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")

    if (!ctx) {
      reject(new Error("Could not get canvas context"))
      return
    }

    img.onload = () => {
      try {
        // Calculate new dimensions maintaining aspect ratio
        let width = img.width
        let height = img.height

        if (width > maxWidth) {
          height = (height * maxWidth) / width
          width = maxWidth
        }

        // Set canvas dimensions
        canvas.width = width
        canvas.height = height

        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob)
            } else {
              reject(new Error("Failed to compress image"))
            }
          },
          "image/jpeg",
          quality
        )
      } catch (error) {
        reject(error)
      } finally {
        // Clean up
        URL.revokeObjectURL(img.src)
      }
    }

    img.onerror = () => {
      URL.revokeObjectURL(img.src)
      reject(new Error("Failed to load image"))
    }

    img.src = URL.createObjectURL(file)
  })
}

export async function uploadTaskPhoto(taskId: string, file: Blob): Promise<string> {
  // Compress image before uploading to reduce egress
  let fileToUpload: Blob = file

  try {
    // Only compress if it's an image
    if (file.type.startsWith("image/")) {
      const originalSize = file.size
      fileToUpload = await compressImage(file, 1920, 0.8)
      const compressedSize = fileToUpload.size
      const savings = ((originalSize - compressedSize) / originalSize * 100).toFixed(1)
      console.log(`[upload] Compressed image: ${(originalSize / 1024).toFixed(1)}KB → ${(compressedSize / 1024).toFixed(1)}KB (${savings}% reduction)`)
    }
  } catch (error) {
    console.warn("[upload] Image compression failed, uploading original:", error)
    fileToUpload = file
  }

  const formData = new FormData()
  formData.append("file", fileToUpload, "photo.jpg")
  formData.append("taskId", taskId)

  const response = await fetch("/api/upload-photo", {
    method: "POST",
    body: formData,
    credentials: "include",
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || "Upload failed")
  }

  const { url } = await response.json()
  return url
}
