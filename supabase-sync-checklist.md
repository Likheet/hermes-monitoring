# Supabase Integration Review Checklist

- **Worker status endpoint (`app/api/workers/status/route.ts`)**
  - Query filters use `IN_PROGRESS` / `PAUSED`, but `public.tasks.status` only allows lowercase values (`in_progress`, `paused`). Requests will always return empty results. Update the filter to lowercase values or reuse the shared normalizer.

- **Rework task persistence (`lib/task-context.tsx` → `saveTaskToSupabase`)**
  - Rejection flows create task IDs like `t169...`, but `public.tasks.id` requires UUID. Upserts will fail and leave the new task only in memory. Switch to UUID generation before writing to Supabase.

- **User creation sync (`lib/task-context.tsx` → `saveUserToSupabase`)**
  - Newly added workers get IDs like `u169...` and the payload omits `username` / `password_hash`, both required by `public.users`. The Supabase call fails silently. Generate UUIDs and send the mandatory columns (or stop calling the helper during local-only flows).

- **Shift schedule writes (`lib/task-context.tsx` / `lib/supabase-task-operations.ts`)**
  - `saveShiftSchedule` builds objects with `schedule_date` but `saveShiftScheduleToSupabase` reads `schedule.date` (undefined), so Supabase receives `NULL` for a NOT NULL column. Also, new schedules use IDs like `shift-sched-...` instead of UUIDs. Align the field names and ID format before calling Supabase.

- **Maintenance schedule sync (`lib/task-context.tsx` / `lib/supabase-task-operations.ts`)**
  - Schedules created in-app carry fields (`task_type`, `area`, `active`, dual-timestamp `created_at`) that do not exist on `public.maintenance_schedules` (`schedule_name`, `frequency`, `created_at` as timestamptz). `saveMaintenanceScheduleToSupabase` upserts the mismatched shape and will fail. Map to the actual columns and convert timestamps to plain ISO strings.

- **Maintenance task persistence (`lib/task-context.tsx` / `lib/supabase-task-operations.ts`)**
  - Generated IDs use the `mtask...` pattern instead of UUIDs, breaking inserts into `public.maintenance_tasks`. Additionally, `maintenanceTaskToDatabase` sends objects for `started_at`, `completed_at`, and `timer_duration`, but the table expects timestamptz/int. Fix both the ID format and field serialization.
  - App-side statuses include `"paused"`, yet the database check constraint only allows `pending`, `in_progress`, `completed`, `verified`. Attempting to persist a paused maintenance task will error; add a compatible status strategy.

- **Shift schedule loader (`loadShiftSchedulesFromSupabase`)**
  - Returned objects expose a `date` property, but downstream code (e.g. `getWorkerShiftForDate`) reads `schedule_date`. Ensure the loader normalizes to the app shape before state updates.

- **Notification sync guard (`lib/notification-utils.ts`)**
  - The helper still bails out when task IDs are non-UUIDs, which now blocks real Supabase writes for rework tasks created client-side. Once UUID generation is fixed, retest so notifications persist to `public.notifications`.

- **General testing**
  - After addressing the above, retest create/start/pause/resume/complete task sequences, shift overrides, maintenance schedule generation, and notification delivery against the live Supabase schema.
