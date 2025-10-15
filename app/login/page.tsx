"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { useTasks } from "@/lib/task-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function LoginPage() {
  const [selectedUserId, setSelectedUserId] = useState("")
  const { login } = useAuth()
  const { users } = useTasks()
  const router = useRouter()

  const sortedUsers = [...users].sort((a, b) => {
    const order: Record<string, number> = {
      "user-admin": 1,
      "user-supervisor-housekeeping": 2,
      "user-supervisor-maintenance": 3,
      "user-frontoffice": 4,
      "user-worker-maintenance": 5,
      "user-worker-housekeeping": 6,
    }
    return (order[a.id] || 999) - (order[b.id] || 999)
  })

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedUserId) return

    login(selectedUserId)

    const user = users.find((u) => u.id === selectedUserId)

    // Redirect based on role
    if (user) {
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
        default:
          router.push("/")
      }
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Resort Task Manager</CardTitle>
          <CardDescription>Select a user to login (Development Mode)</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="user">Select User</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger id="user">
                  <SelectValue placeholder="Choose a user..." />
                </SelectTrigger>
                <SelectContent>
                  {sortedUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" disabled={!selectedUserId} className="w-full">
              Login
            </Button>

            <div className="mt-4 text-sm text-muted-foreground">
              <p className="font-semibold mb-2">Available Users:</p>
              <ul className="space-y-1 text-xs">
                {sortedUsers.map((user) => (
                  <li key={user.id}>
                    {user.name} - {user.department}
                  </li>
                ))}
              </ul>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
