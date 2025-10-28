"use client"

import type { SyntheticEvent } from "react"
import Image, { type ImageProps } from "next/image"

type TaskImageProps = Omit<ImageProps, "src" | "alt"> & {
  src?: string | null
  alt: string
  fallbackSrc?: string
  /**
   * Force-opt out of Next.js optimisation. If not provided we automatically
   * disable optimisation for blob/data URLs because the built-in loader cannot
   * process them.
   */
  unoptimized?: boolean
}

function isInMemoryUrl(url: string) {
  return url.startsWith("blob:") || url.startsWith("data:")
}

export function TaskImage({
  src,
  alt,
  fallbackSrc = "/placeholder.svg",
  unoptimized,
  onLoad,
  onLoadingComplete,
  ...rest
}: TaskImageProps) {
  const resolvedSrc = src && src.length > 0 ? src : fallbackSrc
  const shouldUnoptimize = unoptimized ?? isInMemoryUrl(resolvedSrc)

  const handleLoad =
    onLoad || onLoadingComplete
      ? (event: SyntheticEvent<HTMLImageElement>) => {
          onLoad?.(event)
          onLoadingComplete?.(event.currentTarget)
        }
      : undefined

  return (
    <Image
      src={resolvedSrc}
      alt={alt}
      unoptimized={shouldUnoptimize}
      onLoad={handleLoad}
      {...rest}
    />
  )
}
