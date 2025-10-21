"use client"

import { useState, useEffect } from "react"
import { ChevronRight, ChevronDown, CheckCircle, Clock, Circle, Search, Calendar } from "lucide-react"
import { ALL_ROOMS } from "@/lib/location-data"
import type { MaintenanceTask } from "@/lib/maintenance-types"
import { useTasks } from "@/lib/task-context"
import { Input } from "@/components/ui/input"

interface MaintenanceCalendarProps {
  onRoomClick: (roomNumber: string, tasks: MaintenanceTask[]) => void
  searchQuery?: string
  onSearchChange?: (query: string) => void
}

export function MaintenanceCalendar({ onRoomClick, searchQuery = "", onSearchChange }: MaintenanceCalendarProps) {
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set())
  const [expandedFloors, setExpandedFloors] = useState<Set<string>>(new Set())
  const { maintenanceTasks } = useTasks()
  const [currentMonth] = useState(new Date().getMonth() + 1)
  const [currentYear] = useState(new Date().getFullYear())

  useEffect(() => {
  }, [maintenanceTasks])

  if (maintenanceTasks.length === 0) {
    return (
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search room number..."
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="pl-10 h-12 text-lg"
            disabled
          />
        </div>

        <div className="bg-card border-2 border-border rounded-xl p-12 text-center">
          <Calendar className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-bold text-foreground mb-2">No Maintenance Scheduled</h3>
          <p className="text-muted-foreground">
            There are no active maintenance schedules. Contact your administrator to create a maintenance schedule.
          </p>
        </div>
      </div>
    )
  }

  const toggleBlock = (block: string) => {
    const newExpanded = new Set(expandedBlocks)
    if (newExpanded.has(block)) {
      newExpanded.delete(block)
    } else {
      newExpanded.add(block)
    }
    setExpandedBlocks(newExpanded)
  }

  const toggleFloor = (blockFloor: string) => {
    const newExpanded = new Set(expandedFloors)
    if (newExpanded.has(blockFloor)) {
      newExpanded.delete(blockFloor)
    } else {
      newExpanded.add(blockFloor)
    }
    setExpandedFloors(newExpanded)
  }

  const getRoomTasks = (roomNumber: string): MaintenanceTask[] => {
    return maintenanceTasks.filter((t) => t.room_number === roomNumber)
  }

  const getRoomStatus = (roomNumber: string): "completed" | "in_progress" | "pending" => {
    const roomTasks = getRoomTasks(roomNumber)
    if (roomTasks.length === 0) return "pending"

    const completed = roomTasks.filter((t) => t.status === "completed").length
    if (completed === roomTasks.length) return "completed"
    if (completed > 0) return "in_progress"
    return "pending"
  }

  const filteredRooms = ALL_ROOMS.filter((room) => room.number.includes(searchQuery))

  const aBlockRooms = filteredRooms.filter((r) => r.block === "A")
  const bBlockRooms = filteredRooms.filter((r) => r.block === "B")

  const aBlockByFloor = Object.groupBy(aBlockRooms, (r) => r.floor.toString())
  const bBlockByFloor = Object.groupBy(bBlockRooms, (r) => r.floor.toString())

  const getBlockStats = (block: "A" | "B") => {
    const blockRooms = block === "A" ? aBlockRooms : bBlockRooms
    const completed = blockRooms.filter((r) => getRoomStatus(r.number) === "completed").length
    return { completed, total: blockRooms.length }
  }

  const aStats = getBlockStats("A")
  const bStats = getBlockStats("B")

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search room number..."
          value={searchQuery}
          onChange={(e) => onSearchChange?.(e.target.value)}
          className="pl-10 h-12 text-lg"
        />
      </div>

      {/* Month Header */}
      <div className="bg-card border-2 border-border rounded-xl p-6">
        <h2 className="text-2xl font-bold text-foreground mb-2">
          {new Date(currentYear, currentMonth - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })}{" "}
          Maintenance
        </h2>
        <p className="text-muted-foreground">
          {aStats.completed + bStats.completed} / {aStats.total + bStats.total} rooms completed
        </p>
      </div>

      {/* A Block */}
      <div className="bg-card border-2 border-border rounded-xl overflow-hidden">
        <button
          onClick={() => toggleBlock("A")}
          className="w-full flex items-center justify-between p-5 hover:bg-muted transition-colors"
        >
          <div className="flex items-center gap-3">
            {expandedBlocks.has("A") ? (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            )}
            <h3 className="text-lg font-bold text-foreground">A Block</h3>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {aStats.completed}/{aStats.total} completed
            </span>
            <div className="w-32 bg-muted rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${(aStats.completed / aStats.total) * 100}%` }}
              />
            </div>
          </div>
        </button>

        {expandedBlocks.has("A") && (
          <div className="border-t-2 border-border">
            {Object.entries(aBlockByFloor).map(([floor, rooms]) => {
              const floorKey = `A-${floor}`
              const floorCompleted = rooms?.filter((r) => getRoomStatus(r.number) === "completed").length || 0
              const floorTotal = rooms?.length || 0

              return (
                <div key={floorKey} className="border-b-2 border-border last:border-b-0">
                  <button
                    onClick={() => toggleFloor(floorKey)}
                    className="w-full flex items-center justify-between p-4 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {expandedFloors.has(floorKey) ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      )}
                      <span className="font-semibold text-foreground">Floor {floor}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {floorCompleted}/{floorTotal}
                    </span>
                  </button>

                  {expandedFloors.has(floorKey) && rooms && (
                    <div className="bg-muted/30 p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                      {rooms.map((room) => {
                        const status = getRoomStatus(room.number)
                        const roomTasks = getRoomTasks(room.number)
                        const completedCount = roomTasks.filter((t) => t.status === "completed").length

                        return (
                          <button
                            key={room.number}
                            onClick={() => onRoomClick(room.number, roomTasks)}
                            className={`p-4 rounded-lg border-2 transition-all hover:shadow-md ${
                              status === "completed"
                                ? "bg-primary/10 border-primary"
                                : status === "in_progress"
                                  ? "bg-accent border-accent-foreground"
                                  : "bg-card border-border hover:border-muted-foreground"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-bold text-foreground">{room.number}</span>
                              {status === "completed" ? (
                                <CheckCircle className="w-5 h-5 text-primary" />
                              ) : status === "in_progress" ? (
                                <Clock className="w-5 h-5 text-accent-foreground" />
                              ) : (
                                <Circle className="w-5 h-5 text-muted-foreground" />
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">{completedCount}/4 tasks</div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* B Block - Same structure */}
      <div className="bg-card border-2 border-border rounded-xl overflow-hidden">
        <button
          onClick={() => toggleBlock("B")}
          className="w-full flex items-center justify-between p-5 hover:bg-muted transition-colors"
        >
          <div className="flex items-center gap-3">
            {expandedBlocks.has("B") ? (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            )}
            <h3 className="text-lg font-bold text-foreground">B Block</h3>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {bStats.completed}/{bStats.total} completed
            </span>
            <div className="w-32 bg-muted rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${(bStats.completed / bStats.total) * 100}%` }}
              />
            </div>
          </div>
        </button>

        {expandedBlocks.has("B") && (
          <div className="border-t-2 border-border">
            {Object.entries(bBlockByFloor).map(([floor, rooms]) => {
              const floorKey = `B-${floor}`
              const floorCompleted = rooms?.filter((r) => getRoomStatus(r.number) === "completed").length || 0
              const floorTotal = rooms?.length || 0

              return (
                <div key={floorKey} className="border-b-2 border-border last:border-b-0">
                  <button
                    onClick={() => toggleFloor(floorKey)}
                    className="w-full flex items-center justify-between p-4 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {expandedFloors.has(floorKey) ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      )}
                      <span className="font-semibold text-foreground">Floor {floor}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {floorCompleted}/{floorTotal}
                    </span>
                  </button>

                  {expandedFloors.has(floorKey) && rooms && (
                    <div className="bg-muted/30 p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                      {rooms.map((room) => {
                        const status = getRoomStatus(room.number)
                        const roomTasks = getRoomTasks(room.number)
                        const completedCount = roomTasks.filter((t) => t.status === "completed").length

                        return (
                          <button
                            key={room.number}
                            onClick={() => onRoomClick(room.number, roomTasks)}
                            className={`p-4 rounded-lg border-2 transition-all hover:shadow-md ${
                              status === "completed"
                                ? "bg-primary/10 border-primary"
                                : status === "in_progress"
                                  ? "bg-accent border-accent-foreground"
                                  : "bg-card border-border hover:border-muted-foreground"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-bold text-foreground">{room.number}</span>
                              {status === "completed" ? (
                                <CheckCircle className="w-5 h-5 text-primary" />
                              ) : status === "in_progress" ? (
                                <Clock className="w-5 h-5 text-accent-foreground" />
                              ) : (
                                <Circle className="w-5 h-5 text-muted-foreground" />
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">{completedCount}/4 tasks</div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
