"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { WorkerPerformance } from "@/lib/analytics-utils"

interface WorkerPerformanceTableProps {
  workers: WorkerPerformance[]
}

export function WorkerPerformanceTable({ workers }: WorkerPerformanceTableProps) {
  const getPerformanceBadge = (onTimeRate: number) => {
    if (onTimeRate >= 90) return <Badge className="bg-green-500 text-white">Excellent</Badge>
    if (onTimeRate >= 75) return <Badge className="bg-blue-500 text-white">Good</Badge>
    if (onTimeRate >= 60) return <Badge className="bg-orange-500 text-white">Fair</Badge>
    return <Badge className="bg-red-500 text-white">Needs Improvement</Badge>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Worker Performance</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Worker</TableHead>
              <TableHead className="text-right">Tasks</TableHead>
              <TableHead className="text-right">Completed</TableHead>
              <TableHead className="text-right">Avg Time</TableHead>
              <TableHead className="text-right">On-Time Rate</TableHead>
              <TableHead className="text-right">Performance</TableHead>
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
      </CardContent>
    </Card>
  )
}
