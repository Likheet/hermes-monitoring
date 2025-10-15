-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('worker', 'supervisor', 'front_office', 'admin')),
  phone TEXT,
  department TEXT CHECK (department IN ('housekeeping', 'maintenance')),
  shift_timing TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks table with dual timestamps
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type TEXT NOT NULL,
  priority_level TEXT NOT NULL CHECK (priority_level IN ('GUEST_REQUEST', 'TIME_SENSITIVE', 'DAILY_TASK', 'PREVENTIVE_MAINTENANCE')),
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'REJECTED')),
  assigned_to_user_id UUID REFERENCES public.users(id),
  assigned_by_user_id UUID REFERENCES public.users(id),
  assigned_at_client TIMESTAMPTZ,
  assigned_at_server TIMESTAMPTZ DEFAULT NOW(),
  started_at_client TIMESTAMPTZ,
  started_at_server TIMESTAMPTZ,
  completed_at_client TIMESTAMPTZ,
  completed_at_server TIMESTAMPTZ,
  expected_duration_minutes INTEGER NOT NULL,
  actual_duration_minutes INTEGER,
  photo_url TEXT,
  photo_required BOOLEAN DEFAULT false,
  worker_remark TEXT,
  supervisor_remark TEXT,
  room_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pause records table
CREATE TABLE IF NOT EXISTS public.pause_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  paused_at_client TIMESTAMPTZ,
  paused_at_server TIMESTAMPTZ DEFAULT NOW(),
  resumed_at_client TIMESTAMPTZ,
  resumed_at_server TIMESTAMPTZ,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit logs table (append-only)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id),
  action TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT,
  timestamp_client TIMESTAMPTZ,
  timestamp_server TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pause_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view all users"
  ON public.users FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

-- RLS Policies for tasks table
-- Workers can only see their assigned tasks
CREATE POLICY "Workers see own tasks"
  ON public.tasks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role = 'worker'
      AND auth.uid() = tasks.assigned_to_user_id
    )
  );

-- Supervisors can see all tasks in their department
CREATE POLICY "Supervisors see department tasks"
  ON public.tasks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u1
      JOIN public.users u2 ON u2.id = tasks.assigned_to_user_id
      WHERE u1.id = auth.uid() 
      AND u1.role = 'supervisor'
      AND u1.department = u2.department
    )
  );

-- Front office and admins can see all tasks
CREATE POLICY "Front office and admins see all tasks"
  ON public.tasks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('front_office', 'admin')
    )
  );

-- Workers can update their own assigned tasks
CREATE POLICY "Workers update own tasks"
  ON public.tasks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role = 'worker'
      AND auth.uid() = tasks.assigned_to_user_id
    )
  );

-- Supervisors can update tasks in their department
CREATE POLICY "Supervisors update department tasks"
  ON public.tasks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u1
      JOIN public.users u2 ON u2.id = tasks.assigned_to_user_id
      WHERE u1.id = auth.uid() 
      AND u1.role = 'supervisor'
      AND u1.department = u2.department
    )
  );

-- Front office can create and update all tasks
CREATE POLICY "Front office creates tasks"
  ON public.tasks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('front_office', 'admin')
    )
  );

CREATE POLICY "Front office updates all tasks"
  ON public.tasks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('front_office', 'admin')
    )
  );

-- RLS Policies for pause_records
CREATE POLICY "Users see pause records for accessible tasks"
  ON public.pause_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks 
      WHERE tasks.id = pause_records.task_id
    )
  );

CREATE POLICY "Workers insert pause records for own tasks"
  ON public.pause_records FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tasks 
      WHERE tasks.id = pause_records.task_id
      AND tasks.assigned_to_user_id = auth.uid()
    )
  );

CREATE POLICY "Workers update pause records for own tasks"
  ON public.pause_records FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks 
      WHERE tasks.id = pause_records.task_id
      AND tasks.assigned_to_user_id = auth.uid()
    )
  );

-- RLS Policies for audit_logs (read-only for most, insert for all authenticated)
CREATE POLICY "Users see audit logs for accessible tasks"
  ON public.audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks 
      WHERE tasks.id = audit_logs.task_id
    )
  );

CREATE POLICY "Authenticated users insert audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON public.tasks(priority_level);
CREATE INDEX IF NOT EXISTS idx_pause_records_task_id ON public.pause_records(task_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_task_id ON public.audit_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
