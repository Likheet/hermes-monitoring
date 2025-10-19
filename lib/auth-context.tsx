"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import type { User } from "./types"
import { useTasks } from "./task-context"

interface AuthContextType {
  user: User | null
  login: (emailOrUserId: string, password?: string) => Promise<boolean>
  logout: () => void
  isAuthenticated: boolean
  loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const MOCK_CREDENTIALS: Record<string, { password: string; email: string }> = {
  "admin@resort.com": { password: "admin123", email: "admin@resort.com" },
  "frontdesk@resort.com": { password: "front123", email: "frontdesk@resort.com" },
  "hk-supervisor@resort.com": { password: "super123", email: "hk-supervisor@resort.com" },
  "maint-supervisor@resort.com": { password: "super123", email: "maint-supervisor@resort.com" },
  "hk-worker@resort.com": { password: "worker123", email: "hk-worker@resort.com" },
  "maint-worker@resort.com": { password: "worker123", email: "maint-worker@resort.com" },
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const { users } = useTasks()

  useEffect(() => {
    const storedUserId = localStorage.getItem("userId")
    if (storedUserId) {
      const foundUser = users.find((u) => u.id === storedUserId)
      if (foundUser) {
        setUser(foundUser)
        console.log("[v0] User restored from localStorage:", foundUser.name)
      }
    }
    setLoading(false)
  }, [users])

  const login = async (emailOrUserId: string, password?: string): Promise<boolean> => {
    // If password is provided, authenticate with email/password
    if (password) {
      const credentials = MOCK_CREDENTIALS[emailOrUserId.toLowerCase()]

      if (!credentials || credentials.password !== password) {
        console.log("[v0] Invalid credentials for:", emailOrUserId)
        return false
      }

      // Find user by matching role and department based on email
      let foundUser: User | undefined

      if (emailOrUserId.includes("admin")) {
        foundUser = users.find((u) => u.role === "admin")
      } else if (emailOrUserId.includes("frontdesk")) {
        foundUser = users.find((u) => u.role === "front_office")
      } else if (emailOrUserId.includes("hk-supervisor")) {
        foundUser = users.find((u) => u.role === "supervisor" && u.department === "housekeeping")
      } else if (emailOrUserId.includes("maint-supervisor")) {
        foundUser = users.find((u) => u.role === "supervisor" && u.department === "maintenance")
      } else if (emailOrUserId.includes("hk-worker")) {
        foundUser = users.find((u) => u.role === "worker" && u.department === "housekeeping")
      } else if (emailOrUserId.includes("maint-worker")) {
        foundUser = users.find((u) => u.role === "worker" && u.department === "maintenance")
      }

      if (foundUser) {
        setUser(foundUser)
        localStorage.setItem("userId", foundUser.id)
        console.log("[v0] User logged in via email/password:", foundUser.name)
        return true
      }

      return false
    }

    // Legacy: Direct userId login (for backward compatibility)
    const foundUser = users.find((u) => u.id === emailOrUserId)
    if (foundUser) {
      setUser(foundUser)
      localStorage.setItem("userId", emailOrUserId)
      console.log("[v0] User logged in:", foundUser.name)
      return true
    }

    return false
  }

  const logout = () => {
    console.log("[v0] User logged out:", user?.name)
    setUser(null)
    localStorage.removeItem("userId")
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
