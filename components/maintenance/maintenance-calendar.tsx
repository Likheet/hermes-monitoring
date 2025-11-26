"use client"

import { useState, useMemo } from "react"
import { ChevronRight, ChevronDown, CheckCircle, Clock, Circle, Search, Calendar, Filter, Timer, Building2, Sparkles, ArrowUpCircle } from "lucide-react"
import { ALL_ROOMS } from "@/lib/location-data"
import type { MaintenanceTask, MaintenanceSchedule, ScheduleFrequency } from "@/lib/maintenance-types"
import { TASK_TYPE_LABELS, FREQUENCY_LABELS } from "@/lib/maintenance-types"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface MaintenanceCalendarProps {
    onRoomClick: (roomNumber: string, tasks: MaintenanceTask[]) => void
    searchQuery?: string
    onSearchChange?: (query: string) => void
    tasks: MaintenanceTask[]
    schedules?: MaintenanceSchedule[]
}

// Calculate deadline based on frequency
function getDeadlineInfo(frequency: ScheduleFrequency): { deadline: Date; label: string } {
    const now = new Date()

    switch (frequency) {
        case "daily":
            // End of today
            const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
            return { deadline: endOfDay, label: "Today" }

        case "weekly":
            // End of current week (Sunday)
            const endOfWeek = new Date(now)
            endOfWeek.setDate(now.getDate() + (7 - now.getDay()))
            endOfWeek.setHours(23, 59, 59)
            return { deadline: endOfWeek, label: "This Week" }

        case "biweekly":
            // 2 weeks from start of current period
            const biweeklyEnd = new Date(now)
            biweeklyEnd.setDate(now.getDate() + (14 - (now.getDate() % 14)))
            biweeklyEnd.setHours(23, 59, 59)
            return { deadline: biweeklyEnd, label: "2 Weeks" }

        case "monthly":
            // End of current month
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
            return { deadline: endOfMonth, label: "This Month" }

        case "quarterly":
            // End of current quarter
            const currentQuarter = Math.floor(now.getMonth() / 3)
            const endOfQuarter = new Date(now.getFullYear(), (currentQuarter + 1) * 3, 0, 23, 59, 59)
            return { deadline: endOfQuarter, label: "This Quarter" }

        case "semiannual":
            // End of current 6-month period
            const currentHalf = now.getMonth() < 6 ? 0 : 1
            const endOfHalf = new Date(now.getFullYear(), (currentHalf + 1) * 6, 0, 23, 59, 59)
            return { deadline: endOfHalf, label: "6 Months" }

        case "annual":
            // End of current year
            const endOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59)
            return { deadline: endOfYear, label: "This Year" }

        default:
            // Default to end of month
            const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
            return { deadline: defaultEnd, label: "This Month" }
    }
}

function getTimeRemaining(deadline: Date): { text: string; urgency: "normal" | "warning" | "critical" } {
    const now = new Date()
    const diffMs = deadline.getTime() - now.getTime()

    if (diffMs <= 0) {
        return { text: "Overdue!", urgency: "critical" }
    }

    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))

    if (diffDays === 0) {
        if (diffHours <= 2) {
            return { text: `${diffHours}h left`, urgency: "critical" }
        }
        return { text: `${diffHours}h left`, urgency: "warning" }
    }

    if (diffDays <= 2) {
        return { text: `${diffDays}d ${diffHours}h left`, urgency: "warning" }
    }

    if (diffDays <= 7) {
        return { text: `${diffDays} days left`, urgency: "normal" }
    }

    return { text: `${diffDays} days left`, urgency: "normal" }
}

export function MaintenanceCalendar({ onRoomClick, searchQuery = "", onSearchChange, tasks: maintenanceTasks, schedules = [] }: MaintenanceCalendarProps) {
    const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set())
    const [expandedFloors, setExpandedFloors] = useState<Set<string>>(new Set())
    const [selectedFrequency, setSelectedFrequency] = useState<ScheduleFrequency | "all">("all")
    const [currentMonth] = useState(new Date().getMonth() + 1)
    const [currentYear] = useState(new Date().getFullYear())

    // Get schedule info by schedule_id
    const scheduleMap = useMemo(() => {
        const map = new Map<string, MaintenanceSchedule>()
        schedules.forEach(s => map.set(s.id, s))
        return map
    }, [schedules])

    // Get unique frequencies from available schedules
    const availableFrequencies = useMemo(() => {
        const freqSet = new Set<ScheduleFrequency>()
        schedules.forEach(s => {
            if (s.frequency) freqSet.add(s.frequency)
        })
        return Array.from(freqSet)
    }, [schedules])

    // Filter tasks by selected frequency
    const filteredByFrequency = useMemo(() => {
        if (!maintenanceTasks || maintenanceTasks.length === 0) return []
        if (selectedFrequency === "all") return maintenanceTasks

        return maintenanceTasks.filter(task => {
            const schedule = scheduleMap.get(task.schedule_id)
            return schedule?.frequency === selectedFrequency
        })
    }, [maintenanceTasks, selectedFrequency, scheduleMap])

    // Group tasks by task type for deadline display
    const taskTypeDeadlines = useMemo(() => {
        const typeMap = new Map<string, { taskType: string; frequency: ScheduleFrequency; completed: number; total: number }>()

        filteredByFrequency.forEach(task => {
            const schedule = scheduleMap.get(task.schedule_id)
            if (!schedule) return

            const key = `${task.task_type}-${schedule.frequency}`
            const existing = typeMap.get(key)

            if (existing) {
                existing.total++
                if (task.status === "completed") existing.completed++
            } else {
                typeMap.set(key, {
                    taskType: task.task_type,
                    frequency: schedule.frequency,
                    completed: task.status === "completed" ? 1 : 0,
                    total: 1
                })
            }
        })

        return Array.from(typeMap.values())
    }, [filteredByFrequency, scheduleMap])

    // Separate lift tasks from room tasks
    const liftTasks = useMemo(() => {
        // Include lift tasks that have lift_id OR are of type "lift" (for backward compatibility)
        return filteredByFrequency.filter(t => t.task_type === "lift")
    }, [filteredByFrequency])

    const roomTasks = useMemo(() => {
        return filteredByFrequency.filter(t => t.task_type !== "lift" && t.room_number)
    }, [filteredByFrequency])

    // Get only rooms that have actual tasks scheduled (after frequency filter)
    const roomsWithTasks = useMemo(() => {
        if (!roomTasks || roomTasks.length === 0) return new Set<string>()
        return new Set(roomTasks.map(t => t.room_number).filter((r): r is string => !!r))
    }, [roomTasks])

    // Filter ALL_ROOMS to only include rooms that have tasks
    const scheduledRooms = useMemo(() => {
        if (roomsWithTasks.size === 0) return []
        return ALL_ROOMS.filter(room => roomsWithTasks.has(room.number))
    }, [roomsWithTasks])

    // Check if we have any tasks at all (room or lift)
    const hasAnyTasks = roomTasks.length > 0 || liftTasks.length > 0

    // Show empty state if no tasks exist
    if (!maintenanceTasks || maintenanceTasks.length === 0 || !hasAnyTasks) {
        return (
            <div className="space-y-6 animate-in fade-in duration-500">
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 transition-colors group-focus-within:text-black" />
                    <Input
                        type="text"
                        placeholder="Search room number..."
                        value={searchQuery}
                        onChange={(e) => onSearchChange?.(e.target.value)}
                        className="pl-12 h-12 text-base rounded-xl border-none bg-white shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] transition-all focus:shadow-md"
                        disabled
                    />
                </div>

                <div className="bg-white border-none rounded-xl p-12 text-center shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)]">
                    <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-6">
                        <Calendar className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-xl font-bold text-black mb-2">No Maintenance Scheduled</h3>
                    <p className="text-gray-500 max-w-sm mx-auto">
                        There are no active maintenance schedules for this month.
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
        if (!roomTasks || roomTasks.length === 0) return []
        return roomTasks.filter((t) => t.room_number === roomNumber)
    }

    const getRoomStatus = (roomNumber: string): "completed" | "in_progress" | "pending" => {
        const roomTasks = getRoomTasks(roomNumber)
        if (roomTasks.length === 0) return "pending"

        const completed = roomTasks.filter((t) => t.status === "completed").length
        if (completed === roomTasks.length) return "completed"
        if (completed > 0) return "in_progress"
        return "pending"
    }

    // Filter only rooms that have scheduled tasks AND match search query
    const filteredRooms = scheduledRooms.filter((room) => room.number.includes(searchQuery))

    const aBlockRooms = filteredRooms.filter((r) => r.block === "A")
    const bBlockRooms = filteredRooms.filter((r) => r.block === "B")

    const aBlockByFloor = Object.groupBy(aBlockRooms, (r) => r.floor.toString())
    const bBlockByFloor = Object.groupBy(bBlockRooms, (r) => r.floor.toString())

    const getBlockStats = (block: "A" | "B") => {
        const blockRooms = block === "A" ? aBlockRooms : bBlockRooms
        if (blockRooms.length === 0) return { completed: 0, total: 0 }
        const completed = blockRooms.filter((r) => getRoomStatus(r.number) === "completed").length
        return { completed, total: blockRooms.length }
    }

    const aStats = getBlockStats("A")
    const bStats = getBlockStats("B")

    // Don't show blocks that have no scheduled rooms
    const showABlock = aBlockRooms.length > 0
    const showBBlock = bBlockRooms.length > 0

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Search and Filter Row */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 transition-colors group-focus-within:text-black" />
                    <Input
                        type="text"
                        placeholder="Search room number..."
                        value={searchQuery}
                        onChange={(e) => onSearchChange?.(e.target.value)}
                        className="pl-12 h-12 text-base rounded-xl border-none bg-white shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] transition-all focus:shadow-md"
                    />
                </div>

                {/* Frequency Filter */}
                {availableFrequencies.length > 0 && (
                    <div className="flex items-center gap-2 bg-white rounded-xl px-4 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] hover:shadow-md transition-shadow">
                        <Filter className="w-5 h-5 text-gray-400 shrink-0" />
                        <select
                            value={selectedFrequency}
                            onChange={(e) => setSelectedFrequency(e.target.value as ScheduleFrequency | "all")}
                            className="h-12 bg-transparent text-black focus:outline-none min-w-[130px] cursor-pointer font-medium text-sm"
                        >
                            <option value="all">All Frequencies</option>
                            {availableFrequencies.map((freq) => (
                                <option key={freq} value={freq}>
                                    {FREQUENCY_LABELS[freq]}
                                </option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            {/* Task Type Deadlines */}
            {taskTypeDeadlines.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {taskTypeDeadlines.map(({ taskType, frequency, completed, total }) => {
                        const { deadline } = getDeadlineInfo(frequency)
                        const { text: timeLeft, urgency } = getTimeRemaining(deadline)
                        const isComplete = completed === total
                        const progressPercent = total > 0 ? (completed / total) * 100 : 0

                        return (
                            <div
                                key={`${taskType}-${frequency}`}
                                className="bg-white rounded-xl p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] transition-all duration-200 hover:shadow-md"
                            >
                                <div className="flex items-start justify-between gap-3 mb-4">
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-black truncate text-base">
                                            {TASK_TYPE_LABELS[taskType as keyof typeof TASK_TYPE_LABELS] || taskType}
                                        </h4>
                                        <p className="text-xs text-gray-500 mt-0.5 uppercase tracking-wide font-medium">
                                            {FREQUENCY_LABELS[frequency]}
                                        </p>
                                    </div>
                                    <div className="shrink-0">
                                        {isComplete ? (
                                            <Badge className="bg-black text-white border-0 gap-1 px-2 py-1 text-[10px] uppercase tracking-wider">
                                                Done
                                            </Badge>
                                        ) : (
                                            <Badge
                                                variant="outline"
                                                className={cn(
                                                    "gap-1 px-2 py-1 font-medium text-[10px] uppercase tracking-wider border-none bg-gray-100",
                                                    urgency === "critical" ? "text-red-600 bg-red-50" : "text-gray-600"
                                                )}
                                            >
                                                {timeLeft}
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <div className="flex items-center justify-between text-xs mb-2">
                                        <span className="text-gray-400 font-medium uppercase tracking-wider">Progress</span>
                                        <span className="font-bold tabular-nums text-black">{completed}/{total}</span>
                                    </div>
                                    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                        <div
                                            className={cn(
                                                "h-full rounded-full transition-all duration-500 ease-out",
                                                isComplete ? "bg-black" : "bg-black"
                                            )}
                                            style={{ width: `${progressPercent}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Month Header */}
            <div className="bg-white rounded-xl p-6 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)]">
                <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-2xl font-bold text-black">
                        {new Date(currentYear, currentMonth - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                    </h2>
                </div>
                <div className="text-gray-500 space-y-1">
                    {(aStats.total + bStats.total) > 0 && (
                        <p className="flex items-center gap-2 text-sm">
                            <span className="font-bold text-black">
                                {aStats.completed + bStats.completed}
                            </span>
                            <span>of {aStats.total + bStats.total} rooms completed</span>
                        </p>
                    )}
                </div>
            </div>

            {/* No results after filter */}
            {filteredByFrequency.length === 0 && maintenanceTasks.length > 0 && (
                <div className="bg-white border-none rounded-xl p-10 text-center shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)]">
                    <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-4">
                        <Filter className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-bold text-black mb-2">No Tasks Found</h3>
                    <p className="text-gray-500 text-sm max-w-xs mx-auto">
                        No maintenance tasks match the selected frequency filter.
                    </p>
                </div>
            )}

            {/* A Block - Only show if there are scheduled rooms */}
            {showABlock && (
                <div className="bg-white rounded-xl overflow-hidden shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] transition-shadow hover:shadow-md">
                    <button
                        onClick={() => toggleBlock("A")}
                        className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
                    >
                        <div className="flex items-center gap-4">
                            <div className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center transition-transform duration-200",
                                expandedBlocks.has("A") ? "bg-black text-white" : "bg-gray-100 text-gray-400"
                            )}>
                                {expandedBlocks.has("A") ? (
                                    <ChevronDown className="w-5 h-5" />
                                ) : (
                                    <ChevronRight className="w-5 h-5" />
                                )}
                            </div>
                            <h3 className="text-xl font-bold text-black">Block A</h3>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="text-sm font-medium text-gray-500 tabular-nums">
                                {aStats.completed}/{aStats.total}
                            </span>
                            <div className="w-24 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                <div
                                    className="bg-black h-full rounded-full transition-all duration-500"
                                    style={{ width: `${aStats.total > 0 ? (aStats.completed / aStats.total) * 100 : 0}%` }}
                                />
                            </div>
                        </div>
                    </button>

                    {expandedBlocks.has("A") && (
                        <div className="border-t border-gray-100 animate-in slide-in-from-top-2 duration-200">
                            {Object.entries(aBlockByFloor).map(([floor, rooms]) => {
                                const floorKey = `A-${floor}`
                                const floorCompleted = rooms?.filter((r) => getRoomStatus(r.number) === "completed").length || 0
                                const floorTotal = rooms?.length || 0

                                return (
                                    <div key={floorKey} className="border-b border-gray-100 last:border-b-0">
                                        <button
                                            onClick={() => toggleFloor(floorKey)}
                                            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                                        >
                                            <div className="flex items-center gap-3 pl-2">
                                                <div className="w-6 h-6 flex items-center justify-center">
                                                    {expandedFloors.has(floorKey) ? (
                                                        <ChevronDown className="w-4 h-4 text-black" />
                                                    ) : (
                                                        <ChevronRight className="w-4 h-4 text-gray-400" />
                                                    )}
                                                </div>
                                                <span className="font-semibold text-black">Floor {floor}</span>
                                            </div>
                                            <Badge variant="secondary" className="tabular-nums bg-gray-100 text-gray-600 border-none">
                                                {floorCompleted}/{floorTotal}
                                            </Badge>
                                        </button>

                                        {expandedFloors.has(floorKey) && rooms && (
                                            <div className="bg-gray-50/50 p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 animate-in slide-in-from-top-1 duration-150">
                                                {rooms.map((room) => {
                                                    const status = getRoomStatus(room.number)
                                                    const roomTasks = getRoomTasks(room.number)
                                                    const completedCount = roomTasks.filter((t) => t.status === "completed").length

                                                    return (
                                                        <button
                                                            key={room.number}
                                                            onClick={() => onRoomClick(room.number, roomTasks)}
                                                            className={cn(
                                                                "p-4 rounded-xl border-none shadow-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]",
                                                                status === "completed"
                                                                    ? "bg-white ring-1 ring-black/5"
                                                                    : status === "in_progress"
                                                                        ? "bg-white ring-1 ring-black/5"
                                                                        : "bg-white ring-1 ring-black/5"
                                                            )}
                                                        >
                                                            <div className="flex items-center justify-between mb-2">
                                                                <span className="font-bold text-black text-lg">{room.number}</span>
                                                                {status === "completed" ? (
                                                                    <CheckCircle className="w-5 h-5 text-black" />
                                                                ) : status === "in_progress" ? (
                                                                    <div className="w-2.5 h-2.5 rounded-full bg-black animate-pulse" />
                                                                ) : (
                                                                    <div className="w-2.5 h-2.5 rounded-full bg-gray-200" />
                                                                )}
                                                            </div>
                                                            <div className="text-xs text-gray-400 font-medium">{completedCount}/{roomTasks.length} tasks</div>
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
            )}

            {/* B Block - Only show if there are scheduled rooms */}
            {showBBlock && (
                <div className="bg-white rounded-xl overflow-hidden shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] transition-shadow hover:shadow-md">
                    <button
                        onClick={() => toggleBlock("B")}
                        className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
                    >
                        <div className="flex items-center gap-4">
                            <div className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center transition-transform duration-200",
                                expandedBlocks.has("B") ? "bg-black text-white" : "bg-gray-100 text-gray-400"
                            )}>
                                {expandedBlocks.has("B") ? (
                                    <ChevronDown className="w-5 h-5" />
                                ) : (
                                    <ChevronRight className="w-5 h-5" />
                                )}
                            </div>
                            <h3 className="text-xl font-bold text-black">Block B</h3>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="text-sm font-medium text-gray-500 tabular-nums">
                                {bStats.completed}/{bStats.total}
                            </span>
                            <div className="w-24 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                <div
                                    className="bg-black h-full rounded-full transition-all duration-500"
                                    style={{ width: `${bStats.total > 0 ? (bStats.completed / bStats.total) * 100 : 0}%` }}
                                />
                            </div>
                        </div>
                    </button>

                    {expandedBlocks.has("B") && (
                        <div className="border-t border-gray-100 animate-in slide-in-from-top-2 duration-200">
                            {Object.entries(bBlockByFloor).map(([floor, rooms]) => {
                                const floorKey = `B-${floor}`
                                const floorCompleted = rooms?.filter((r) => getRoomStatus(r.number) === "completed").length || 0
                                const floorTotal = rooms?.length || 0

                                return (
                                    <div key={floorKey} className="border-b border-gray-100 last:border-b-0">
                                        <button
                                            onClick={() => toggleFloor(floorKey)}
                                            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                                        >
                                            <div className="flex items-center gap-3 pl-2">
                                                <div className="w-6 h-6 flex items-center justify-center">
                                                    {expandedFloors.has(floorKey) ? (
                                                        <ChevronDown className="w-4 h-4 text-black" />
                                                    ) : (
                                                        <ChevronRight className="w-4 h-4 text-gray-400" />
                                                    )}
                                                </div>
                                                <span className="font-semibold text-black">Floor {floor}</span>
                                            </div>
                                            <Badge variant="secondary" className="tabular-nums bg-gray-100 text-gray-600 border-none">
                                                {floorCompleted}/{floorTotal}
                                            </Badge>
                                        </button>

                                        {expandedFloors.has(floorKey) && rooms && (
                                            <div className="bg-gray-50/50 p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 animate-in slide-in-from-top-1 duration-150">
                                                {rooms.map((room) => {
                                                    const status = getRoomStatus(room.number)
                                                    const roomTasks = getRoomTasks(room.number)
                                                    const completedCount = roomTasks.filter((t) => t.status === "completed").length

                                                    return (
                                                        <button
                                                            key={room.number}
                                                            onClick={() => onRoomClick(room.number, roomTasks)}
                                                            className={cn(
                                                                "p-4 rounded-xl border-none shadow-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]",
                                                                status === "completed"
                                                                    ? "bg-white ring-1 ring-black/5"
                                                                    : status === "in_progress"
                                                                        ? "bg-white ring-1 ring-black/5"
                                                                        : "bg-white ring-1 ring-black/5"
                                                            )}
                                                        >
                                                            <div className="flex items-center justify-between mb-2">
                                                                <span className="font-bold text-black text-lg">{room.number}</span>
                                                                {status === "completed" ? (
                                                                    <CheckCircle className="w-5 h-5 text-black" />
                                                                ) : status === "in_progress" ? (
                                                                    <div className="w-2.5 h-2.5 rounded-full bg-black animate-pulse" />
                                                                ) : (
                                                                    <div className="w-2.5 h-2.5 rounded-full bg-gray-200" />
                                                                )}
                                                            </div>
                                                            <div className="text-xs text-gray-400 font-medium">{completedCount}/{roomTasks.length} tasks</div>
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
            )}

            {/* Lift Maintenance Section */}
            {liftTasks.length > 0 && (
                <div className="bg-white rounded-xl overflow-hidden shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] transition-shadow hover:shadow-md">
                    <button
                        onClick={() => toggleBlock("lifts")}
                        className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
                    >
                        <div className="flex items-center gap-4">
                            <div className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center transition-transform duration-200",
                                expandedBlocks.has("lifts") ? "bg-black text-white" : "bg-gray-100 text-gray-400"
                            )}>
                                {expandedBlocks.has("lifts") ? (
                                    <ChevronDown className="w-5 h-5" />
                                ) : (
                                    <ChevronRight className="w-5 h-5" />
                                )}
                            </div>
                            <h3 className="text-xl font-bold text-black">Lift Maintenance</h3>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="text-sm font-medium text-gray-500 tabular-nums">
                                {liftTasks.filter(t => t.status === "completed").length}/{liftTasks.length}
                            </span>
                            <div className="w-24 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                <div
                                    className="bg-black h-full rounded-full transition-all duration-500"
                                    style={{ width: `${liftTasks.length > 0 ? (liftTasks.filter(t => t.status === "completed").length / liftTasks.length) * 100 : 0}%` }}
                                />
                            </div>
                        </div>
                    </button>

                    {expandedBlocks.has("lifts") && (
                        <div className="border-t border-gray-100 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-in slide-in-from-top-2 duration-200">
                            {liftTasks.map((task) => {
                                const isCompleted = task.status === "completed"
                                const isInProgress = task.status === "in_progress" || task.status === "paused"
                                const liftLabel = task.lift_id || task.location || "Lift"

                                return (
                                    <button
                                        key={task.id}
                                        onClick={() => onRoomClick(liftLabel, [task])}
                                        className={cn(
                                            "p-5 rounded-xl border-none shadow-sm transition-all duration-200 text-left hover:scale-[1.02] active:scale-[0.98]",
                                            isCompleted
                                                ? "bg-white ring-1 ring-black/5"
                                                : isInProgress
                                                    ? "bg-white ring-1 ring-black/5"
                                                    : "bg-white ring-1 ring-black/5"
                                        )}
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className={cn(
                                                    "w-10 h-10 rounded-full flex items-center justify-center",
                                                    isCompleted 
                                                        ? "bg-gray-100" 
                                                        : isInProgress 
                                                            ? "bg-gray-100" 
                                                            : "bg-gray-50"
                                                )}>
                                                    <ArrowUpCircle className={cn(
                                                        "w-5 h-5",
                                                        isCompleted 
                                                            ? "text-black" 
                                                            : isInProgress 
                                                                ? "text-black" 
                                                                : "text-gray-400"
                                                    )} />
                                                </div>
                                                <span className="font-bold text-black text-lg">{liftLabel}</span>
                                            </div>
                                            {isCompleted ? (
                                                <CheckCircle className="w-6 h-6 text-black" />
                                            ) : isInProgress ? (
                                                <div className="w-2.5 h-2.5 rounded-full bg-black animate-pulse" />
                                            ) : (
                                                <div className="w-2.5 h-2.5 rounded-full bg-gray-200" />
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-500 line-clamp-2">{task.description || "Lift Maintenance"}</p>
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
