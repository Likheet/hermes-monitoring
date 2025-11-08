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
  const { isAuthenticated, user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) {
      return
    }

    if (!isAuthenticated) {
      router.replace("/login")
      return
    }

    if (user && !allowedRoles.includes(user.role)) {
      const isAdminAccessingNonWorkerRoute = user.role === "admin" && !allowedRoles.includes("worker")

      if (!isAdminAccessingNonWorkerRoute) {
        // Redirect to appropriate dashboard if wrong role
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
          case "manager":
            router.replace("/manager")
            break
          case "admin":
            router.replace("/admin")
            break
        }
      }
    }
  }, [isAuthenticated, user, allowedRoles, router, loading])

  const isAdminAccessingNonWorkerRoute = user?.role === "admin" && !allowedRoles.includes("worker")
  const hasAccess = user && (allowedRoles.includes(user.role) || isAdminAccessingNonWorkerRoute)

  if (loading || !isAuthenticated || !hasAccess) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  return <>{children}</>
}
