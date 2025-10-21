"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"

export default function HomePage() {
  const router = useRouter()
  const { isAuthenticated, user, loading } = useAuth()

  useEffect(() => {
    if (loading) {
      return
    }

    if (!isAuthenticated) {
      router.replace("/login")
    } else if (user) {
      // Redirect based on role
      switch (user.role) {
        case "worker":
          router.replace("/worker")
          break
        case "supervisor":
          router.replace("/supervisor")
          break
        case "front_office":
          router.replace("/front-office")
          break
        case "admin":
          router.replace("/admin")
          break
      }
    }
  }, [isAuthenticated, user, router, loading])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground">Redirecting...</p>
    </div>
  )
}
