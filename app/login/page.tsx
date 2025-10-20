"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

export default function LoginPage() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const { login } = useAuth()
  const router = useRouter()
  const enableDevLogin = process.env.NEXT_PUBLIC_DEVTEST_LOGIN === "true"

  const devAccounts = [
    { label: "Admin", username: "admin", password: "admin123", redirect: "/admin" },
    { label: "Front Office", username: "frontdesk", password: "front123", redirect: "/front-office" },
    { label: "HK Supervisor", username: "hk-super", password: "super123", redirect: "/supervisor" },
    { label: "HK Worker", username: "hk-worker", password: "worker123", redirect: "/worker" },
    { label: "Maintenance Worker", username: "maint-worker", password: "worker123", redirect: "/maintenance" },
  ]

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      const success = await login(username, password)

      if (success) {
        router.push("/")
      } else {
        setError("Invalid username or password")
      }
    } catch (err) {
      setError("An error occurred during login. Please try again.")
      console.error("[v0] Login error:", err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleQuickLogin = async (username: string, password: string, redirect?: string) => {
    setError("")
    setIsLoading(true)

    try {
      const success = await login(username, password)

      if (success) {
        router.push(redirect || "/")
      } else {
        setError(`Quick login failed for ${username}`)
      }
    } catch (err) {
      setError("Quick login error. Please try again.")
      console.error("[v0] Quick login error:", err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Resort Task Manager</CardTitle>
          <CardDescription>Sign in to your account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            <Button type="submit" disabled={isLoading || !username || !password} className="w-full">
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>

            {enableDevLogin && (
              <div className="space-y-3 rounded-md border border-dashed border-muted-foreground/40 p-3 text-sm">
                <p className="font-semibold text-muted-foreground">Dev Test Quick Login</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {devAccounts.map((account) => (
                    <Button
                      key={account.username}
                      type="button"
                      variant="secondary"
                      disabled={isLoading}
                      onClick={() => handleQuickLogin(account.username, account.password, account.redirect)}
                    >
                      {account.label}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Disable by unsetting NEXT_PUBLIC_DEVTEST_LOGIN.</p>
              </div>
            )}

            <div className="mt-4 rounded-md bg-muted p-3 text-sm text-muted-foreground">
              <p className="font-semibold mb-2">Test Accounts:</p>
              <ul className="space-y-1 text-xs">
                <li>Admin: admin / admin123</li>
                <li>Front Office: frontdesk / front123</li>
                <li>HK Supervisor: hk-super / super123</li>
                <li>HK Worker: hk-worker / worker123</li>
                <li>Maintenance Worker: maint-worker / worker123</li>
              </ul>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
