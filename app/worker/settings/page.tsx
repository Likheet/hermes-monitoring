"use client"

import { useState, useEffect } from "react"
import { ProtectedRoute } from "@/components/protected-route"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Moon, Sun, Bell, Volume2, Smartphone, LogOut, Clock } from "lucide-react"
import { useRouter } from "next/navigation"
import { BottomNav } from "@/components/mobile/bottom-nav"
import { useToast } from "@/hooks/use-toast"

interface UserPreferences {
  theme: "light" | "dark" | "system"
  notifications_enabled: boolean
  sound_enabled: boolean
  haptic_enabled: boolean
  auto_logout_minutes: number
}

function SettingsPage() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const { toast } = useToast()

  const [preferences, setPreferences] = useState<UserPreferences>({
    theme: "system",
    notifications_enabled: true,
    sound_enabled: true,
    haptic_enabled: true,
    auto_logout_minutes: 480,
  })

  useEffect(() => {
    // Load preferences from localStorage for now (will use database later)
    const saved = localStorage.getItem("user-preferences")
    if (saved) {
      setPreferences(JSON.parse(saved))
    }

    // Apply theme
    applyTheme(preferences.theme)
  }, [])

  const applyTheme = (theme: "light" | "dark" | "system") => {
    const root = document.documentElement
    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
      root.classList.toggle("dark", systemTheme === "dark")
    } else {
      root.classList.toggle("dark", theme === "dark")
    }
  }

  const updatePreference = <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
    const updated = { ...preferences, [key]: value }
    setPreferences(updated)
    localStorage.setItem("user-preferences", JSON.stringify(updated))

    if (key === "theme") {
      applyTheme(value as "light" | "dark" | "system")
    }

    if (key === "sound_enabled") {
      localStorage.setItem("notifications-muted", value ? "false" : "true")
    }

    toast({
      title: "Settings updated",
      description: "Your preferences have been saved",
    })
  }

  const handleLogout = () => {
    logout()
    router.push("/login")
  }

  return (
    <div className="min-h-screen bg-muted/30 pb-20 md:pb-0">
      <header className="border-b bg-background sticky top-0 z-40">
        <div className="container mx-auto flex items-center gap-4 px-4 py-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="min-h-[44px] min-w-[44px]">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl md:text-2xl font-bold">Settings</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Customize how the app looks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {preferences.theme === "dark" ? (
                  <Moon className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <Sun className="h-5 w-5 text-muted-foreground" />
                )}
                <div>
                  <Label>Theme</Label>
                  <p className="text-sm text-muted-foreground">Choose your preferred theme</p>
                </div>
              </div>
              <Select value={preferences.theme} onValueChange={(value: any) => updatePreference("theme", value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>Manage notification preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Label>Push Notifications</Label>
                  <p className="text-sm text-muted-foreground">Receive task updates</p>
                </div>
              </div>
              <Switch
                checked={preferences.notifications_enabled}
                onCheckedChange={(checked) => updatePreference("notifications_enabled", checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Volume2 className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Label>Sound</Label>
                  <p className="text-sm text-muted-foreground">Play notification sounds</p>
                </div>
              </div>
              <Switch
                checked={preferences.sound_enabled}
                onCheckedChange={(checked) => updatePreference("sound_enabled", checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Smartphone className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Label>Haptic Feedback</Label>
                  <p className="text-sm text-muted-foreground">Vibrate on interactions</p>
                </div>
              </div>
              <Switch
                checked={preferences.haptic_enabled}
                onCheckedChange={(checked) => updatePreference("haptic_enabled", checked)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Security</CardTitle>
            <CardDescription>Manage security settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Label>Auto Logout</Label>
                  <p className="text-sm text-muted-foreground">Logout after inactivity</p>
                </div>
              </div>
              <Select
                value={preferences.auto_logout_minutes.toString()}
                onValueChange={(value) => updatePreference("auto_logout_minutes", Number.parseInt(value))}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 min</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="240">4 hours</SelectItem>
                  <SelectItem value="480">8 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Manage your account</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" className="w-full" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </CardContent>
        </Card>

        <div className="text-center text-sm text-muted-foreground">
          <p>Version 1.0.0</p>
          <p className="mt-1">© 2025 Resort Task Manager</p>
        </div>
      </main>

      <div className="md:hidden">
        <BottomNav />
      </div>
    </div>
  )
}

export default function WorkerSettingsPage() {
  return (
    <ProtectedRoute allowedRoles={["worker"]}>
      <SettingsPage />
    </ProtectedRoute>
  )
}
