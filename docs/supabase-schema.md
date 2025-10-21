# Supabase Schema Deep Dive

_Last updated: 2025-10-20_

## Overview
- Runtime: Supabase Postgres (public schema) backing the Hermes Monitoring app.
- Primary sources: `scripts/01-create-schema.sql`, supporting migrations under `scripts/`, and TypeScript bindings in `lib/database-types.ts`.
- Application expectation: JSON-heavy task records, normalized worker/shift/maintenance modeling, and audit-friendly history tables.
- Current repo contains multiple migration generations; see **Schema Drift & Action Items** for conflicts that may explain failing backend behaviour.

## Table Catalog (public schema)

### users
| Column | Type | Nullable | Default | Notes |
| --- | --- | --- | --- | --- |
| id | uuid | no | gen_random_uuid() | Primary key; aligns with app-level UUIDs. |
| username | text | no | | Unique login identifier. |
| password_hash | text | no | | BCrypt hash expected by seeding scripts. |
| name | text | no | | Display name shown in UI. |
| role | text | no | | CHECK: worker, supervisor, front_office, admin. |
| phone | text | yes | | Optional contact number. |
| department | text | yes | | CHECK: housekeeping, maintenance; nullable permits multi-department staff. |
| shift_timing | text | yes | | JSON string storing shift start/end/breaks. |
| created_at | timestamptz | no | now() | Creation timestamp. |

Indexes: `idx_users_username`, `idx_users_role`, `idx_users_department` (see 01-create-schema).

### tasks
| Column | Type | Nullable | Default | Notes |
| --- | --- | --- | --- | --- |
| id | uuid | no | gen_random_uuid() | Primary key referenced across history tables. |
| task_type | text | no | | Logical task category. |
| room_number | text | yes | | Optional location reference. |
| status | text | no | | CHECK: pending, assigned, in_progress, paused, completed, verified, rejected. |
| priority_level | text | yes | | CHECK: low, medium, high, urgent. |
| assigned_to_user_id | uuid | yes | | FK users(id), ON DELETE SET NULL. |
| assigned_by_user_id | uuid | yes | | FK users(id), ON DELETE SET NULL. |
| created_at | timestamptz | no | now() | Creation time. |
| updated_at | timestamptz | no | now() | Use trigger or application to keep current. |
| started_at | timestamptz | yes | | Worker start. |
| completed_at | timestamptz | yes | | Completion mark. |
| verified_at | timestamptz | yes | | QA verification time. |
| verified_by_user_id | uuid | yes | | FK users(id), ON DELETE SET NULL. |
| assigned_at | jsonb | yes | | Expected shape `{"client":..., "server":...}`. |
| description | text | yes | | Task body text. |
| special_instructions | text | yes | | Additional notes. |
| estimated_duration | integer | yes | | Minutes estimate. |
| actual_duration | integer | yes | | Minutes logged. |
| categorized_photos | jsonb | no | '[]'::jsonb | Array of photo metadata grouped by category. |
| worker_remarks | text | yes | | |
| supervisor_remarks | text | yes | | |
| quality_rating | integer | yes | | CHECK 1-5. |
| requires_verification | boolean | no | false | Flag for QA workflow. |
| timer_validation_flag | boolean | no | false | Raised when timer irregularities detected. |
| audit_log | jsonb | no | '[]'::jsonb | Denormalised audit mirror. |
| pause_history | jsonb | no | '[]'::jsonb | Denormalised pause mirror. |
| photo_requirements | jsonb | no | '[]'::jsonb | Structured capture rules per template. |

Indexes: `idx_tasks_assigned_to`, `idx_tasks_status`, `idx_tasks_room_number`, `idx_tasks_created_at`.

### archived_tasks
| Column | Type | Nullable | Default | Notes |
| --- | --- | --- | --- | --- |
| id | uuid | no | | Mirrors `tasks.id` when archived. |
| task_type | text | no | | |
| room_number | text | yes | | |
| status | text | no | | Stores final status string. |
| priority_level | text | yes | | |
| assigned_to_user_id | uuid | yes | | Historical reference only (no FK). |
| assigned_by_user_id | uuid | yes | | |
| created_at | timestamptz | yes | | Original creation time. |
| completed_at | timestamptz | yes | | Final completion. |
| verified_at | timestamptz | yes | | |
| actual_duration | integer | yes | | |
| quality_rating | integer | yes | | |
| archived_at | timestamptz | no | now() | Archive timestamp. |
| archive_reason | text | yes | | Optional rationale. |

### shift_schedules
| Column | Type | Nullable | Default | Notes |
| --- | --- | --- | --- | --- |
| id | uuid | no | gen_random_uuid() | |
| worker_id | uuid | no | | FK users(id) ON DELETE CASCADE. |
| schedule_date | date | no | | One row per worker/date. |
| shift_start | time | no | | |
| shift_end | time | no | | |
| break_start | time | yes | | |
| break_end | time | yes | | |
| is_override | boolean | no | false | Marks manual overrides. |
| override_reason | text | yes | | |
| notes | text | yes | | Optional supervisor or handover notes. |
| created_at | timestamptz | no | now() | |

Constraint: UNIQUE(worker_id, schedule_date). Indexes: `idx_shift_schedules_worker_date`, `idx_shift_schedules_date`.

### shifts
Legacy week-based schedule storage.
| Column | Type | Nullable | Default | Notes |
| --- | --- | --- | --- | --- |
| id | uuid | no | gen_random_uuid() | |
| worker_id | uuid | no | | FK users(id) ON DELETE CASCADE. |
| days_of_week | text[] | no | | Stored as array of weekday tokens. |
| shift_start | time | no | | |
| shift_end | time | no | | |
| break_start | time | yes | | |
| break_end | time | yes | | |
| created_at | timestamptz | no | now() | |

Indexes: `idx_shifts_worker`, `idx_shifts_effective` (from 005_enhanced_features_schema.sql).

### rotation_patterns
Defines named multi-day rotations.
| Column | Type | Nullable | Default | Notes |
| --- | --- | --- | --- | --- |
| id | uuid | no | gen_random_uuid() | |
| name | text | no | | |
| description | text | yes | | |
| cycle_length_days | integer | no | | Length of rotation cycle. |
| created_at | timestamptz | no | now() | |

### rotation_pattern_details
Day-by-day shifts for a pattern.
| Column | Type | Nullable | Default | Notes |
| --- | --- | --- | --- | --- |
| id | uuid | no | gen_random_uuid() | |
| pattern_id | uuid | no | | FK rotation_patterns(id) ON DELETE CASCADE. |
| day_number | integer | no | | 1-based within cycle. |
| shift_start | time | no | | |
| shift_end | time | no | | |
| break_start | time | yes | | |
| break_end | time | yes | | |
| is_off_day | boolean | no | false | Marks days off. |

Constraint: UNIQUE(pattern_id, day_number).

### worker_rotation_assignments
| Column | Type | Nullable | Default | Notes |
| --- | --- | --- | --- | --- |
| id | uuid | no | gen_random_uuid() | |
| worker_id | uuid | no | | FK users(id) ON DELETE CASCADE. |
| pattern_id | uuid | no | | FK rotation_patterns(id) ON DELETE CASCADE. |
| start_date | date | no | | Assignment start. |
| end_date | date | yes | | Optional end. |
| current_day_in_cycle | integer | no | 1 | Tracks progress through rotation. |
| created_at | timestamptz | no | now() | |

### shift_swap_requests
| Column | Type | Nullable | Default | Notes |
| --- | --- | --- | --- | --- |
| id | uuid | no | gen_random_uuid() | |
| requester_id | uuid | no | | FK users(id) ON DELETE CASCADE. |
| target_worker_id | uuid | no | | FK users(id) ON DELETE CASCADE. |
| requested_date | date | no | | Date being swapped. |
| status | text | no | | CHECK: pending, approved, rejected, cancelled. |
| reason | text | yes | | |
| approved_by_user_id | uuid | yes | | FK users(id) ON DELETE SET NULL. |
| created_at | timestamptz | no | now() | |
| updated_at | timestamptz | no | now() | |

### maintenance_schedules
| Column | Type | Nullable | Default | Notes |
| --- | --- | --- | --- | --- |
| id | uuid | no | gen_random_uuid() | |
| schedule_name | text | no | | Human label. |
| area | text | no | | Free-form area/zone. |
| frequency | text | no | | CHECK: daily, weekly, biweekly, monthly, quarterly, semiannual, annual. |
| last_completed | timestamptz | yes | | |
| next_due | timestamptz | yes | | |
| auto_reset | boolean | no | true | Auto recalculation on completion. |
| created_at | timestamptz | no | now() | |

### maintenance_tasks
| Column | Type | Nullable | Default | Notes |
| --- | --- | --- | --- | --- |
| id | uuid | no | gen_random_uuid() | |
| assigned_to | uuid | yes | | FK users(id) ON DELETE SET NULL. |
| status | text | no | | CHECK: pending, in_progress, completed, verified. |
| ac_location | text | yes | | Location descriptor. |
| task_type | text | no | | Task label (sync with schedules/templates). |
| room_number | text | yes | | |
| period_year | integer | yes | | Reporting grouping. |
| period_month | integer | yes | | |
| schedule_id | uuid | yes | | FK maintenance_schedules(id) ON DELETE SET NULL. |
| started_at | timestamptz | yes | | Stored directly; TS bindings treat as JSON optionally. |
| completed_at | timestamptz | yes | | |
| photos | jsonb | no | '[]'::jsonb | Collected media. |
| timer_duration | integer | yes | | Minutes. |
| notes | text | yes | | Free-form technician or supervisor notes. |
| created_at | timestamptz | no | now() | |

Indexes: `idx_maintenance_tasks_schedule`, `idx_maintenance_tasks_status`, `idx_maintenance_tasks_period`, `idx_maintenance_tasks_room` (via 010_maintenance_schedules_schema.sql).

### task_templates
| Column | Type | Nullable | Default | Notes |
| --- | --- | --- | --- | --- |
| id | uuid | no | gen_random_uuid() | |
| name | text | no | | |
| department | text | no | | CHECK: housekeeping, maintenance. |
| description | text | yes | | |
| estimated_duration | integer | yes | | Minutes. |
| priority_level | text | yes | | CHECK: low, medium, high, urgent. |
| requires_verification | boolean | no | false | |
| photo_requirements | jsonb | no | '[]'::jsonb | Structured capture rules. |
| special_instructions | text | yes | | |
| created_at | timestamptz | no | now() | |

### pause_records
| Column | Type | Nullable | Default | Notes |
| --- | --- | --- | --- | --- |
| id | uuid | no | gen_random_uuid() | |
| task_id | uuid | no | | FK tasks(id) ON DELETE CASCADE. |
| paused_at | jsonb | no | | Expected shape mirrors dual timestamps. |
| resumed_at | jsonb | yes | | |
| reason | text | yes | | |
| created_at | timestamptz | no | now() | |

### audit_logs
| Column | Type | Nullable | Default | Notes |
| --- | --- | --- | --- | --- |
| id | uuid | no | gen_random_uuid() | |
| task_id | uuid | yes | | FK tasks(id) ON DELETE CASCADE. |
| user_id | uuid | yes | | FK users(id) ON DELETE SET NULL. |
| action | text | no | | Domain action string. |
| old_status | text | yes | | |
| new_status | text | yes | | |
| metadata | jsonb | yes | | Arbitrary structured info. |
| created_at | timestamptz | no | now() | |

Indexes: `idx_audit_logs_task_id`, `idx_audit_logs_created_at`.

### handovers
| Column | Type | Nullable | Default | Notes |
| --- | --- | --- | --- | --- |
| id | uuid | no | gen_random_uuid() | |
| task_id | uuid | no | | FK tasks(id) ON DELETE CASCADE. |
| from_worker_id | uuid | no | | FK users(id) ON DELETE CASCADE. |
| to_worker_id | uuid | no | | FK users(id) ON DELETE CASCADE. |
| reason | text | yes | | |
| notes | text | yes | | |
| created_at | timestamptz | no | now() | |

### task_issues
| Column | Type | Nullable | Default | Notes |
| --- | --- | --- | --- | --- |
| id | uuid | no | gen_random_uuid() | |
| task_id | uuid | no | | FK tasks(id) ON DELETE CASCADE. |
| reported_by_user_id | uuid | no | | FK users(id) ON DELETE CASCADE. |
| issue_type | text | no | | Application-defined taxonomy. |
| description | text | no | | |
| photos | jsonb | no | '[]'::jsonb | Evidence attachments. |
| status | text | no | | CHECK: open, in_progress, resolved, closed. |
| resolved_by_user_id | uuid | yes | | FK users(id) ON DELETE SET NULL. |
| resolved_at | timestamptz | yes | | |
| created_at | timestamptz | no | now() | |

### escalations
| Column | Type | Nullable | Default | Notes |
| --- | --- | --- | --- | --- |
| id | uuid | no | gen_random_uuid() | |
| task_id | uuid | no | | FK tasks(id) ON DELETE CASCADE. |
| worker_id | uuid | no | | FK users(id) ON DELETE CASCADE. |
| escalation_type | text | no | | CHECK: 15min_overtime, 20min_overtime, 50percent_overtime. |
| acknowledged | boolean | no | false | |
| acknowledged_at | timestamptz | yes | | |
| created_at | timestamptz | no | now() | |

Additional legacy columns `level`, `timestamp_server`, etc. appear in earlier migration 005; see drift section.

### notifications
| Column | Type | Nullable | Default | Notes |
| --- | --- | --- | --- | --- |
| id | uuid | no | gen_random_uuid() | |
| user_id | uuid | no | | FK users(id) ON DELETE CASCADE. |
| task_id | uuid | yes | | FK tasks(id) ON DELETE CASCADE. |
| type | text | no | | Notification category. |
| title | text | no | | |
| message | text | no | | |
| read | boolean | no | false | |
| read_at | timestamptz | yes | | |
| created_at | timestamptz | no | now() | |

Indexes: `idx_notifications_user_read`, `idx_notifications_created_at`.

### worker_notes
| Column | Type | Nullable | Default | Notes |
| --- | --- | --- | --- | --- |
| id | uuid | no | gen_random_uuid() | |
| user_id | uuid | no | | FK users(id) ON DELETE CASCADE. |
| title | text | no | | Short label shown in worker UI. |
| content | text | no | | Main note body. |
| created_at | timestamptz | no | now() | |
| updated_at | timestamptz | no | now() | Tracks latest modification. |

Index: `idx_worker_notes_user_updated_at` to serve per-worker fetches ordered by `updated_at`.

### user_preferences
| Column | Type | Nullable | Default | Notes |
| --- | --- | --- | --- | --- |
| id | uuid | no | gen_random_uuid() | |
| user_id | uuid | no | | UNIQUE, FK users(id) ON DELETE CASCADE. |
| theme | text | no | 'light' | CHECK: light, dark, system. |
| language | text | no | 'en' | |
| notifications_enabled | boolean | no | true | |
| sound_enabled | boolean | no | true | |
| auto_logout_minutes | integer | no | 30 | |
| created_at | timestamptz | no | now() | |
| updated_at | timestamptz | no | now() | |

### system_metrics
| Column | Type | Nullable | Default | Notes |
| --- | --- | --- | --- | --- |
| id | uuid | no | gen_random_uuid() | |
| metric_name | text | no | | Arbitrary identifier. |
| metric_value | numeric | no | | Scalar value. |
| metric_type | text | no | | Used for grouping. |
| recorded_at | timestamptz | no | now() | |

Migration `010_system_health_schema.sql` expects stricter CHECK values and associated functions; see below.

### supabase_migrations.schema_migrations
Supabase internal ledger of applied migrations (managed by Supabase CLI/dashboard). Do not edit manually.

## Security: Row-Level Policies
Current repo contains RLS definitions in the older `001_create_schema.sql` and `005_enhanced_features_schema.sql` scripts:
- `users`: global SELECT, self-update policy.
- `tasks`: worker/supervisor/front-office scoped SELECT/UPDATE policies; INSERT limited to front_office/admin roles.
- `pause_records`, `audit_logs`, `escalations`, `shifts`, `handovers`: RLS enabled with permissive policies (many default to `true`).

If your deployed schema came from `01-create-schema.sql`, RLS may not be enabled because that script omits `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`. Verify via `SELECT relrowsecurity FROM pg_class WHERE relname = 'tasks';` and reapply policies if missing.

## Functions, Triggers, and Jobs
- `check_task_escalations()` (scripts/006_escalation_detection_function.sql): Iterates `tasks` for overtime conditions and writes to `escalations` plus `audit_logs`. **Depends on columns** `started_at_server`, `expected_duration_minutes`, `timestamp_server`, and `level` that only exist in the older schema. Running this against the newer table definition triggers errors.
- `record_system_metrics()` / `cleanup_old_metrics()` (scripts/010_system_health_schema.sql): Populate and prune `system_metrics`. Also defines helper `get_database_size()` and suggests pg_cron scheduling.
- `archive_old_tasks()` (scripts/010_system_health_schema.sql): Moves completed tasks older than six months into `archived_tasks`. Assumes columns `completed_at_server` and uppercase status values (legacy schema).

## Storage Buckets
- `task-photos` (scripts/003_storage_setup.sql): Public bucket with policies permitting authenticated uploads, public reads, and owner-only updates/deletes based on folder prefix equals auth UID.

## Schema Drift & Action Items
1. **Tasks table mismatch**: TypeScript models (`lib/database-types.ts`) expect lowercase status strings and JSONB fields (`assigned_at`, `pause_history`). Older migrations (`001_create_schema.sql`, `006_escalation_detection_function.sql`) reference uppercase status enums (`'IN_PROGRESS'`) and separate `_server` timestamp columns. Confirm which version is live. Mixing scripts leads to columns missing or invalid enum values.
2. **Escalations shape divergence**: `01-create-schema.sql` uses `escalation_type` text, while `005_enhanced_features_schema.sql` creates `level`, `timestamp_client/server`, `resolved` fields. Ensure downstream queries (e.g., analytics) align with live schema before applying functions relying on absent columns.
3. **Maintenance tables**: There are two definitions for `maintenance_schedules`/`maintenance_tasks`. The V1 script (010_maintenance_schedules_schema.sql) expects `task_type`, `area`, `frequency_weeks`, etc., whereas V2 (01-create-schema.sql) stores `schedule_name`, `frequency` across seven options. Reconcile before running seed scripts to avoid constraint errors.
4. **System metrics duplication**: Both `01-create-schema.sql` and `010_system_health_schema.sql` define `system_metrics` with different column names (`metric_name` vs `metric_type`+`value`). Check which version exists; drop/recreate to match the intended analytics pipeline.
5. **RLS enablement gaps**: The consolidated schema lacks explicit RLS activation, weakening security. Re-run the `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` and policy statements after aligning schema.
6. **Function dependencies**: PostgreSQL functions must be updated to use the current column names (e.g., `tasks.started_at` instead of `started_at_server`). Otherwise, scheduled jobs will fail silently and block escalation logic.

## Recommended Next Steps
1. Inspect the live Supabase instance (`select column_name from information_schema.columns where table_name='tasks';`) to verify which migration set actually applied.
2. Decide on the canonical schema (likely the one matching `lib/database-types.ts`) and prune legacy migrations or regenerate them via `supabase db diff`.
3. Update or recreate functions/triggers to reference the canonical column names and status values.
4. Reapply RLS policies aligned with resolved schema.
5. After corrections, export the full schema (`supabase db dump`) and compare back into version control to keep SQL in sync with the app types.
