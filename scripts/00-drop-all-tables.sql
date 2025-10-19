-- Drop all tables and start fresh
-- Run this first to clean up the database

DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.pause_records CASCADE;
DROP TABLE IF EXISTS public.tasks CASCADE;
DROP TABLE IF EXISTS public.shift_schedules CASCADE;
DROP TABLE IF EXISTS public.maintenance_tasks CASCADE;
DROP TABLE IF EXISTS public.maintenance_schedules CASCADE;
DROP TABLE IF EXISTS public.task_templates CASCADE;
DROP TABLE IF EXISTS public.custom_requests CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Drop any remaining constraints or policies
DROP POLICY IF EXISTS "Users can view all users" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Workers see own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Supervisors see department tasks" ON public.tasks;
DROP POLICY IF EXISTS "Front office and admins see all tasks" ON public.tasks;
DROP POLICY IF EXISTS "Workers update own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Supervisors update department tasks" ON public.tasks;
DROP POLICY IF EXISTS "Front office creates tasks" ON public.tasks;
DROP POLICY IF EXISTS "Front office updates all tasks" ON public.tasks;

SELECT 'All tables dropped successfully' AS status;
