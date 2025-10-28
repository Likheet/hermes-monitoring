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

const fallbackAuthContext: AuthContextType = {
  user: null,
  login: async () => {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[auth] AuthProvider is not mounted; login() ignored.")
    }
    return false
  },
  logout: async () => {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[auth] AuthProvider is not mounted; logout() ignored.")
    }
  },
  isAuthenticated: false,
  loading: false,
}

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
          }
        }
      } catch (error) {
        console.error("Session restore error:", error)
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
        return true
      }

      await response.json()
      return false
    } catch (error) {
      console.error("Login error:", error)
      return false
    }
  }

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
      setUser(null)
    } catch (error) {
      console.error("Logout error:", error)
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
    if (process.env.NODE_ENV !== "production") {
      console.warn("[auth] useAuth accessed outside of AuthProvider; returning fallback context.")
    }
    return fallbackAuthContext
  }
  return context
}
