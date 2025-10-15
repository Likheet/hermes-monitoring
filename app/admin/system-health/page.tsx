"use client"

import { useState, useEffect } from "react"
import { ProtectedRoute } from "@/components/protected-route"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ArrowLeft, Database, HardDrive, Users, Activity, AlertTriangle, CheckCircle2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTasks } from "@/lib/task-context"
import { mockUsers } from "@/lib/mock-data"

function SystemHealthPage() {
  const router = useRouter()
  const { tasks } = useTasks()
  const [metrics, setMetrics] = useState({
    databaseSize: 0,
    storageUsed: 0,
    activeUsers: 0,
    totalTasks: 0,
    apiCalls: 0,
  })

  useEffect(() => {
    // Calculate metrics from mock data
    const activeUsers = new Set(tasks.map((t) => t.assigned_to_user_id)).size
    const totalTasks = tasks.length

    // Simulate metrics (in production, these would come from Supabase)
    setMetrics({
      databaseSize: 45, // MB
      storageUsed: 120, // MB
      activeUsers,
      totalTasks,
      apiCalls: 1250, // Last 24 hours
    })
  }, [tasks])

  const limits = {
    databaseSize: 500, // 500MB free tier
    storageSize: 1024, // 1GB free tier
    apiCalls: 50000, // Unlimited but tracking
  }

  const getUsagePercentage = (used: number, limit: number) => {
    return Math.round((used / limit) * 100)
  }

  const getUsageStatus = (percentage: number) => {
    if (percentage >= 90) return { color: "text-red-500", label: "Critical", icon: AlertTriangle }
    if (percentage >= 70) return { color: "text-orange-500", label: "Warning", icon: AlertTriangle }
    return { color: "text-green-500", label: "Healthy", icon: CheckCircle2 }
  }

  const dbUsage = getUsagePercentage(metrics.databaseSize, limits.databaseSize)
  const storageUsage = getUsagePercentage(metrics.storageUsed, limits.storageSize)
  const dbStatus = getUsageStatus(dbUsage)
  const storageStatus = getUsageStatus(storageUsage)

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background sticky top-0 z-40">
        <div className="container mx-auto flex items-center gap-4 px-4 py-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">System Health</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Database Size</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.databaseSize} MB</div>
              <p className="text-xs text-muted-foreground">of {limits.databaseSize} MB limit</p>
              <Progress value={dbUsage} className="mt-2" />
              <div className="flex items-center gap-2 mt-2">
                <dbStatus.icon className={`h-4 w-4 ${dbStatus.color}`} />
                <span className={`text-xs font-medium ${dbStatus.color}`}>{dbStatus.label}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Storage Used</CardTitle>
              <HardDrive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.storageUsed} MB</div>
              <p className="text-xs text-muted-foreground">of {limits.storageSize} MB limit</p>
              <Progress value={storageUsage} className="mt-2" />
              <div className="flex items-center gap-2 mt-2">
                <storageStatus.icon className={`h-4 w-4 ${storageStatus.color}`} />
                <span className={`text-xs font-medium ${storageStatus.color}`}>{storageStatus.label}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.activeUsers}</div>
              <p className="text-xs text-muted-foreground">Last 24 hours</p>
              <Badge variant="secondary" className="mt-2">
                {mockUsers.length} total users
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">API Calls</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.apiCalls.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Last 24 hours</p>
              <Badge variant="secondary" className="mt-2">
                Unlimited
              </Badge>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recommendations</CardTitle>
            <CardDescription>Actions to optimize system performance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {dbUsage > 70 && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-orange-50 border border-orange-200">
                <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-orange-900">Database approaching limit</p>
                  <p className="text-sm text-orange-700 mt-1">
                    Consider archiving old completed tasks (older than 6 months) to free up space.
                  </p>
                  <Button size="sm" variant="outline" className="mt-2 bg-transparent">
                    Archive Old Tasks
                  </Button>
                </div>
              </div>
            )}

            {storageUsage > 70 && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-orange-50 border border-orange-200">
                <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-orange-900">Storage approaching limit</p>
                  <p className="text-sm text-orange-700 mt-1">
                    Consider deleting old task photos or reducing image quality to save space.
                  </p>
                  <Button size="sm" variant="outline" className="mt-2 bg-transparent">
                    Clean Up Storage
                  </Button>
                </div>
              </div>
            )}

            {dbUsage < 70 && storageUsage < 70 && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-green-50 border border-green-200">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-green-900">System running smoothly</p>
                  <p className="text-sm text-green-700 mt-1">
                    All metrics are within healthy ranges. No action required.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Maintenance Tasks</CardTitle>
            <CardDescription>Scheduled cleanup and optimization</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <p className="font-medium">Archive old tasks</p>
                <p className="text-sm text-muted-foreground">Completed tasks older than 6 months</p>
              </div>
              <Badge variant="secondary">Monthly</Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <p className="font-medium">Delete old notifications</p>
                <p className="text-sm text-muted-foreground">Notifications older than 30 days</p>
              </div>
              <Badge variant="secondary">Daily</Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <p className="font-medium">Cleanup old metrics</p>
                <p className="text-sm text-muted-foreground">System metrics older than 30 days</p>
              </div>
              <Badge variant="secondary">Daily</Badge>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

export default function AdminSystemHealthPage() {
  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <SystemHealthPage />
    </ProtectedRoute>
  )
}
