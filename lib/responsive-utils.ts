/**
 * Responsive Design Utilities
 * Helper functions and constants for responsive design implementation
 */

// Breakpoint constants matching Tailwind defaults
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
} as const

// Touch target minimum sizes (WCAG 2.1 Level AAA)
export const TOUCH_TARGET = {
  minimum: 44, // px - minimum for accessibility
  comfortable: 48, // px - comfortable for most users
  large: 56, // px - large for primary actions
} as const

// Responsive spacing scale
export const SPACING_SCALE = {
  xs: "clamp(0.25rem, 0.2rem + 0.25vw, 0.5rem)",
  sm: "clamp(0.5rem, 0.4rem + 0.5vw, 0.75rem)",
  md: "clamp(0.75rem, 0.6rem + 0.75vw, 1rem)",
  lg: "clamp(1rem, 0.8rem + 1vw, 1.5rem)",
  xl: "clamp(1.5rem, 1.2rem + 1.5vw, 2rem)",
} as const

// Responsive typography scale
export const TYPOGRAPHY_SCALE = {
  xs: "clamp(0.75rem, 0.7rem + 0.25vw, 0.875rem)",
  sm: "clamp(0.875rem, 0.825rem + 0.25vw, 1rem)",
  base: "clamp(1rem, 0.95rem + 0.25vw, 1.125rem)",
  lg: "clamp(1.125rem, 1.05rem + 0.375vw, 1.25rem)",
  xl: "clamp(1.25rem, 1.15rem + 0.5vw, 1.5rem)",
  "2xl": "clamp(1.5rem, 1.35rem + 0.75vw, 2rem)",
  "3xl": "clamp(1.875rem, 1.65rem + 1.125vw, 2.5rem)",
  "4xl": "clamp(2.25rem, 1.95rem + 1.5vw, 3rem)",
} as const

// Line height recommendations
export const LINE_HEIGHT = {
  tight: 1.25,
  snug: 1.375,
  normal: 1.5,
  relaxed: 1.625,
  loose: 1.75,
} as const

/**
 * Check if current viewport is mobile
 */
export function isMobileViewport(): boolean {
  if (typeof window === "undefined") return false
  return window.innerWidth < BREAKPOINTS.md
}

/**
 * Check if current viewport is tablet
 */
export function isTabletViewport(): boolean {
  if (typeof window === "undefined") return false
  return window.innerWidth >= BREAKPOINTS.md && window.innerWidth < BREAKPOINTS.lg
}

/**
 * Check if current viewport is desktop
 */
export function isDesktopViewport(): boolean {
  if (typeof window === "undefined") return false
  return window.innerWidth >= BREAKPOINTS.lg
}

/**
 * Get responsive class names based on viewport
 */
export function getResponsiveClasses(mobile: string, tablet?: string, desktop?: string): string {
  const classes = [mobile]
  if (tablet) classes.push(`md:${tablet}`)
  if (desktop) classes.push(`lg:${desktop}`)
  return classes.join(" ")
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trim() + "..."
}

/**
 * Format text for responsive display
 */
export function formatResponsiveText(
  text: string,
  mobileLength: number,
  desktopLength: number,
): { mobile: string; desktop: string } {
  return {
    mobile: truncateText(text, mobileLength),
    desktop: truncateText(text, desktopLength),
  }
}
