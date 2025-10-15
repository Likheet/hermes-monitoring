"use client"

import { ProtectedRoute } from "@/components/protected-route"
import { useTasks } from "@/lib/task-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, TrendingDown, TrendingUp, AlertTriangle, Star, Clock } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { generateWorkerPerformanceReport, generateDiscrepancyReport, type DateRange } from "@/lib/report-utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

function AdminReports() {
  const { tasks } = useTasks()
  const router = useRouter()
  const [dateRange, setDateRange] = useState<DateRange>("monthly")

  const performanceReport = generateWorkerPerformanceReport(tasks, dateRange)
  const discrepancyReport = generateDiscrepancyReport(tasks, dateRange)

  const getDiscrepancyColor = (percentage: number) => {
    if (percentage >= 50) return "text-red-500"
    if (percentage >= 30) return "text-orange-500"
    return "text-green-500"
  }

  const getDiscrepancyIcon = (percentage: number) => {
    if (percentage >= 50) return <TrendingDown className="h-4 w-4 text-red-500" />
    if (percentage >= 30) return <AlertTriangle className="h-4 w-4 text-orange-500" />
    return <TrendingUp className="h-4 w-4 text-green-500" />
  }

  const getRatingColor = (rating: number) => {
    if (rating >= 4) return "text-green-500"
    if (rating >= 3) return "text-yellow-500"
    return "text-red-500"
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.push("/admin")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Admin Reports</h1>
              <p className="text-sm text-muted-foreground">Worker performance and task analytics</p>
            </div>
          </div>
          <Select value={dateRange} onValueChange={(value) => setDateRange(value as DateRange)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Last 7 Days</SelectItem>
              <SelectItem value="monthly">Last 30 Days</SelectItem>
              <SelectItem value="all-time">All Time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="performance" className="space-y-6">
          <TabsList>
            <TabsTrigger value="performance">Worker Performance</TabsTrigger>
            <TabsTrigger value="discrepancy">Discrepancy Jobs</TabsTrigger>
          </TabsList>

          <TabsContent value="performance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Worker Performance Report</CardTitle>
                <CardDescription>Shift hours, actual work time, idle time, and performance metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Worker Name</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead className="text-right">Shift Hours</TableHead>
                        <TableHead className="text-right">Worked Hours</TableHead>
                        <TableHead className="text-right">Idle Hours</TableHead>
                        <TableHead className="text-right">Discrepancy</TableHead>
                        <TableHead className="text-right">Rating</TableHead>
                        <TableHead className="text-right">Tasks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {performanceReport.map((report) => (
                        <TableRow key={report.workerId}>
                          <TableCell className="font-medium">{report.workerName}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {report.department}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{report.shiftHours}h</TableCell>
                          <TableCell className="text-right">{report.actualWorkedHours}h</TableCell>
                          <TableCell className="text-right">{report.idleHours}h</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {getDiscrepancyIcon(report.discrepancyPercentage)}
                              <span className={getDiscrepancyColor(report.discrepancyPercentage)}>
                                {report.discrepancyPercentage}%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Star className={`h-4 w-4 ${getRatingColor(report.averageRating)}`} />
                              <span className={getRatingColor(report.averageRating)}>
                                {report.averageRating.toFixed(1)}
                              </span>
                              <span className="text-muted-foreground text-xs">({report.totalRatings})</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-col items-end">
                              <span className="text-sm">{report.tasksCompleted} completed</span>
                              {report.tasksRejected > 0 && (
                                <span className="text-xs text-red-500">{report.tasksRejected} rejected</span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {performanceReport.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-muted-foreground">
                            No data available for the selected period
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Avg Efficiency</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {performanceReport.length > 0
                      ? (
                          100 -
                          performanceReport.reduce((sum, r) => sum + r.discrepancyPercentage, 0) /
                            performanceReport.length
                        ).toFixed(1)
                      : 0}
                    %
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Across all workers</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Avg Rating</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold flex items-center gap-2">
                    <Star className="h-5 w-5 text-yellow-500" />
                    {performanceReport.length > 0
                      ? (
                          performanceReport.reduce((sum, r) => sum + r.averageRating, 0) / performanceReport.length
                        ).toFixed(1)
                      : 0}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Overall quality score</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {performanceReport.reduce((sum, r) => sum + r.tasksCompleted, 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {performanceReport.reduce((sum, r) => sum + r.tasksRejected, 0)} rejected
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="discrepancy" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Discrepancy Jobs Report</CardTitle>
                <CardDescription>Tasks with excessive time, low ratings, or rework required</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Task Type</TableHead>
                        <TableHead>Room</TableHead>
                        <TableHead>Worker</TableHead>
                        <TableHead className="text-right">Expected</TableHead>
                        <TableHead className="text-right">Actual</TableHead>
                        <TableHead className="text-right">Overtime</TableHead>
                        <TableHead className="text-right">Rating</TableHead>
                        <TableHead>Issues</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {discrepancyReport.map((job) => (
                        <TableRow key={job.taskId}>
                          <TableCell className="font-medium">{job.taskType}</TableCell>
                          <TableCell>{job.roomNumber}</TableCell>
                          <TableCell>{job.workerName}</TableCell>
                          <TableCell className="text-right">{job.expectedDuration}m</TableCell>
                          <TableCell className="text-right">{job.actualDuration}m</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {job.overtimePercentage > 50 && <AlertTriangle className="h-4 w-4 text-red-500" />}
                              <span
                                className={
                                  job.overtimePercentage > 50
                                    ? "text-red-500"
                                    : job.overtimePercentage > 20
                                      ? "text-orange-500"
                                      : "text-yellow-500"
                                }
                              >
                                +{job.overtimePercentage}%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {job.rating !== null ? (
                              <div className="flex items-center justify-end gap-1">
                                <Star className={`h-4 w-4 ${getRatingColor(job.rating)}`} />
                                <span className={getRatingColor(job.rating)}>{job.rating}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {job.isRework && (
                                <Badge variant="destructive" className="text-xs">
                                  Rework
                                </Badge>
                              )}
                              {job.rating !== null && job.rating < 3 && (
                                <Badge variant="outline" className="text-xs text-orange-500">
                                  Low Quality
                                </Badge>
                              )}
                              {job.overtimePercentage > 50 && (
                                <Badge variant="outline" className="text-xs text-red-500">
                                  Excessive Time
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {discrepancyReport.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-muted-foreground">
                            No discrepancy jobs found for the selected period
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Total Discrepancies</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{discrepancyReport.length}</div>
                  <p className="text-xs text-muted-foreground mt-1">Tasks requiring attention</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Rework Tasks</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{discrepancyReport.filter((j) => j.isRework).length}</div>
                  <p className="text-xs text-muted-foreground mt-1">Rejected and reassigned</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Avg Overtime</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold flex items-center gap-2">
                    <Clock className="h-5 w-5 text-orange-500" />
                    {discrepancyReport.length > 0
                      ? (
                          discrepancyReport.reduce((sum, j) => sum + j.overtimePercentage, 0) / discrepancyReport.length
                        ).toFixed(1)
                      : 0}
                    %
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Above expected time</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}

export default function AdminReportsPage() {
  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <AdminReports />
    </ProtectedRoute>
  )
}
