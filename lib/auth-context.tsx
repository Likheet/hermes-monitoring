"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import type { User } from "./types"
import { useTasks } from "./task-context"

interface AuthContextType {
  user: User | null
  login: (userId: string) => void
  logout: () => void
  isAuthenticated: boolean
  loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

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

  const login = (userId: string) => {
    const foundUser = users.find((u) => u.id === userId)
    if (foundUser) {
      setUser(foundUser)
      localStorage.setItem("userId", userId)
      console.log("[v0] User logged in:", foundUser.name)
    }
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
