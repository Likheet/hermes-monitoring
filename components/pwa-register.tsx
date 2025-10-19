"use client"

import { useEffect } from "react"

export function PWARegister() {
  useEffect(() => {
    // Service workers require proper server configuration to serve .js files with correct MIME type
    // The PWA will still work for installation via manifest.json, just without offline caching

    // Uncomment this code when deploying to production with proper server configuration:
    /*
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("[PWA] Service Worker registered:", registration)
        })
        .catch((error) => {
          console.error("[PWA] Service Worker registration failed:", error)
        })
    }
    */

    console.log("[PWA] Service worker registration disabled in preview. Enable in production.")
  }, [])

  return null
}
