# Recurring Task Flow Analysis

**Date:** November 8, 2025  
**Analysis Type:** Complete System Backtracking

---

## 🔴 CRITICAL FINDING: NO AUTOMATIC RECURRENCE

**The recurring task system is currently METADATA-ONLY.** Tasks marked as "recurring" are NOT automatically created or assigned when they need to recur.

---

## Current Implementation Details

### 1. Database Schema

**Tasks Table - Recurring Columns:**
\`\`\`sql
custom_task_is_recurring BOOLEAN DEFAULT false
custom_task_recurring_frequency TEXT (daily, weekly, biweekly, monthly)
custom_task_recurring_time TIME
custom_task_requires_specific_time BOOLEAN
\`\`\`

**Key Finding:** These are purely descriptive fields. No triggers, functions, or automation exists to act on them.

### 2. Task Creation Flow

**Manual Creation Only:**
1. User (Manager/Supervisor/Front Office) selects a task definition
2. User marks it as "recurring" with frequency (daily/weekly/biweekly/monthly)
3. Optional: Set preferred time if `requiresSpecificTime` is enabled
4. Task is created via `POST /api/tasks` → `create_task_with_autopause` RPC
5. Task is inserted into database with recurring metadata
6. **STOPS HERE** - No follow-up automation

**Files Involved:**
- `app/api/tasks/route.ts` (lines 226-375)
- `scripts/hermes-missing-functions.sql` (create_task_with_autopause RPC)
- Task creation forms in:
  - `app/front-office/create-task/page.tsx`
  - `app/supervisor/create-task/page.tsx`
  - `app/manager/create-task/page.tsx`
  - `app/admin/page.tsx`

### 3. Recurring Task Definition System

**Task Library (Custom Task Definitions):**
- Admins/Managers can create task definitions marked as recurring
- Stored in `tasks` table with `is_custom_task = true`
- Retrieved via `getCustomTaskDefinitions()` in `lib/custom-task-definitions.ts`
- These definitions are templates, not active scheduled jobs

**Purpose:** 
- Show recurring badge on task cards
- Alert front-office that this task type needs periodic scheduling
- Guide staff to manually create recurring instances

**UI Indicators:**
- Worker dashboard: "Recurring" badge on task cards
- Worker/Supervisor nav: Red notification dot when recurring tasks are active
- Task assignment form: Shows recurring frequency label (e.g., "Daily @ 09:00")

### 4. What Actually Happens

**Current Reality:**
\`\`\`
Day 1: Manager creates "Daily Pool Cleaning" task
       ↓
       Task assigned to Worker A
       ↓
       Worker completes task
       ↓
       Status: COMPLETED
       ↓
       ❌ NOTHING HAPPENS NEXT
\`\`\`

**Expected Behavior (NOT IMPLEMENTED):**
\`\`\`
Day 1: Manager creates "Daily Pool Cleaning" task
       ↓
       Task assigned to Worker A
       ↓
       Worker completes task
       ↓
       Status: COMPLETED
       ↓
       ✅ System checks recurring_frequency = "daily"
       ↓
       ✅ Automatically creates new task for next day
       ↓
       ✅ Assigns to appropriate worker based on shift
\`\`\`

---

## Missing Components

### 1. ❌ No Cron Jobs / Scheduled Tasks

**Database Check:**
\`\`\`sql
SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') as pg_cron_enabled;
-- Result: false
\`\`\`

**pg_cron extension is NOT enabled** in Supabase project.

**What's Missing:**
- No daily/hourly job to scan for recurring tasks
- No trigger to create next occurrence
- No scheduled task to check `recurring_time` and auto-assign

### 2. ❌ No Recurrence Generation Function

**Search Results:**
- No function named `generate_recurring_task()`
- No function named `create_next_occurrence()`
- No trigger on task completion checking `custom_task_is_recurring`

**What Should Exist:**
\`\`\`sql
-- EXAMPLE of what's needed (NOT IMPLEMENTED)
CREATE OR REPLACE FUNCTION generate_next_recurring_task()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'COMPLETED' AND NEW.custom_task_is_recurring = true THEN
    -- Calculate next occurrence based on recurring_frequency
    -- Insert new task with new assigned_at timestamp
    -- Assign to appropriate worker
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_task_complete
AFTER UPDATE ON tasks
FOR EACH ROW
WHEN (NEW.status = 'COMPLETED')
EXECUTE FUNCTION generate_next_recurring_task();
\`\`\`

### 3. ❌ No Recurring Task Scheduler Service

**No Edge Function or Cron Job:**
- No scheduled job to run at specific times
- No service to check `recurring_time` field
- No queue system for pending recurring tasks

---

## Maintenance Tasks vs Regular Recurring Tasks

### ✅ Maintenance Tasks (DIFFERENT SYSTEM - HAS AUTOMATION)

**Location:** `lib/task-context.tsx` lines 1706-1800+

**How It Works:**
1. Admin creates `MaintenanceSchedule` with frequency (daily/weekly/monthly)
2. Function `generateMaintenanceTasksFromSchedule()` is called
3. Creates tasks for all rooms in specified area (A Block/B Block/All)
4. Tasks created immediately, not on a schedule

**Key Difference:**
- Maintenance tasks are generated in BULK when schedule is activated
- NOT true recurring - more like "batch creation"
- No automatic regeneration after completion
- Manual: Admin toggles schedule → tasks created for current period

**Files:**
- `lib/maintenance-types.ts`
- `lib/task-context.tsx` (addSchedule, generateMaintenanceTasksFromSchedule)
- `app/admin/page.tsx` (maintenance scheduling UI)

---

## UI/UX Flow Analysis

### Current User Experience

**Worker:**
1. Sees recurring task in "Tasks" tab (hidden from home)
2. Sees "Recurring" badge and frequency label
3. Red dot on bottom nav when recurring tasks are active
4. Can start, pause, complete like any other task
5. ✅ Task completes → ❌ No new task appears

**Supervisor:**
1. Creates recurring task definition
2. Assigns to worker manually
3. Sees recurring badge in assignments
4. Red dot on "Assignments" tab when recurring tasks exist
5. ✅ Worker completes → ❌ Supervisor must manually create next occurrence

**Front Office / Manager:**
1. Can see task definitions marked as recurring
2. Visual reminder that this task type needs periodic creation
3. Must manually create new task each day/week/month
4. No automation or reminders

---

## Technical Gaps Summary

| Component | Status | Impact |
|-----------|--------|--------|
| **pg_cron extension** | ❌ Disabled | Cannot schedule automatic jobs |
| **Recurring trigger function** | ❌ Missing | Tasks don't regenerate after completion |
| **Time-based scheduler** | ❌ Missing | `recurring_time` field is unused |
| **Worker assignment logic** | ❌ Missing | No auto-assignment to available workers |
| **Notification system** | ✅ Exists but unused | Could notify FO when recurring task is due |
| **Recurring task queue** | ❌ Missing | No pending/scheduled task tracking |

---

## Recommendations

### Option 1: Enable Full Automation (Complex)

**Required Steps:**
1. Enable `pg_cron` extension in Supabase
2. Create database function to generate next occurrence
3. Set up cron job to run daily/hourly checking for due recurring tasks
4. Implement worker selection logic (shift-aware, workload balancing)
5. Add notification when recurring task is auto-created
6. Handle edge cases (no worker available, holidays, etc.)

**Estimated Effort:** 2-3 days

### Option 2: Semi-Automation via Front Office Queue (Medium)

**Simpler Approach:**
1. Create "Recurring Task Queue" view for Front Office
2. Show tasks that are due based on frequency and last completion
3. One-click "Create Next Occurrence" button
4. Front office manually reviews and assigns
5. System suggests worker based on availability

**Estimated Effort:** 1 day

### Option 3: Keep Current System + Better Reminders (Simple)

**Minimal Changes:**
1. Add "Recurring Tasks Due" dashboard widget
2. Calculate due date based on last completion + frequency
3. Show reminders to create next occurrence
4. Current manual assignment flow remains

**Estimated Effort:** 4-6 hours

---

## Code References

### Key Files for Recurring Logic

**Recurring Task Detection:**
\`\`\`typescript
// app/worker/page.tsx:42-48
const isRecurringTask = useCallback(
  (task: Task) =>
    Boolean(
      task.is_recurring ||
        task.recurring_frequency ||
        task.custom_task_is_recurring ||
        task.custom_task_recurring_frequency,
    ),
  [],
)
\`\`\`

**Task Creation API:**
\`\`\`typescript
// app/api/tasks/route.ts:260-264
custom_task_is_recurring: custom_task_is_recurring ?? null,
custom_task_recurring_frequency: custom_task_recurring_frequency ?? null,
custom_task_requires_specific_time: custom_task_requires_specific_time ?? null,
custom_task_recurring_time: custom_task_recurring_time ?? null,
\`\`\`

**Database Schema:**
\`\`\`sql
-- scripts/001_create_schema.sql:49-52
custom_task_is_recurring boolean NOT NULL DEFAULT false,
custom_task_recurring_frequency text,
custom_task_requires_specific_time boolean,
custom_task_recurring_time time
\`\`\`

---

## Conclusion

**CURRENT STATE:** Recurring tasks are a MANUAL workflow with visual indicators.

**FUNCTIONALITY:**
- ✅ Tasks can be marked as recurring
- ✅ Recurring frequency and time are stored
- ✅ UI shows recurring badges and notifications
- ✅ Workers can filter to see recurring tasks
- ❌ NO automatic creation of next occurrence
- ❌ NO scheduled job system
- ❌ NO trigger on task completion
- ❌ NO auto-assignment logic

**IMPACT:** Front office/managers must remember to manually create recurring task instances each day/week/month. The system only provides visual reminders, not automation.

**NEXT STEPS:** Decide on automation level and implement one of the three recommended approaches above.
