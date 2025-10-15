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
    email: "admin@resort.com",
    role: "admin",
    department: "management",
    phone: "+1234567890",
    shift_start: "08:00",
    shift_end: "16:00",
    status: "available",
    created_at: createDualTimestamp(),
  },
  {
    id: "user-frontoffice",
    name: "Front Office",
    email: "frontoffice@resort.com",
    role: "front_office",
    department: "front_office",
    phone: "+1234567891",
    shift_start: "07:00",
    shift_end: "15:00",
    status: "available",
    created_at: createDualTimestamp(),
  },
  {
    id: "user-supervisor",
    name: "Supervisor",
    email: "supervisor@resort.com",
    role: "supervisor",
    department: "management",
    phone: "+1234567892",
    shift_start: "08:00",
    shift_end: "17:00",
    status: "available",
    created_at: createDualTimestamp(),
  },
  {
    id: "user-housekeeping",
    name: "Housekeeping",
    email: "housekeeping@resort.com",
    role: "worker",
    department: "housekeeping",
    phone: "+1234567893",
    shift_start: "08:00",
    shift_end: "16:00",
    status: "available",
    created_at: createDualTimestamp(),
  },
  {
    id: "user-maintenance",
    name: "Maintenance",
    email: "maintenance@resort.com",
    role: "worker",
    department: "maintenance",
    phone: "+1234567894",
    shift_start: "09:00",
    shift_end: "17:00",
    status: "available",
    created_at: createDualTimestamp(),
  },
]

export const mockTasks: Task[] = []

export const mockIssues: TaskIssue[] = []

export const mockShifts: Shift[] = []
