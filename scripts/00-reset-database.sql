-- Reset database by truncating all tables
-- This preserves the schema but removes all data

-- Disable triggers temporarily
SET session_replication_role = replica;

-- Truncate all tables in correct order (respecting foreign keys)
TRUNCATE TABLE public.pause_records CASCADE;
TRUNCATE TABLE public.archived_tasks CASCADE;
TRUNCATE TABLE public.tasks CASCADE;
TRUNCATE TABLE public.shift_schedules CASCADE;
TRUNCATE TABLE public.maintenance_tasks CASCADE;
TRUNCATE TABLE public.maintenance_schedules CASCADE;
TRUNCATE TABLE public.notifications CASCADE;
TRUNCATE TABLE public.handovers CASCADE;
TRUNCATE TABLE public.shift_swap_requests CASCADE;
TRUNCATE TABLE public.shifts CASCADE;
TRUNCATE TABLE public.worker_rotation_assignments CASCADE;
TRUNCATE TABLE public.rotation_pattern_details CASCADE;
TRUNCATE TABLE public.rotation_patterns CASCADE;
TRUNCATE TABLE public.task_templates CASCADE;
TRUNCATE TABLE public.user_preferences CASCADE;
TRUNCATE TABLE public.users CASCADE;
TRUNCATE TABLE public.system_metrics CASCADE;

-- Re-enable triggers
SET session_replication_role = DEFAULT;

SELECT 'Database reset complete. All tables truncated.' as status;
