/**
 * Compresses an image file to a maximum size using canvas
 * @param file - The image file to compress
 * @param maxSizeKB - Maximum size in kilobytes (default: 500KB)
 * @returns Promise<Blob> - Compressed image blob
 */
export async function compressImage(file: File, maxSizeKB = 500): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      const img = new Image()

      img.onload = () => {
        const canvas = document.createElement("canvas")
        const ctx = canvas.getContext("2d")

        if (!ctx) {
          reject(new Error("Failed to get canvas context"))
          return
        }

        // Calculate new dimensions (max 1920x1080)
        let width = img.width
        let height = img.height
        const maxWidth = 1920
        const maxHeight = 1080

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height)
          width = width * ratio
          height = height * ratio
        }

        canvas.width = width
        canvas.height = height

        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height)

        // Try different quality levels to meet size requirement
        let quality = 0.9
        const tryCompress = () => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error("Failed to compress image"))
                return
              }

              const sizeKB = blob.size / 1024

              if (sizeKB <= maxSizeKB || quality <= 0.1) {
                resolve(blob)
              } else {
                quality -= 0.1
                tryCompress()
              }
            },
            "image/jpeg",
            quality,
          )
        }

        tryCompress()
      }

      img.onerror = () => reject(new Error("Failed to load image"))
      img.src = e.target?.result as string
    }

    reader.onerror = () => reject(new Error("Failed to read file"))
    reader.readAsDataURL(file)
  })
}

/**
 * Converts a blob to a data URL for preview
 */
export function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
