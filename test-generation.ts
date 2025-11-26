
// Mock types
type MaintenanceTaskType = "ac_indoor" | "ac_outdoor" | "fan" | "exhaust" | "lift" | "all"
type MaintenanceArea = "a_block" | "b_block" | "both"
type ScheduleFrequency = "daily" | "weekly" | "biweekly" | "monthly" | "quarterly" | "semiannual" | "annual" | "custom"

interface MaintenanceSchedule {
    id: string
    task_type: MaintenanceTaskType
    area: MaintenanceArea
    frequency: ScheduleFrequency
    auto_reset: boolean
    active: boolean
    created_at: any
    schedule_name?: string
    last_completed?: string | null
    next_due?: string | null
    updated_at?: string | null
    frequency_weeks?: number | null
    day_range_start?: number | null
    day_range_end?: number | null
    created_by?: string | null
    metadata_version?: number
    assigned_to?: string[] | null
}

interface MaintenanceTask {
    id: string
    schedule_id: string
    room_number?: string
    lift_id?: string
    task_type: MaintenanceTaskType
    location: string
    description: string
    status: "pending" | "in_progress" | "paused" | "completed" | "rejected"
    assigned_to?: string
    started_at?: string
    paused_at?: string
    completed_at?: string
    timer_duration?: number
    photos: string[]
    categorized_photos?: {
        before_photos?: string[]
        during_photos?: string[]
        after_photos?: string[]
    }
    notes?: string
    rejection_reason?: string | null
    expected_duration_minutes?: number
    period_month: number
    period_year: number
    created_at: string
}

// Mock data
const ALL_ROOMS = [
    { number: "101", block: "A", floor: 1 },
    { number: "102", block: "A", floor: 1 },
    { number: "201", block: "B", floor: 2 },
];

function getMaintenanceItemsForRoom(roomNumber: string) {
    return [
        { type: "ac_indoor" as const, location: "Bedroom", description: "Clean AC filter" },
        { type: "fan" as const, location: "Living Room", description: "Clean fan blades" }
    ];
}

const DEFAULT_MAINTENANCE_DURATION: Record<MaintenanceTaskType, number> = {
    ac_indoor: 30,
    ac_outdoor: 30,
    fan: 15,
    exhaust: 20,
    lift: 45,
    all: 60,
};

function generateUuid() {
    return "test-uuid-" + Math.random().toString(36).substring(7);
}

// Mock schedule
const schedule: MaintenanceSchedule = {
    id: "test-schedule-id",
    task_type: "ac_indoor",
    area: "both",
    frequency: "monthly",
    auto_reset: true,
    active: true,
    created_at: { client: new Date().toISOString(), server: new Date().toISOString() },
    assigned_to: ["00000000-0000-0000-0000-000000000005"]
};

// Logic from generateMaintenanceTasksFromSchedule
async function testGeneration() {
    const currentDate = new Date()
    const currentMonth = currentDate.getMonth() + 1
    const currentYear = currentDate.getFullYear()

    console.log("[v0] Generating maintenance tasks for schedule:", schedule.id, schedule.task_type, schedule.area)

    let roomsToGenerate = ALL_ROOMS
    if (schedule.area === "a_block") {
        roomsToGenerate = ALL_ROOMS.filter((r) => r.block === "A")
    } else if (schedule.area === "b_block") {
        roomsToGenerate = ALL_ROOMS.filter((r) => r.block === "B")
    }

    console.log("[v0] Generating tasks for", roomsToGenerate.length, "rooms")

    const taskTypesToGenerate: MaintenanceTaskType[] =
        schedule.task_type === "all" ? ["ac_indoor", "ac_outdoor", "fan", "exhaust"] : [schedule.task_type]

    console.log("[v0] Task types to generate:", taskTypesToGenerate)

    const tasksToPersist: MaintenanceTask[] = []
    const assignees = schedule.assigned_to || []
    console.log("[v0] Assignees for schedule:", schedule.id, assignees)
    const assigneeCount = assignees.length
    let taskIndex = 0

    roomsToGenerate.forEach((room) => {
        const maintenanceItems = getMaintenanceItemsForRoom(room.number)

        const filteredItems = maintenanceItems.filter((item) => taskTypesToGenerate.includes(item.type))

        filteredItems.forEach((item) => {
            const assignedTo = assigneeCount > 0 ? assignees[taskIndex % assigneeCount] : undefined

            const newTask: MaintenanceTask = {
                id: generateUuid(),
                schedule_id: schedule.id,
                room_number: room.number,
                task_type: item.type,
                location: item.location,
                description: `${item.description} - room ${room.number}`,
                status: "pending",
                assigned_to: assignedTo,
                photos: [],
                categorized_photos: {
                    before_photos: [],
                    during_photos: [],
                    after_photos: [],
                },
                period_month: currentMonth,
                period_year: currentYear,
                created_at: new Date().toISOString(),
                expected_duration_minutes: DEFAULT_MAINTENANCE_DURATION[item.type] ?? DEFAULT_MAINTENANCE_DURATION.all,
            }
            tasksToPersist.push(newTask)
            taskIndex++
        })
    })

    console.log("Generated tasks count:", tasksToPersist.length);
    if (tasksToPersist.length > 0) {
        console.log("First task assigned_to:", tasksToPersist[0].assigned_to);
    }
}

testGeneration();
