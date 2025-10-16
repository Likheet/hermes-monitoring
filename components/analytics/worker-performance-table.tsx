"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { WorkerPerformance } from "@/lib/analytics-utils"
import { useMobile } from "@/hooks/use-mobile"

interface WorkerPerformanceTableProps {
  workers: WorkerPerformance[]
}

export function WorkerPerformanceTable({ workers }: WorkerPerformanceTableProps) {
  const isMobile = useMobile()

  const getPerformanceBadge = (onTimeRate: number) => {
    if (onTimeRate >= 90) return <Badge className="bg-green-500 text-white text-xs">Excellent</Badge>
    if (onTimeRate >= 75) return <Badge className="bg-blue-500 text-white text-xs">Good</Badge>
    if (onTimeRate >= 60) return <Badge className="bg-orange-500 text-white text-xs">Fair</Badge>
    return <Badge className="bg-red-500 text-white text-xs">Needs Improvement</Badge>
  }

  if (isMobile) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Worker Performance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {workers.map((worker) => (
            <Card key={worker.workerId} className="p-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-base">{worker.workerName}</span>
                  {getPerformanceBadge(worker.onTimeRate)}
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Tasks:</span>
                    <span className="ml-1 font-medium">{worker.totalTasks}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Completed:</span>
                    <span className="ml-1 font-medium">{worker.completedTasks}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Avg Time:</span>
                    <span className="ml-1 font-medium">{worker.avgCompletionTime}m</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">On-Time:</span>
                    <span className="ml-1 font-medium">{worker.onTimeRate}%</span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Worker Performance</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto -mx-6 px-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[150px]">Worker</TableHead>
                <TableHead className="text-right min-w-[80px]">Tasks</TableHead>
                <TableHead className="text-right min-w-[100px]">Completed</TableHead>
                <TableHead className="text-right min-w-[100px]">Avg Time</TableHead>
                <TableHead className="text-right min-w-[120px]">On-Time Rate</TableHead>
                <TableHead className="text-right min-w-[140px]">Performance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workers.map((worker) => (
                <TableRow key={worker.workerId}>
                  <TableCell className="font-medium">{worker.workerName}</TableCell>
                  <TableCell className="text-right">{worker.totalTasks}</TableCell>
                  <TableCell className="text-right">{worker.completedTasks}</TableCell>
                  <TableCell className="text-right">{worker.avgCompletionTime}m</TableCell>
                  <TableCell className="text-right">{worker.onTimeRate}%</TableCell>
                  <TableCell className="text-right">{getPerformanceBadge(worker.onTimeRate)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
