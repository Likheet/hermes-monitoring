"use client"

import type React from "react"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import type { UserRole } from "@/lib/types"

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles: UserRole[]
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login")
    } else if (user && !allowedRoles.includes(user.role)) {
      const isAdminAccessingNonWorkerRoute = user.role === "admin" && !allowedRoles.includes("worker")

      if (!isAdminAccessingNonWorkerRoute) {
        // Redirect to appropriate dashboard if wrong role
        switch (user.role) {
          case "worker":
            router.push("/worker")
            break
          case "supervisor":
            router.push("/supervisor")
            break
          case "front_office":
            router.push("/front-office")
            break
          case "admin":
            router.push("/admin")
            break
        }
      }
    }
  }, [isAuthenticated, user, allowedRoles, router])

  const isAdminAccessingNonWorkerRoute = user?.role === "admin" && !allowedRoles.includes("worker")
  const hasAccess = user && (allowedRoles.includes(user.role) || isAdminAccessingNonWorkerRoute)

  if (!isAuthenticated || !hasAccess) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  return <>{children}</>
}
