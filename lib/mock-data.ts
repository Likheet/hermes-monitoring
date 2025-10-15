import type { User, Task, DualTimestamp, TaskIssue } from "./types"
import type { Shift } from "./shift-utils"

// Helper to create dual timestamps
export function createDualTimestamp(date?: Date): DualTimestamp {
  const timestamp = (date || new Date()).toISOString()
  return {
    client: timestamp,
    server: timestamp, // In real app, this would come from server
  }
}

export const mockUsers: User[] = [
  {
    id: "user-admin",
    name: "Admin User",
    role: "admin",
    department: "front_desk",
    phone: "+1234567890",
    shift_start: "08:00",
    shift_end: "16:00",
    has_break: false,
    is_available: true,
  },
  {
    id: "user-frontoffice",
    name: "Front Office",
    role: "front_office",
    department: "front_desk",
    phone: "+1234567891",
    shift_start: "07:00",
    shift_end: "15:00",
    has_break: false,
    is_available: true,
  },
  {
    id: "user-supervisor",
    name: "Supervisor",
    role: "supervisor",
    department: "front_desk",
    phone: "+1234567892",
    shift_start: "08:00",
    shift_end: "17:00",
    has_break: false,
    is_available: true,
  },
  {
    id: "user-housekeeping",
    name: "Housekeeping",
    role: "worker",
    department: "housekeeping",
    phone: "+1234567893",
    shift_start: "08:00",
    shift_end: "16:00",
    has_break: false,
    is_available: true,
  },
  {
    id: "user-maintenance",
    name: "Maintenance",
    role: "worker",
    department: "maintenance",
    phone: "+1234567894",
    shift_start: "09:00",
    shift_end: "17:00",
    has_break: false,
    is_available: true,
  },
]

export const mockTasks: Task[] = []

export const mockIssues: TaskIssue[] = []

export const mockShifts: Shift[] = []
