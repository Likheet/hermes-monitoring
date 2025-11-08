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
    id: "user-worker-housekeeping",
    name: "HK Staff",
    role: "worker",
    department: "housekeeping",
    phone: "+1234567890",
    shift_start: "08:00",
    shift_end: "16:00",
    has_break: false,
    is_available: true,
  },
  {
    id: "user-worker-maintenance",
    name: "Maintenance Staff",
    role: "worker",
    department: "maintenance",
    phone: "+1234567891",
    shift_start: "09:00",
    shift_end: "17:00",
    has_break: false,
    is_available: true,
  },
  {
    id: "user-supervisor-housekeeping",
    name: "HK Supervisor",
    role: "supervisor",
    department: "housekeeping",
    phone: "+1234567892",
    shift_start: "08:00",
    shift_end: "16:00",
    has_break: false,
    is_available: true,
  },
  {
    id: "user-supervisor-maintenance",
    name: "Maintenance Supervisor",
    role: "supervisor",
    department: "maintenance",
    phone: "+1234567893",
    shift_start: "08:00",
    shift_end: "17:00",
    has_break: false,
    is_available: true,
  },
  {
    id: "user-frontoffice",
    name: "Front Office",
    role: "front_office",
    department: "front_office",
    phone: "+1234567894",
    shift_start: "07:00",
    shift_end: "15:00",
    has_break: false,
    is_available: true,
  },
  {
    id: "user-manager",
    name: "Duty Manager",
    role: "manager",
    department: "front_office",
    phone: "+1234567896",
    shift_start: "09:00",
    shift_end: "18:00",
    has_break: false,
    is_available: true,
  },
  {
    id: "user-admin",
    name: "Admin",
    role: "admin",
    department: "front_office",
    phone: "+1234567895",
    shift_start: "08:00",
    shift_end: "16:00",
    has_break: false,
    is_available: true,
  },
]

export const mockTasks: Task[] = []

export const mockIssues: TaskIssue[] = []

export const mockShifts: Shift[] = []
