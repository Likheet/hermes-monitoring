# Hermes Task Management System — Comprehensive Architecture Guide

**Purpose**: Full blueprint of the app for rebuilding Supabase schema, integrations, and data flows.

---

## 1. System Overview

**Hermes** is a resort task management system for housekeeping & maintenance operations.

- **Tech Stack**: Next.js 15 (App Router, TypeScript, React 19, Tailwind CSS)
- **State**: React Context (client-side) + localStorage persistence (no live DB required for dev)
- **Database**: Supabase (PostgreSQL) — currently disabled in dev; toggled by `isRealtimeEnabled` flag
- **Auth**: Mocked via localStorage (`userId` key) — can integrate Supabase Auth later
- **Storage**: Supabase Storage (for task photos)
- **Realtime**: Supabase Realtime (optional, disabled by default)

**Architecture Pattern**: 
- Client-heavy, context-driven state management
- Mock-first development (all initial data in `lib/mock-data.ts`)
- Optional Supabase integration (env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)

---

## 2. Core Entities & Relationships

### 2.1 Users (with Roles & Departments)

**Roles**: `worker`, `supervisor`, `front_office`, `admin`  
**Departments**: `housekeeping`, `maintenance`, `front_desk`

\`\`\`
Users
├─ id: string (UUID or custom)
├─ name: string
├─ role: UserRole
├─ phone: string
├─ department: Department
├─ shift_start: string (HH:MM, 24-hour)
├─ shift_end: string (HH:MM, 24-hour)
├─ has_break: boolean
├─ break_start?: string (HH:MM)
├─ break_end?: string (HH:MM)
└─ is_available: boolean
\`\`\`

**Relationships**:
- Worker → assigned tasks (1:many via `tasks.assigned_to_user_id`)
- Supervisor → verifies/rejects tasks (1:many via `tasks.assigned_by_user_id` when role=supervisor)
- User → shift schedules (1:many via `shift_schedules.worker_id`)
- User → audit logs (1:many via `audit_logs.user_id`)
- User → notifications (1:many via `notifications.user_id`)

---

### 2.2 Tasks (Main Business Entity)

**Status**: `PENDING`, `IN_PROGRESS`, `PAUSED`, `COMPLETED`, `REJECTED`  
**Priority**: `GUEST_REQUEST`, `TIME_SENSITIVE`, `DAILY_TASK`, `PREVENTIVE_MAINTENANCE`

\`\`\`
Tasks
├─ id: string
├─ task_type: string (e.g., "Light Not Working", "Room Cleaning")
├─ priority_level: PriorityLevel
├─ status: TaskStatus
├─ department: Department (housekeeping / maintenance)
├─ assigned_to_user_id: string (FK → users.id)
├─ assigned_by_user_id: string (FK → users.id)
├─ assigned_at: DualTimestamp { client, server }
├─ started_at: DualTimestamp | null
├─ completed_at: DualTimestamp | null
├─ expected_duration_minutes: integer
├─ actual_duration_minutes: integer | null
├─ photo_required: boolean
├─ photo_count?: integer (# of photos if photo_required=true)
├─ photo_documentation_required?: boolean (categorized photos)
├─ photo_categories?: Array<{ name, count, description }> (if categorized)
├─ categorized_photos: CategorizedPhotos | null
│  ├─ room_photos: string[] (full-room, post-service)
│  ├─ proof_photos: string[] (proof-of-completion)
│  ├─ before_photos?: string[]
│  ├─ during_photos?: string[]
│  ├─ after_photos?: string[]
│  └─ dynamic_categories?: Record<string, string[]>
├─ photo_urls: string[] (legacy field)
├─ worker_remark: string
├─ supervisor_remark: string
├─ rating: number | null (star rating 1–5)
├─ quality_comment: string | null
├─ rating_proof_photo_url: string | null
├─ rejection_proof_photo_url: string | null
├─ room_number: string
├─ pause_history: PauseRecord[] (nested)
├─ audit_log: AuditLogEntry[] (nested)
├─ is_custom_task?: boolean
├─ custom_task_name?: string | null
├─ custom_task_category?: TaskCategory | null
├─ custom_task_priority?: Priority | null
├─ custom_task_photo_required?: boolean | null
├─ custom_task_photo_count?: number | null
├─ rejection_acknowledged?: boolean
├─ rejection_acknowledged_at?: DualTimestamp | null
└─ custom_task_processed?: boolean
\`\`\`

**DualTimestamp** (anti-tampering pattern):
\`\`\`typescript
interface DualTimestamp {
  client: string  // ISO timestamp from client
  server: string  // ISO timestamp from server (for integrity check)
}
\`\`\`

**CategorizedPhotos**:
- Workers capture photos in categories (room, proof, before, during, after)
- Replaces flat `photo_urls` array
- Supports dynamic category names for custom tasks

**Key Relationships**:
- Task → User (worker, via `assigned_to_user_id`)
- Task → User (supervisor, via `assigned_by_user_id`)
- Task → Pause Records (1:many, nested in task or separate table)
- Task → Audit Logs (1:many, append-only)
- Task → Issues (1:many, via `task_issues.task_id`)

**Task Lifecycle**:
\`\`\`
PENDING 
  ├─→ IN_PROGRESS (worker starts)
  │    ├─→ PAUSED (worker pauses + reason)
  │    │    └─→ IN_PROGRESS (worker resumes)
  │    └─→ COMPLETED (worker submits + photos)
  │         └─→ REJECTED (supervisor rejects)
  │              └─ New PENDING rework task created
  └─→ (assigned waiting)
\`\`\`

---

### 2.3 Pause Records

Track when/why a task was paused.

\`\`\`
PauseRecord (nested in Task.pause_history or separate table)
├─ paused_at: DualTimestamp
├─ resumed_at: DualTimestamp | null
└─ reason: string
\`\`\`

**Use Case**: Calculate actual duration excluding pause times; audit trail.

---

### 2.4 Audit Logs (Append-Only)

Track all state changes and user actions on tasks.

\`\`\`
AuditLogEntry
├─ timestamp: DualTimestamp
├─ user_id: string (FK → users.id)
├─ action: string (TASK_STARTED, TASK_PAUSED, TASK_COMPLETED, TASK_APPROVED, TASK_REJECTED, etc.)
├─ old_status: TaskStatus | null
├─ new_status: TaskStatus | null
└─ details: string (human-readable context)
\`\`\`

**Actions Logged**:
- `TASK_ASSIGNED` (created)
- `TASK_STARTED`
- `TASK_PAUSED` (+ reason)
- `TASK_RESUMED`
- `TASK_COMPLETED`
- `TASK_APPROVED`
- `TASK_REJECTED`
- `TASK_REASSIGNED`
- `ISSUE_RAISED`
- `REJECTION_ACKNOWLEDGED`
- `TASK_CREATED_FROM_REJECTION`

---

### 2.5 Task Issues

Report problems/blockers during task execution.

\`\`\`
TaskIssue
├─ id: string
├─ task_id: string (FK → tasks.id)
├─ reported_by_user_id: string (FK → users.id)
├─ reported_at: DualTimestamp
├─ issue_description: string
├─ issue_photos: string[] (attachments)
└─ status: "OPEN" | "RESOLVED"
\`\`\`

**Use Case**: Worker reports blocker (e.g., guest in room, water shut off); notifies supervisors/front-office.

---

### 2.6 Shift Schedules

Define working hours per worker, with overrides (holidays, leave).

\`\`\`
ShiftSchedule
├─ id: string
├─ worker_id: string (FK → users.id)
├─ schedule_date: string (YYYY-MM-DD)
├─ shift_start: string (HH:MM)
├─ shift_end: string (HH:MM)
├─ has_break: boolean
├─ break_start?: string (HH:MM)
├─ break_end?: string (HH:MM)
├─ is_override: boolean (true = holiday/leave/off-duty)
├─ override_reason?: string ("Holiday", "Leave", "Sick", "Emergency")
├─ notes?: string
└─ created_at: string (ISO)
\`\`\`

**Use Case**: Determine if worker is on shift; handovers between shifts.

---

### 2.7 Maintenance Schedules & Tasks

**Preventive maintenance** workflows (AC, fans, exhausts, lifts).

#### MaintenanceSchedule
\`\`\`
MaintenanceSchedule
├─ id: string
├─ task_type: MaintenanceTaskType (ac_indoor | ac_outdoor | fan | exhaust | lift | all)
├─ area: MaintenanceArea (a_block | b_block | both)
├─ frequency: ScheduleFrequency (monthly | biweekly | semiannual)
├─ auto_reset: boolean
├─ active: boolean
└─ created_at: DualTimestamp
\`\`\`

#### MaintenanceTask
\`\`\`
MaintenanceTask
├─ id: string
├─ schedule_id: string (FK → maintenance_schedules.id)
├─ room_number?: string (for room-based tasks)
├─ lift_id?: string (for lift maintenance)
├─ task_type: MaintenanceTaskType
├─ location: string (e.g., "Room 5010 - Indoor AC")
├─ description: string
├─ status: "pending" | "in_progress" | "paused" | "completed"
├─ assigned_to?: string (FK → users.id)
├─ started_at?: string
├─ paused_at?: string
├─ completed_at?: string
├─ timer_duration?: number (seconds elapsed)
├─ photos: string[]
├─ categorized_photos?: { before_photos?, during_photos?, after_photos? }
├─ notes?: string
├─ expected_duration_minutes?: number
├─ period_month: number
├─ period_year: number
└─ created_at: string
\`\`\`

**Generation**: Scheduled tasks auto-generate for all rooms when schedule is activated.

---

### 2.8 Notifications (In-App)

\`\`\`
Notification
├─ id: string
├─ user_id: string (FK → users.id)
├─ type: "task_assigned" | "task_completed" | "escalation" | "handover" | "system"
├─ title: string
├─ message: string
├─ task_id?: string (FK → tasks.id)
├─ read: boolean
└─ created_at: string (ISO)
\`\`\`

**Use Case**: Real-time alerts (task assigned, rejected, issue reported, escalation).

---

### 2.9 Escalations

Track delayed tasks and overtime situations.

\`\`\`
Escalation
├─ id: string
├─ task_id: string (FK → tasks.id)
├─ worker_id: string (FK → users.id)
├─ level: 1 | 2 | 3 (escalation severity)
├─ timestamp_client: string
├─ timestamp_server: string
├─ acknowledged_by?: string (FK → users.id)
├─ acknowledged_at?: string
├─ resolved: boolean
├─ resolution_notes?: string
└─ created_at: string
\`\`\`

**Levels**:
1. **Level 1** (15-min warning): Task approaching 15 minutes over expected
2. **Level 2** (20-min warning): Task 20 minutes over expected
3. **Level 3** (50% overtime): Task at 50% of expected duration with no completion

---

### 2.10 Locations (Rooms & Common Areas)

**Resort Structure**:
- **A Block**: 60 rooms (floors 5–7, 20 rooms/floor)
- **B Block**: 42 rooms (floors 1–7, mixed 1BHK & 2BHK)
- **Common Areas**: Pool, lobby, restaurant, corridors, lifts, etc.

\`\`\`
Room {
  number: string (e.g., "5010", "1101")
  block: "A" | "B"
  floor: number
  type: "1BHK" | "2BHK"
}

Lift {
  id: string (e.g., "lift-a-a")
  name: string
  block: "A" | "B"
}

CommonArea {
  name: string
  keywords: string[] (for search)
}
\`\`\`

---

## 3. Data Flows & Workflows

### 3.1 Task Creation & Assignment
\`\`\`
Front Office / Admin (app/front-office, app/admin)
  ↓
createTask() in TaskContext
  ├─ Generate unique task ID
  ├─ Set status = PENDING
  ├─ Store in local state + localStorage
  ├─ If Supabase enabled: saveTaskToSupabase()
  ├─ Create initial audit log entry (TASK_ASSIGNED)
  └─ Create notification for assigned worker
\`\`\`

### 3.2 Task Execution (Worker)
\`\`\`
Worker (app/worker)
  ├─ Sees PENDING tasks assigned to them
  ├─ startTask()
  │  ├─ Set status = IN_PROGRESS, started_at = now
  │  ├─ Audit: TASK_STARTED
  │  └─ Check: only 1 task in progress per worker (validation)
  ├─ pauseTask(reason)
  │  ├─ Set status = PAUSED
  │  ├─ Add to pause_history with reason
  │  ├─ Audit: TASK_PAUSED
  │  └─ Check: only 1 paused task per worker
  ├─ resumeTask()
  │  ├─ Set status = IN_PROGRESS
  │  ├─ Mark last pause record: resumed_at = now
  │  └─ Audit: TASK_RESUMED
  └─ completeTask(photos, remark)
     ├─ Calculate actual_duration_minutes (excluding pauses)
     ├─ Store categorized_photos
     ├─ Set status = COMPLETED
     ├─ Audit: TASK_COMPLETED
     └─ Create notification for supervisor (verify/reject)
\`\`\`

### 3.3 Task Verification (Supervisor)
\`\`\`
Supervisor (app/supervisor)
  ├─ Sees COMPLETED tasks from their department
  ├─ verifyTask(approved, remark, rating, proof_photo)
  │  ├─ If approved:
  │  │  ├─ Store supervisor_remark, rating, quality_comment
  │  │  └─ Audit: TASK_APPROVED
  │  └─ If rejected:
  │     ├─ Set status = REJECTED
  │     ├─ Create NEW task (rework) with status = PENDING
  │     ├─ Link original + rework via audit trail
  │     ├─ Audit: TASK_REJECTED
  │     └─ Notify worker + supervisors
  └─ dismissRejectedTask() — worker acknowledges rejection
\`\`\`

### 3.4 Escalations (Real-Time Monitoring)
\`\`\`
Supervisor Dashboard (app/supervisor)
  ├─ Every task in progress is checked for escalation rules:
  │  ├─ If (now - started_at) > expected_duration + 15 min → Level 1
  │  ├─ If (now - started_at) > expected_duration + 20 min → Level 2
  │  └─ If (now - started_at) > expected_duration × 1.5 → Level 3
  ├─ Store escalation record
  └─ Notify supervisor + front-office
\`\`\`

### 3.5 Maintenance Schedule Activation
\`\`\`
Admin (app/admin/maintenance)
  ├─ Create maintenance schedule (task_type, area, frequency, active)
  ├─ toggleSchedule(id)
  │  ├─ If activated:
  │  │  ├─ For each room in area:
  │  │  │  ├─ For each task type:
  │  │  │  │  └─ Create MaintenanceTask (pending)
  │  │  └─ Store in localStorage + Supabase
  │  └─ If deactivated:
  │     └─ Mark schedule.active = false
  └─ Workers see generated maintenance tasks + timer
\`\`\`

### 3.6 Shift Management
\`\`\`
Admin (app/admin)
  ├─ saveShiftSchedule(worker_id, date, shift_start, shift_end, has_break, break_times)
  ├─ getShiftSchedules(worker_id, startDate, endDate) → queried from localStorage
  ├─ isWorkerOnShiftFromUser(user) → checks current shift status
  └─ isWorkerOnShift(shifts[], worker_id) → legacy, uses explicit shifts array
\`\`\`

---

## 4. Supabase Schema Design

### 4.1 Tables Overview

\`\`\`
auth.users (Supabase Auth — provided by default)
├─ id (UUID)
├─ email
├─ encrypted_password
├─ created_at
└─ (raw_user_meta_data can store role, name, phone, department)

public.users (Profile extension)
├─ id (UUID, FK → auth.users.id, CASCADE)
├─ name (TEXT)
├─ role (TEXT, CHECK: worker|supervisor|front_office|admin)
├─ phone (TEXT)
├─ department (TEXT, CHECK: housekeeping|maintenance|front_desk)
├─ shift_start (TEXT, HH:MM)
├─ shift_end (TEXT, HH:MM)
├─ has_break (BOOLEAN)
├─ break_start (TEXT, HH:MM, nullable)
├─ break_end (TEXT, HH:MM, nullable)
├─ is_available (BOOLEAN)
└─ created_at (TIMESTAMPTZ)

public.tasks
├─ id (UUID)
├─ task_type (TEXT)
├─ priority_level (TEXT, CHECK: GUEST_REQUEST|TIME_SENSITIVE|DAILY_TASK|PREVENTIVE_MAINTENANCE)
├─ status (TEXT, CHECK: PENDING|IN_PROGRESS|PAUSED|COMPLETED|REJECTED)
├─ department (TEXT)
├─ assigned_to_user_id (UUID, FK → users.id, nullable)
├─ assigned_by_user_id (UUID, FK → users.id, nullable)
├─ assigned_at_client (TIMESTAMPTZ)
├─ assigned_at_server (TIMESTAMPTZ)
├─ started_at_client (TIMESTAMPTZ, nullable)
├─ started_at_server (TIMESTAMPTZ, nullable)
├─ completed_at_client (TIMESTAMPTZ, nullable)
├─ completed_at_server (TIMESTAMPTZ, nullable)
├─ expected_duration_minutes (INT)
├─ actual_duration_minutes (INT, nullable)
├─ photo_required (BOOLEAN)
├─ photo_count (INT, nullable)
├─ photo_documentation_required (BOOLEAN)
├─ photo_categories (JSONB, nullable)
├─ categorized_photos (JSONB: { room_photos, proof_photos, before_photos, after_photos, dynamic_categories })
├─ photo_urls (TEXT[], legacy, for backward compatibility)
├─ worker_remark (TEXT)
├─ supervisor_remark (TEXT)
├─ rating (INT, 1-5, nullable)
├─ quality_comment (TEXT, nullable)
├─ rating_proof_photo_url (TEXT, nullable)
├─ rejection_proof_photo_url (TEXT, nullable)
├─ room_number (TEXT)
├─ pause_history (JSONB: [{ paused_at, resumed_at, reason }])
├─ is_custom_task (BOOLEAN)
├─ custom_task_name (TEXT, nullable)
├─ custom_task_category (TEXT, nullable)
├─ custom_task_priority (TEXT, nullable)
├─ custom_task_photo_required (BOOLEAN, nullable)
├─ custom_task_photo_count (INT, nullable)
├─ rejection_acknowledged (BOOLEAN)
├─ rejection_acknowledged_at_client (TIMESTAMPTZ, nullable)
├─ rejection_acknowledged_at_server (TIMESTAMPTZ, nullable)
├─ custom_task_processed (BOOLEAN)
└─ created_at (TIMESTAMPTZ)

public.pause_records
├─ id (UUID)
├─ task_id (UUID, FK → tasks.id, CASCADE)
├─ paused_at_client (TIMESTAMPTZ)
├─ paused_at_server (TIMESTAMPTZ)
├─ resumed_at_client (TIMESTAMPTZ, nullable)
├─ resumed_at_server (TIMESTAMPTZ, nullable)
├─ reason (TEXT)
└─ created_at (TIMESTAMPTZ)

public.audit_logs (append-only)
├─ id (UUID)
├─ task_id (UUID, FK → tasks.id, CASCADE)
├─ user_id (UUID, FK → users.id, nullable)
├─ action (TEXT: TASK_ASSIGNED, TASK_STARTED, etc.)
├─ old_status (TEXT, nullable)
├─ new_status (TEXT, nullable)
├─ details (TEXT)
├─ timestamp_client (TIMESTAMPTZ)
├─ timestamp_server (TIMESTAMPTZ)
├─ metadata (JSONB, for extensibility)
└─ created_at (TIMESTAMPTZ)

public.task_issues
├─ id (UUID)
├─ task_id (UUID, FK → tasks.id, CASCADE)
├─ reported_by_user_id (UUID, FK → users.id)
├─ reported_at_client (TIMESTAMPTZ)
├─ reported_at_server (TIMESTAMPTZ)
├─ issue_description (TEXT)
├─ issue_photos (TEXT[], photo URLs)
├─ status (TEXT, CHECK: OPEN|RESOLVED)
└─ created_at (TIMESTAMPTZ)

public.shift_schedules
├─ id (UUID)
├─ worker_id (UUID, FK → users.id, CASCADE)
├─ schedule_date (DATE)
├─ shift_start (TEXT, HH:MM)
├─ shift_end (TEXT, HH:MM)
├─ has_break (BOOLEAN)
├─ break_start (TEXT, nullable)
├─ break_end (TEXT, nullable)
├─ is_override (BOOLEAN)
├─ override_reason (TEXT, nullable)
├─ notes (TEXT, nullable)
└─ created_at (TIMESTAMPTZ)

public.maintenance_schedules
├─ id (UUID)
├─ task_type (TEXT, CHECK: ac_indoor|ac_outdoor|fan|exhaust|lift|all)
├─ area (TEXT, CHECK: a_block|b_block|both)
├─ frequency (TEXT, CHECK: monthly|biweekly|semiannual)
├─ auto_reset (BOOLEAN)
├─ active (BOOLEAN)
├─ created_at_client (TIMESTAMPTZ)
├─ created_at_server (TIMESTAMPTZ)
└─ created_at (TIMESTAMPTZ)

public.maintenance_tasks
├─ id (UUID)
├─ schedule_id (UUID, FK → maintenance_schedules.id, CASCADE)
├─ room_number (TEXT, nullable)
├─ lift_id (TEXT, nullable)
├─ task_type (TEXT)
├─ location (TEXT)
├─ description (TEXT)
├─ status (TEXT, CHECK: pending|in_progress|paused|completed)
├─ assigned_to (UUID, FK → users.id, nullable)
├─ started_at (TIMESTAMPTZ, nullable)
├─ paused_at (TIMESTAMPTZ, nullable)
├─ completed_at (TIMESTAMPTZ, nullable)
├─ timer_duration (INT, seconds, nullable)
├─ photos (TEXT[])
├─ categorized_photos (JSONB, nullable)
├─ notes (TEXT, nullable)
├─ expected_duration_minutes (INT, nullable)
├─ period_month (INT)
├─ period_year (INT)
└─ created_at (TIMESTAMPTZ)

public.notifications
├─ id (UUID)
├─ user_id (UUID, FK → users.id, CASCADE)
├─ type (TEXT, CHECK: task_assigned|task_completed|escalation|handover|system)
├─ title (TEXT)
├─ message (TEXT)
├─ task_id (UUID, FK → tasks.id, nullable)
├─ read (BOOLEAN)
└─ created_at (TIMESTAMPTZ)

public.escalations
├─ id (UUID)
├─ task_id (UUID, FK → tasks.id, CASCADE)
├─ worker_id (UUID, FK → users.id)
├─ level (INT, CHECK: 1|2|3)
├─ timestamp_client (TIMESTAMPTZ)
├─ timestamp_server (TIMESTAMPTZ)
├─ acknowledged_by (UUID, FK → users.id, nullable)
├─ acknowledged_at (TIMESTAMPTZ, nullable)
├─ resolved (BOOLEAN)
├─ resolution_notes (TEXT, nullable)
└─ created_at (TIMESTAMPTZ)
\`\`\`

### 4.2 Indexes for Performance

\`\`\`sql
-- Tasks queries
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to_user_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_priority ON tasks(priority_level);
CREATE INDEX idx_tasks_department ON tasks(department);
CREATE INDEX idx_tasks_created_at ON tasks(created_at DESC);

-- Pause records
CREATE INDEX idx_pause_records_task_id ON pause_records(task_id);

-- Audit logs
CREATE INDEX idx_audit_logs_task_id ON audit_logs(task_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);

-- Issues
CREATE INDEX idx_task_issues_task_id ON task_issues(task_id);
CREATE INDEX idx_task_issues_status ON task_issues(status);

-- Shift schedules
CREATE INDEX idx_shift_schedules_worker_id ON shift_schedules(worker_id);
CREATE INDEX idx_shift_schedules_date ON shift_schedules(schedule_date);

-- Maintenance
CREATE INDEX idx_maintenance_tasks_schedule_id ON maintenance_tasks(schedule_id);
CREATE INDEX idx_maintenance_tasks_status ON maintenance_tasks(status);

-- Notifications
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- Escalations
CREATE INDEX idx_escalations_task_id ON escalations(task_id);
CREATE INDEX idx_escalations_resolved ON escalations(resolved);
\`\`\`

### 4.3 Row Level Security (RLS) Policies

**Principle**: Users see only data they have permission to access.

#### Users Table
- `SELECT`: All users (for team visibility)
- `UPDATE`: Users can update own profile

#### Tasks Table
- **Worker**: Can see/update only own assigned tasks
- **Supervisor**: Can see/update all tasks in their department
- **Front Office / Admin**: Can see/update all tasks

#### Audit Logs Table
- `SELECT`: Users see logs for tasks they can access
- `INSERT`: Authenticated users create logs

#### Pause Records, Issues, Notifications
- `SELECT`: Users see records for tasks they can access
- `INSERT/UPDATE`: Role-based (workers insert for own tasks, supervisors approve, etc.)

---

### 4.4 Supabase Storage for Photos

**Bucket**: `task-photos` (public read, authenticated write)

\`\`\`
task-photos/
├─ {user_id}/
│  └─ {task_id}/
│     ├─ room_photo_1.jpg
│     ├─ proof_photo_1.jpg
│     ├─ before_photo_1.jpg
│     └─ after_photo_1.jpg
\`\`\`

**Policies**:
- Authenticated users can upload
- Anyone can view (public read)
- Users can delete own photos

---

### 4.5 Realtime Subscriptions

**Enable in `lib/task-context.tsx`**:
\`\`\`typescript
const [isRealtimeEnabled] = useState(true); // Change from false to true
\`\`\`

**Subscriptions**:
- `tasks` table: All changes (INSERT, UPDATE, DELETE)
- `notifications` table: Changes for current user
- `maintenance_tasks` table: Changes
- `escalations` table: New escalations

---

## 5. Integration Points

### 5.1 Client-Side (React)

**Location**: `lib/task-context.tsx`, `lib/auth-context.tsx`

**Functions for Supabase Integration**:
\`\`\`typescript
// Save/delete operations (stub functions in context, ready for Supabase)
saveTaskToSupabase(task)
updateTaskSupabase(taskId, updates)
deleteTaskSupabase(taskId)
saveUserToSupabase(user)
saveMaintenanceScheduleToSupabase(schedule)
saveMaintenanceTaskToSupabase(task)
saveShiftScheduleToSupabase(schedule)
deleteMaintenanceScheduleFromSupabase(scheduleId)
\`\`\`

### 5.2 API Routes (Optional)

**Location**: `app/api/`

Potential routes for server-side logic:
- `POST /api/tasks` — create task
- `PATCH /api/tasks/[id]` — update task
- `GET /api/tasks` — list tasks (with RLS applied)
- `POST /api/notifications/send` — create bulk notifications
- `POST /api/escalations/check` — run escalation detection (cron job)

### 5.3 Environment Variables

\`\`\`
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
\`\`\`

Both required for Supabase integration. If missing, app falls back to mock data + localStorage.

---

## 6. State Management & localStorage Keys

**localStorage Keys**:
- `userId` → logged-in user ID (auth mock)
- `maintenance_schedules` → JSON array of MaintenanceSchedule
- `maintenance_tasks` → JSON array of MaintenanceTask
- `shift_schedules` → JSON array of ShiftSchedule
- `pwa-install-dismissed` → "true" if PWA install prompt dismissed
- `custom_task_definitions` → JSON array of custom task definitions

**React Context Providers** (in `app/layout.tsx`):
1. `AuthProvider` — user session via localStorage
2. `TaskProvider` — tasks, users, issues, schedules, maintenance tasks via React state + localStorage sync
3. `StorageCleaner` — cleanup old data
4. `ErrorBoundary` — error handling

---

## 7. Key Lib Files & Their Responsibilities

| File | Purpose |
|------|---------|
| `lib/types.ts` | Core entity type definitions |
| `lib/task-context.tsx` | Task lifecycle, state management, localStorage sync |
| `lib/auth-context.tsx` | Mock authentication, user session |
| `lib/mock-data.ts` | Initial users, tasks for dev |
| `lib/maintenance-types.ts` | Maintenance schedule & task types |
| `lib/shift-utils.ts` | Shift availability checks |
| `lib/task-definitions.ts` | Task categories, photo requirements, durations |
| `lib/custom-task-definitions.ts` | Custom task persistence (localStorage) |
| `lib/location-data.ts` | Room/lift/common area metadata |
| `lib/supabase/client.ts` | Supabase client factory |
| `lib/use-realtime-tasks.ts` | Realtime subscription hook |
| `lib/escalation-utils.ts` | Escalation detection logic |
| `lib/notification-utils.ts` | Notification creation & sounds |
| `lib/haptics.ts` | Haptic feedback (mobile) |

---

## 8. Development Workflow

### To Rebuild Supabase from Scratch:

1. **Reset Supabase Database**:
   \`\`\`bash
   # Drop all existing tables (if present)
   # scripts/00-drop-all-tables.sql
   \`\`\`

2. **Run Core Schema**:
   \`\`\`bash
   # scripts/001_create_schema.sql
   # Creates: users, tasks, pause_records, audit_logs
   # Enables RLS
   \`\`\`

3. **Run Enhanced Features**:
   \`\`\`bash
   # scripts/005_enhanced_features_schema.sql
   # Adds: escalations, shifts, handovers
   \`\`\`

4. **Run Additional Schemas**:
   \`\`\`bash
   # scripts/008_notifications_schema.sql
   # scripts/009_user_preferences_schema.sql
   # scripts/010_maintenance_schedules_schema.sql
   \`\`\`

5. **Setup Storage**:
   \`\`\`bash
   # scripts/003_storage_setup.sql
   # Creates: task-photos bucket, storage policies
   \`\`\`

6. **Seed Initial Data** (optional):
   \`\`\`bash
   # scripts/001_create_schema.sql creates auth trigger
   # Create test auth users via Supabase console or API
   # Seed tasks via API or SQL directly
   \`\`\`

7. **Enable Realtime** (optional):
   \`\`\`typescript
   // lib/task-context.tsx, line ~30
   const [isRealtimeEnabled] = useState(true);
   \`\`\`

8. **Set Environment Variables**:
   \`\`\`
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   \`\`\`

9. **Restart Dev Server**:
   \`\`\`bash
   pnpm dev
   \`\`\`

---

## 9. Notes & Gotchas

- **DualTimestamp**: Always use both `client` and `server` timestamps for integrity checks.
- **Photo Categorization**: New tasks can use `categorized_photos` (structured) or `photo_urls` (legacy). Prefer categorized.
- **RLS**: Be strict; test RLS policies with different user roles before production.
- **Realtime**: Not required; disabled by default for performance. Enable only if many workers accessing simultaneously.
- **localStorage Sync**: On app init, localStorage data is read and stored in React state. Any changes go to state first, then synced to localStorage.
- **Mock Data**: `lib/mock-data.ts` seeds initial users; new tasks/maintenance data is empty by default.
- **Custom Tasks**: Stored in localStorage, not Supabase, to allow offline-first experience.

---

## 10. Next Steps for Supabase Rebuild

1. **Use Supabase MCP**: Apply migrations from `scripts/` folder using the Supabase MCP tool.
2. **Test RLS**: Create test users with different roles; verify permissions.
3. **Enable Storage**: Set up task photo uploads.
4. **Enable Realtime**: Toggle in `lib/task-context.tsx` and verify subscriptions work.
5. **Update `.env.local`**: Add Supabase project credentials.
6. **Test End-to-End**: Create tasks, assign, complete, verify → all data persists in DB.

---

**End of Architecture Guide**
