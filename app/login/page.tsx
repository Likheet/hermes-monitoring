"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import {
  DEV_ACCOUNTS,
  DEV_LOGIN_GROUP_ORDER,
  type DevAccount,
  type DevLoginGroup,
} from "@/lib/dev-accounts"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
const groupedDevAccounts = groupDevAccounts(DEV_ACCOUNTS)

function groupDevAccounts(accounts: DevAccount[]) {
  const grouped = accounts.reduce((acc, account) => {
    const current = acc.get(account.group) ?? []
    current.push(account)
    acc.set(account.group, current)
    return acc
  }, new Map<DevLoginGroup, DevAccount[]>())

  return Array.from(grouped.entries())
    .map(([group, items]) => ({
      group,
      accounts: items.sort((a, b) => a.displayName.localeCompare(b.displayName)),
      order: (() => {
        const index = DEV_LOGIN_GROUP_ORDER.indexOf(group)
        return index === -1 ? DEV_LOGIN_GROUP_ORDER.length : index
      })(),
    }))
    .sort((a, b) => a.order - b.order)
    .map(({ order, ...rest }) => rest)
}

export default function LoginPage() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const { login } = useAuth()
  const router = useRouter()
  const enableDevLogin = process.env.NEXT_PUBLIC_DEVTEST_LOGIN === "true"

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
      console.error("Login error:", err)
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
      console.error("Quick login error:", err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-3xl">
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
              <div className="space-y-4 rounded-lg border border-muted bg-muted/30 p-4">
                <div className="flex items-center justify-between pb-2">
                  <div>
                    <p className="text-sm font-semibold">Quick Login</p>
                    <p className="text-xs text-muted-foreground">Tap any card to sign in</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {groupedDevAccounts.map(({ group, accounts }) => (
                    <div key={group} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wide text-foreground">
                          {group}
                        </span>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {accounts.length}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                        {accounts.map((account) => (
                          <Button
                            key={account.username}
                            type="button"
                            variant="outline"
                            disabled={isLoading}
                            onClick={() => handleQuickLogin(account.username, account.password, account.redirect)}
                            className="h-auto items-start justify-start gap-1 rounded-md border bg-card p-3 text-left transition-all hover:bg-accent hover:text-accent-foreground"
                          >
                            <div className="flex w-full flex-col gap-1">
                              <span className="text-sm font-semibold leading-tight">{account.displayName}</span>
                              <span className="text-xs text-muted-foreground">@{account.username}</span>
                            </div>
                          </Button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
