"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import type { User } from "./types"

interface AuthContextType {
  user: User | null
  login: (username: string, password: string) => Promise<boolean>
  logout: () => Promise<void>
  isAuthenticated: boolean
  loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const response = await fetch("/api/auth/session")
        if (response.ok) {
          const { user } = await response.json()
          if (user) {
            setUser(user)
            console.log("[v0] Session restored:", user.name)
          }
        }
      } catch (error) {
        console.error("[v0] Session restore error:", error)
      } finally {
        setLoading(false)
      }
    }

    restoreSession()
  }, [])

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      })

      if (response.ok) {
        const { user } = await response.json()
        setUser(user)
        console.log("[v0] Login successful:", user.name, "Role:", user.role)
        return true
      } else {
        const { error } = await response.json()
        console.log("[v0] Login failed:", error)
        return false
      }
    } catch (error) {
      console.error("[v0] Login error:", error)
      return false
    }
  }

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
      console.log("[v0] User logged out:", user?.name)
      setUser(null)
    } catch (error) {
      console.error("[v0] Logout error:", error)
    }
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
