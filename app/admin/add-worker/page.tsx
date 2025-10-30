"use client"

import type React from "react"

export const dynamic = "force-dynamic"

import { useState } from "react"
import { ProtectedRoute } from "@/components/protected-route"
import { useTasks } from "@/lib/task-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, UserPlus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import type { UserRole, Department } from "@/lib/types"

type NonAdminRole = Exclude<UserRole, "admin">
const DEFAULT_ROLE_DEPARTMENT: Record<NonAdminRole, Department> = {
  worker: "housekeeping",
  supervisor: "maintenance",
  front_office: "front_office",
}

function AddAccountForm(): JSX.Element {
  const router = useRouter()
  const { toast } = useToast()
  const { addWorker } = useTasks()

  const [formData, setFormData] = useState({
    username: "",
    password: "",
    role: "worker" as NonAdminRole,
    department: "housekeeping" as Department,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const username = formData.username.trim()
    const password = formData.password

    if (!username || !password) {
      toast({
        title: "Missing details",
        description: "Please enter both a username and password.",
        variant: "destructive",
      })
      return
    }

    if (password.length < 6) {
      toast({
        title: "Password too short",
        description: "Use at least 6 characters so the account is harder to guess.",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      const result = await addWorker({
        username,
        password,
        role: formData.role,
        department: formData.role === "worker" ? formData.department : undefined,
      })

      if (result.success) {
        toast({
          title: "Account created",
          description: `${username} can now sign in with the credentials provided.`,
        })
        router.push("/admin")
      } else {
        toast({
          title: "Could not create account",
          description: result.error ?? "Please try again.",
          variant: "destructive",
        })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="container mx-auto flex items-center gap-4 px-4 py-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/admin")}
            aria-label="Back to admin dashboard"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Add Team Member</h1>
            <p className="text-sm text-muted-foreground">
              Create worker, supervisor, or front office accounts with a username and password.
            </p>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-2xl px-4 py-6">
        <Card>
          <CardHeader>
            <CardTitle>Account Credentials</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, username: event.target.value }))
                  }
                  autoComplete="username"
                  placeholder="e.g. jdoe"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, password: event.target.value }))
                  }
                  autoComplete="new-password"
                  placeholder="Enter a temporary password"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) =>
                    setFormData((prev) => {
                      const nextRole = value as NonAdminRole
                      const isWorker = nextRole === "worker"
                      const nextDepartment = isWorker
                        ? (prev.department === "housekeeping" || prev.department === "maintenance"
                            ? prev.department
                            : "housekeeping")
                        : DEFAULT_ROLE_DEPARTMENT[nextRole]

                      return {
                        ...prev,
                        role: nextRole,
                        department: nextDepartment,
                      }
                    })
                  }
                >
                  <SelectTrigger id="role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="worker">Worker</SelectItem>
                    <SelectItem value="supervisor">Supervisor</SelectItem>
                    <SelectItem value="front_office">Front Office</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.role === "worker" && (
                <div className="space-y-2">
                  <Label htmlFor="department">Worker department</Label>
                  <Select
                    value={formData.department}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, department: value as Department }))
                    }
                  >
                    <SelectTrigger id="department">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="housekeeping">Housekeeping</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    This decides which task pool the worker joins by default.
                  </p>
                </div>
              )}

              <p className="text-sm text-muted-foreground">
                We fill in the rest of the profile with sensible defaults. You can fine-tune their
                department, contact info, or shifts later from the admin dashboard.
              </p>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/admin")}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={isSubmitting}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  {isSubmitting ? "Creating..." : "Create Account"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

export default function AddWorkerPage(): JSX.Element {
  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <AddAccountForm />
    </ProtectedRoute>
  )
}
