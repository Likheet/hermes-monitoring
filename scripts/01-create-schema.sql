-- Create fresh schema without auth.users dependency
-- This allows us to use simple UUID primary keys

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (standalone, no auth.users dependency)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL, -- In production, this should be hashed
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

-- Shift schedules table
CREATE TABLE IF NOT EXISTS public.shift_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  shift_start TIME NOT NULL,
  shift_end TIME NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Maintenance schedules table
CREATE TABLE IF NOT EXISTS public.maintenance_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ac_location TEXT NOT NULL,
  task_type TEXT NOT NULL,
  period_month INTEGER CHECK (period_month BETWEEN 1 AND 12),
  period_year INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Maintenance tasks table
CREATE TABLE IF NOT EXISTS public.maintenance_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID REFERENCES public.maintenance_schedules(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES public.users(id),
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED')),
  ac_location TEXT NOT NULL,
  task_type TEXT NOT NULL,
  room_number TEXT,
  period_month INTEGER,
  period_year INTEGER NOT NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  photos JSONB,
  timer_duration INTEGER,
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

-- Audit logs table
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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_department ON public.users(department);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON public.tasks(priority_level);
CREATE INDEX IF NOT EXISTS idx_shift_schedules_user_date ON public.shift_schedules(user_id, date);
CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_assigned ON public.maintenance_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_pause_records_task_id ON public.pause_records(task_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_task_id ON public.audit_logs(task_id);

SELECT 'Schema created successfully' AS status;
