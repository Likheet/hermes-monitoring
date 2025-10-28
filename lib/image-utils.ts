import type { CategorizedPhotos } from "./types"

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

export type PhotoSection = {
  key: string
  label: string
  urls: string[]
}

const CATEGORY_LABELS: Record<string, string> = {
  room_photos: "Room Photos",
  proof_photos: "Proof Photos",
  before_photos: "Before Photos",
  during_photos: "During Photos",
  after_photos: "After Photos",
}

function toTitleCase(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/(^|\s)\w/g, (match) => match.toUpperCase())
}

export function getCategorizedPhotoSections(photos?: CategorizedPhotos | null): PhotoSection[] {
  if (!photos) {
    return []
  }

  const sections: PhotoSection[] = []
  const handledKeys = new Set<string>(["room_photos", "proof_photos", "before_photos", "during_photos", "after_photos", "dynamic_categories"])

  const appendSection = (key: string, urls?: string[] | null) => {
    const cleaned = (urls ?? []).filter((url): url is string => typeof url === "string" && url.length > 0)
    if (cleaned.length === 0) {
      return
    }

    const label = CATEGORY_LABELS[key] ?? toTitleCase(key.replace(/^dynamic:/, ""))
    sections.push({ key, label, urls: cleaned })
  }

  appendSection("room_photos", photos.room_photos)
  appendSection("proof_photos", photos.proof_photos)
  appendSection("before_photos", photos.before_photos)
  appendSection("during_photos", photos.during_photos)
  appendSection("after_photos", photos.after_photos)

  if (photos.dynamic_categories) {
    for (const [categoryKey, urls] of Object.entries(photos.dynamic_categories)) {
      appendSection(`dynamic:${categoryKey}`, urls)
    }
  }

  for (const [key, value] of Object.entries(photos)) {
    if (handledKeys.has(key)) {
      continue
    }

    if (Array.isArray(value)) {
      appendSection(key, value)
      continue
    }

    if (value && typeof value === "object" && "urls" in (value as Record<string, unknown>)) {
      const maybeUrls = (value as { urls?: string[] }).urls
      appendSection(key, maybeUrls)
    }
  }

  return sections
}
