import type { Department, UserRole } from "./types"

export type DevLoginGroup = "Front Office" | "Managers" | "Supervisors" | "Housekeeping Workers" | "Maintenance Workers"

export interface DevAccount {
  displayName: string
  username: string
  password: string
  redirect: string
  group: DevLoginGroup
  role: UserRole
  department: Department
}

export const DEV_LOGIN_GROUP_ORDER: DevLoginGroup[] = [
  "Front Office",
  "Managers",
  "Supervisors",
  "Housekeeping Workers",
  "Maintenance Workers",
]

export const DEV_ACCOUNTS: DevAccount[] = [
  {
    displayName: "Bhavesh",
    username: "bhavesh",
    password: "bhavesh123",
    redirect: "/front-office",
    group: "Front Office",
    role: "front_office",
    department: "front_office",
  },
  {
    displayName: "Deshik",
    username: "Deshik",
    password: "front123",
    redirect: "/front-office",
    group: "Front Office",
    role: "front_office",
    department: "front_office",
  },
  {
    displayName: "jayalaxmi",
    username: "jayalaxmi",
    password: "jayalaxmi123",
    redirect: "/front-office",
    group: "Front Office",
    role: "front_office",
    department: "front_office",
  },
  {
    displayName: "Joe",
    username: "joe",
    password: "joe123",
    redirect: "/front-office",
    group: "Front Office",
    role: "front_office",
    department: "front_office",
  },
  {
    displayName: "Shashidhar",
    username: "shashidhar",
    password: "shashi123",
    redirect: "/front-office",
    group: "Front Office",
    role: "front_office",
    department: "front_office",
  },
  {
    displayName: "TEST",
    username: "manager",
    password: "manager123",
    redirect: "/manager",
    group: "Managers",
    role: "manager",
    department: "front_office",
  },
  {
    displayName: "Suraj",
    username: "suraj",
    password: "Suraj123",
    redirect: "/manager",
    group: "Managers",
    role: "manager",
    department: "front_office",
  },
  {
    displayName: "Sarah Johnson",
    username: "hk-super",
    password: "super123",
    redirect: "/supervisor",
    group: "Supervisors",
    role: "supervisor",
    department: "housekeeping-dept",
  },
  {
    displayName: "Test HK",
    username: "test hk",
    password: "test123",
    redirect: "/supervisor",
    group: "Supervisors",
    role: "supervisor",
    department: "housekeeping-dept",
  },
  {
    displayName: "Yogisha HK",
    username: "yogisha",
    password: "Yogisha123",
    redirect: "/supervisor",
    group: "Supervisors",
    role: "supervisor",
    department: "housekeeping-dept",
  },
  {
    displayName: "Akash",
    username: "akash",
    password: "akash123",
    redirect: "/worker",
    group: "Housekeeping Workers",
    role: "worker",
    department: "housekeeping",
  },
  {
    displayName: "John Smith",
    username: "hk-worker",
    password: "worker123",
    redirect: "/worker",
    group: "Housekeeping Workers",
    role: "worker",
    department: "housekeeping",
  },
  {
    displayName: "Kiran",
    username: "Kiran",
    password: "kiran123",
    redirect: "/worker",
    group: "Housekeeping Workers",
    role: "worker",
    department: "housekeeping",
  },
  {
    displayName: "Kumar",
    username: "Kumar",
    password: "345kumar",
    redirect: "/worker",
    group: "Housekeeping Workers",
    role: "worker",
    department: "housekeeping",
  },
  {
    displayName: "Naveen",
    username: "Naveen",
    password: "naveen987",
    redirect: "/worker",
    group: "Housekeeping Workers",
    role: "worker",
    department: "housekeeping",
  },
  {
    displayName: "Sudeep",
    username: "Sudeep",
    password: "123sudeep",
    redirect: "/worker",
    group: "Housekeeping Workers",
    role: "worker",
    department: "housekeeping",
  },
  {
    displayName: "Udit",
    username: "Udit",
    password: "udit234",
    redirect: "/worker",
    group: "Housekeeping Workers",
    role: "worker",
    department: "housekeeping",
  },
  {
    displayName: "Mike Rodriguez",
    username: "maint-worker",
    password: "worker123",
    redirect: "/worker",
    group: "Maintenance Workers",
    role: "worker",
    department: "maintenance",
  },
]

const DEV_ACCOUNT_LOOKUP = new Map(DEV_ACCOUNTS.map((account) => [account.username.toLowerCase(), account]))

export function findDevAccount(username: string) {
  return DEV_ACCOUNT_LOOKUP.get(username.toLowerCase()) ?? null
}
