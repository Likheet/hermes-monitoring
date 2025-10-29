import type { CategorizedPhotos } from "./types"

export type PhotoBucket = Partial<Record<string, string[]>>

export function hasCategorizedPhotoEntries(source?: CategorizedPhotos | null): boolean {
  if (!source) {
    return false
  }

  const baseKeys: Array<keyof CategorizedPhotos> = [
    "room_photos",
    "proof_photos",
    "before_photos",
    "during_photos",
    "after_photos",
  ]

  for (const key of baseKeys) {
    const value = source[key]
    if (Array.isArray(value) && value.length > 0) {
      return true
    }
  }

  if (source.dynamic_categories) {
    for (const entries of Object.values(source.dynamic_categories)) {
      if (Array.isArray(entries) && entries.length > 0) {
        return true
      }
    }
  }

  return false
}

export function categorizedPhotosToBucket(source?: CategorizedPhotos | null): PhotoBucket {
  if (!source) {
    return {}
  }

  const bucket: PhotoBucket = {}

  const assign = (key: keyof CategorizedPhotos) => {
    const value = source[key]
    if (Array.isArray(value) && value.length > 0) {
      bucket[key as string] = value
    }
  }

  assign("room_photos")
  assign("proof_photos")
  assign("before_photos")
  assign("during_photos")
  assign("after_photos")

  if (source.dynamic_categories) {
    for (const [key, value] of Object.entries(source.dynamic_categories)) {
      if (Array.isArray(value) && value.length > 0) {
        bucket[key] = value
      }
    }
  }

  // Capture any additional keys that may have been stored previously
  for (const [key, value] of Object.entries(source)) {
    if (bucket[key]) continue
    if (Array.isArray(value) && value.length > 0) {
      bucket[key] = value
    }
  }

  return bucket
}

export function bucketToCategorizedPhotos(bucket: PhotoBucket): CategorizedPhotos {
  const base: CategorizedPhotos = {
    room_photos: bucket.room_photos ?? [],
    proof_photos: bucket.proof_photos ?? [],
  }

  if (bucket.before_photos && bucket.before_photos.length > 0) {
    base.before_photos = bucket.before_photos
  }
  if (bucket.during_photos && bucket.during_photos.length > 0) {
    base.during_photos = bucket.during_photos
  }
  if (bucket.after_photos && bucket.after_photos.length > 0) {
    base.after_photos = bucket.after_photos
  }

  const dynamic: Record<string, string[]> = {}
  for (const [key, value] of Object.entries(bucket)) {
    if (["room_photos", "proof_photos", "before_photos", "during_photos", "after_photos"].includes(key)) {
      continue
    }

    if (Array.isArray(value) && value.length > 0) {
      dynamic[key] = value
    }
  }

  if (Object.keys(dynamic).length > 0) {
    base.dynamic_categories = dynamic
  }

  return base
}
