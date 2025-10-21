# Supabase Integration Gap Report

- [ ] **Task `photo_requirements` writes violate NOT NULL constraint**  
  - Code: `app/api/tasks/route.ts:126-189`, `app/api/tasks/[id]/route.ts:223-228`, `lib/database-types.ts:536-563`  
  - Schema: `docs/supabase-schema.md:57` marks `photo_requirements` as `jsonb NOT NULL DEFAULT '[]'::jsonb`.  
  - Impact: Creating or updating a task without documentation requirements sends `null`, so Postgres rejects the mutation.  
  - Action: Guard all create/update/upsert paths to omit the column (use default) or send an empty array instead of `null`. Add regression tests that create a task with `photo_required=false` and expect a 201/200.

- [ ] **Worker status endpoint filters with uppercase enums**  
  - Code: `app/api/workers/status/route.ts:32`.  
  - Schema: `docs/supabase-schema.md:33` allows lowercase `in_progress`, `paused`.  
  - Impact: `.in("status", ["IN_PROGRESS", "PAUSED"])` always returns zero rows, so availability is misreported.  
  - Action: Normalize the status list to lowercase before querying; add an integration test that creates a lowercase `tasks.status` row and verifies the worker is marked busy.

- [ ] **Locally generated IDs are not UUIDs**  
  - Code: `lib/task-context.tsx:443` (`t${Date.now()}`), `lib/task-context.tsx:624` (`u${Date.now()}`), `lib/task-context.tsx:691` (`sched${Date.now()}`), `lib/task-context.tsx:790` (`mtask${Date.now()}`), `lib/notification-utils.ts:26-43`.  
  - Schema: `docs/supabase-schema.md` requires UUID PKs for `tasks`, `users`, `maintenance_schedules`, `maintenance_tasks`, and uses UUID FKs in `notifications`.  
  - Impact: Upserts to Supabase fail silently (client-side catch) and notifications fall back to mock mode because IDs are not UUIDs.  
  - Action: Generate real UUIDs for every record before syncing, then re-enable the notification Supabase path. Regression test: create a rework task and confirm it persists plus emits a stored notification.

- [ ] **User sync lacks required credentials**  
  - Code: `lib/task-context.tsx:624-632`, `lib/supabase-task-operations.ts:83-104`, `app/api/users/route.ts:34-45`.  
  - Schema: `docs/supabase-schema.md:15` marks `username` and `password_hash` as `NOT NULL UNIQUE`.  
  - Impact: `appUserToDatabase` throws because username/hash are missing, `saveUserToSupabase` short-circuits, and the `/api/users` route will fail unless callers pre-hash passwords.  
  - Action: Decide on a credential provisioning flow (UI or service key) that supplies hashed passwords plus usernames before upserting. Add an API test that creates a worker through `/api/users` and verifies the row exists with a bcrypt hash.

- [ ] **Maintenance schedule payload does not match table shape**  
  - Code: `lib/maintenance-types.ts:4-17`, `lib/task-context.tsx:688-706`, `lib/supabase-task-operations.ts:215-224`.  
  - Schema: `docs/supabase-schema.md:150-163` exposes columns `schedule_name`, `frequency`, `auto_reset`, timestamps (no `task_type`, `area`, `active`, dual `created_at`).  
  - Impact: `upsert(schedule)` sends non-existent columns and a JSON object for `created_at`, so Supabase rejects the request.  
  - Action: Map app schedules to the canonical column names (or adjust schema), flatten timestamps, and confirm inserts succeed by creating a schedule through the UI and observing the row in Supabase.

- [ ] **Maintenance task upserts send incompatible shapes**  
  - Code: `lib/maintenance-types.ts:19-42`, `lib/task-context.tsx:789-809`, `lib/supabase-task-operations.ts:297-309`.  
  - Schema: `docs/supabase-schema.md:171-184` expects UUID `id`, `status` in `{pending,in_progress,completed,verified}`, `started_at/completed_at` as timestamptz, `timer_duration` as integer.  
  - Impact: Non-UUID IDs and JSON-wrapped timestamps/elapsed time violate column types; using `"paused"` trips the CHECK constraint.  
  - Action: Align status vocabulary, convert durations/timestamps to native types, and ensure UUIDs are generated before calling Supabase. Add tests that start/pause complete a maintenance task while persisting to Supabase.

- [ ] **Task notification fallback never hits Supabase once IDs are fixed**  
  - Code: `lib/notification-utils.ts:20-55`.  
  - Schema: `docs/supabase-schema.md:267-276` allows nullable `task_id` but expects UUID when provided.  
  - Impact: Once task IDs become UUIDs, the guard should allow Supabase inserts; currently there is no path that updates `read_at` or the stored notification.  
  - Action: After fixing ID generation, exercise the Supabase notification path and add tests to confirm inserts succeed and reads return stored notifications.

- [ ] **Audit: confirm maintenance/photo JSON invariants**  
  - Code: `lib/supabase-task-operations.ts:304-325`, `lib/database-types.ts:359-418`.  
  - Schema: `docs/supabase-schema.md:57`, `171-184`.  
  - Impact: The code assumes `categorized_photos` and maintenance `photos` can be arbitrary objects, while the schema defaults to JSON arrays. Supabase will accept JSON, but downstream parsing toggles between arrays and objects—risking runtime errors.  
  - Action: Decide on a canonical JSON structure (array or object) and update both schema expectations and converters. Add unit coverage for parsing round-trips against live data samples.

- [ ] **End-to-end regression suite is missing**  
  - Areas impacted: task lifecycle (create→start→pause→resume→complete), worker availability, maintenance schedule activation, notification delivery.  
  - Action: After the schema alignment fixes, script API-level tests (or Cypress/Playwright flows) that hit the Supabase-backed endpoints to ensure no latent NOT NULL/CHECK violations remain.
