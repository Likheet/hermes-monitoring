import type React from "react"
import type { Metadata, Viewport } from "next"

import { Analytics } from "@vercel/analytics/next"
import { AuthProvider } from "@/lib/auth-context"
import { Toaster } from "@/components/ui/toaster"
import { Suspense } from "react"
import "./globals.css"
import { PWAInstallPrompt } from "@/components/pwa-install-prompt"
import { ErrorBoundary } from "@/components/error-boundary"
import { StorageCleaner } from "@/components/storage-cleaner"
import { LogSuppressor } from "@/components/log-suppressor"
import { PWARegister } from "@/components/pwa-register"
import { TaskProviderGate } from "@/components/task-provider-gate"

import { Geist, Geist_Mono, Source_Serif_4 } from "next/font/google"

// Initialize fonts
const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  weight: ["400", "500", "600", "700"],
})

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  weight: ["400", "500", "600", "700"],
})

const sourceSerif4 = Source_Serif_4({
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600", "700", "800", "900"],
})

export const metadata: Metadata = {
  title: "Resort Task Manager",
  description: "Task management system for resort operations",
  generator: "v0.app",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TaskManager",
  },
  formatDetection: {
    telephone: false,
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0ea5e9",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <head>
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className="font-sans antialiased">
        <ErrorBoundary>
          <Suspense fallback={null}>
            <StorageCleaner />
            <LogSuppressor />
            <PWARegister />
            <AuthProvider>
              <TaskProviderGate>{children}</TaskProviderGate>
              <Toaster />
              <PWAInstallPrompt />
            </AuthProvider>
          </Suspense>
        </ErrorBoundary>
        <Analytics />
      </body>
    </html>
  )
}
