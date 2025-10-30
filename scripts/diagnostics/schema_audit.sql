-- Hermes Monitoring Supabase Schema Audit
-- Purpose: verify live Supabase schema against repo expectations.
-- Usage:
--   1. supabase login (if not already authenticated)
--   2. supabase link --project-ref <project_ref>
--   3. supabase db remote commit --dry-run --file scripts/diagnostics/schema_audit.sql
--      (or paste individual queries into the Supabase SQL editor)

-- -----------------------------------------------------------------------------
-- 0. Introspection quick view: list all public tables
-- -----------------------------------------------------------------------------
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- -----------------------------------------------------------------------------
-- 1. Column definitions for the key app tables
-- -----------------------------------------------------------------------------
SELECT 'users' AS table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'users'
ORDER BY ordinal_position;

SELECT 'tasks' AS table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'tasks'
ORDER BY ordinal_position;

SELECT 'maintenance_tasks' AS table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'maintenance_tasks'
ORDER BY ordinal_position;

SELECT 'maintenance_schedules' AS table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'maintenance_schedules'
ORDER BY ordinal_position;

-- -----------------------------------------------------------------------------
-- 2. Check constraints and enums (helps spot uppercase vs lowercase status drift)
-- -----------------------------------------------------------------------------
SELECT tc.table_name,
       tc.constraint_name,
       cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc
  ON tc.constraint_name = cc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.constraint_type = 'CHECK'
  AND tc.table_name IN ('tasks', 'users', 'maintenance_tasks', 'shift_swap_requests')
ORDER BY tc.table_name, tc.constraint_name;

-- -----------------------------------------------------------------------------
-- 3. RLS configuration (should be true for security sensitive tables)
-- -----------------------------------------------------------------------------
SELECT n.nspname AS schema_name,
       c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_force_all
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN ('users', 'tasks', 'pause_records', 'handovers', 'shifts')
ORDER BY c.relname;

SELECT schemaname AS schema_name,
       tablename AS table_name,
       policyname,
       permissive,
       roles,
       cmd AS command,
       qual AS using_expression,
       with_check AS check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('users', 'tasks', 'pause_records', 'handovers', 'shifts')
ORDER BY tablename, policyname;

-- -----------------------------------------------------------------------------
-- 4. Migration history snapshot
-- -----------------------------------------------------------------------------
SELECT "version", name, inserted_at
FROM supabase_migrations.schema_migrations
ORDER BY inserted_at DESC;

-- -----------------------------------------------------------------------------
-- 5. Sample data sanity (status values, nullability checks)
-- -----------------------------------------------------------------------------
SELECT DISTINCT status
FROM tasks
ORDER BY status;

SELECT DISTINCT priority_level
FROM tasks
ORDER BY priority_level;

SELECT DISTINCT status
FROM maintenance_tasks
ORDER BY status;

-- -----------------------------------------------------------------------------
-- 6. Column existence cross-check for legacy scripts
-- -----------------------------------------------------------------------------
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'tasks'
  AND column_name IN ('started_at_server', 'completed_at_server', 'assigned_at_server', 'expected_duration_minutes');

-- -----------------------------------------------------------------------------
-- 7. Optional: counts (quick data health check)
-- -----------------------------------------------------------------------------
SELECT 'users' AS table_name, COUNT(*) AS row_count FROM users
UNION ALL
SELECT 'tasks', COUNT(*) FROM tasks
UNION ALL
SELECT 'maintenance_tasks', COUNT(*) FROM maintenance_tasks
UNION ALL
SELECT 'pause_records', COUNT(*) FROM pause_records
ORDER BY table_name;
