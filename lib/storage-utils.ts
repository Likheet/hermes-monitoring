export async function uploadTaskPhoto(taskId: string, file: Blob): Promise<string> {
  // Note: Callers should compress images using image-utils.compressImage()
  // before calling this function. That function compresses to max 500KB with
  // adaptive quality, which is more sophisticated than a simple resize.

  if (file.type.startsWith("image/")) {
    const sizeKB = (file.size / 1024).toFixed(1)
    console.log(`[upload] Uploading image: ${sizeKB}KB`)

    // Warn if image is unexpectedly large (may need compression)
    if (file.size > 1 * 1024 * 1024) {
      console.warn(`[upload] Large image detected (${sizeKB}KB). Consider compressing before upload using image-utils.compressImage()`)
    }
  }

  const formData = new FormData()
  formData.append("file", file, "photo.jpg")
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
