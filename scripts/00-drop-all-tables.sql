-- Drop All Tables Script
-- This script drops all tables in the correct order to respect foreign key constraints
-- Run this to completely reset the database

-- Disable foreign key checks temporarily (PostgreSQL doesn't support this directly)
-- Instead, we'll drop tables in dependency order

-- Drop tables that depend on other tables first
DROP TABLE IF EXISTS public.worker_rotation_assignments CASCADE;
DROP TABLE IF EXISTS public.rotation_pattern_details CASCADE;
DROP TABLE IF EXISTS public.rotation_patterns CASCADE;
DROP TABLE IF EXISTS public.shift_swap_requests CASCADE;
DROP TABLE IF EXISTS public.shift_schedules CASCADE;
DROP TABLE IF EXISTS public.user_preferences CASCADE;
DROP TABLE IF EXISTS public.task_issues CASCADE;
DROP TABLE IF EXISTS public.handovers CASCADE;
DROP TABLE IF EXISTS public.pause_records CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.archived_tasks CASCADE;
DROP TABLE IF EXISTS public.tasks CASCADE;
DROP TABLE IF EXISTS public.maintenance_tasks CASCADE;
DROP TABLE IF EXISTS public.maintenance_schedules CASCADE;
DROP TABLE IF EXISTS public.task_templates CASCADE;
DROP TABLE IF EXISTS public.system_metrics CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Return summary
SELECT 'All tables dropped successfully' AS status;
