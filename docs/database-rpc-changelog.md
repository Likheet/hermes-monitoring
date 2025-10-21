# Supabase RPC Changelog (2025-10-20)

## Summary
- Added `public.create_task_with_autopause` RPC to centralize task creation, audit logging, and default payload population (the name is retained for backwards compatibility; it no longer issues automatic pauses).
- Added `public.list_tasks_summary` RPC to serve paginated task listings with only the fields required by the UI.

## Function Details

### `public.create_task_with_autopause`
**Purpose:** Inserts a task using the server clock for audit logs, ensures optional JSON payloads default to empty objects/arrays, and returns the full row used by the client.

**Key parameters:**
- `task_type text`
- `priority_level_db text`
- `priority_level_app text`
- `assigned_to uuid`
- `assigned_by uuid`
- `assigned_at jsonb`
- `expected_duration integer`
- `requires_verification boolean`
- `photo_requirements jsonb`
- `room_number text`
- `categorized_photos jsonb`
- `worker_remarks text`
- `supervisor_remarks text`

**Rollback:**
\`\`\`sql
drop function if exists public.create_task_with_autopause(
  text,
  text,
  text,
  uuid,
  uuid,
  jsonb,
  integer,
  boolean,
  jsonb,
  text,
  jsonb,
  text,
  text
);
\`\`\`

### `public.list_tasks_summary`
**Purpose:** Provides a server-side filtered, ordered, and paginated projection of records from `public.tasks` for list views.

**Key parameters:**
- `status_filter text default null`
- `assigned_to_filter uuid default null`
- `limit_count int default 200`
- `offset_count int default 0`

**Rollback:**
\`\`\`sql
drop function if exists public.list_tasks_summary(text, uuid, int, int);
\`\`\`

## Deployment Notes
- Both functions were created using the Supabase MCP integration on 2025-10-20.
- The Next.js API now relies on these RPCs; drop or renaming them requires updating `app/api/tasks/route.ts` and `lib/supabase-task-operations.ts` accordingly.
