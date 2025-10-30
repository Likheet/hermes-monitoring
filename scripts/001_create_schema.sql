-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table (app-owned shadow of auth.users.id and service accounts)
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  name text NOT NULL,
  role text NOT NULL CHECK (role IN ('worker', 'supervisor', 'front_office', 'admin')),
  phone text,
  department text CHECK ((department IN ('housekeeping', 'maintenance')) OR department IS NULL),
  shift_timing text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Operational task ledger (aligns with v2 application schema)
CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type text NOT NULL,
  room_number text,
  status text NOT NULL CHECK (status IN ('pending', 'assigned', 'in_progress', 'paused', 'completed', 'verified', 'rejected')),
  priority_level text CHECK ((priority_level IN ('low', 'medium', 'high', 'urgent')) OR priority_level IS NULL),
  assigned_to_user_id uuid REFERENCES public.users(id),
  assigned_by_user_id uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  verified_at timestamptz,
  verified_by_user_id uuid REFERENCES public.users(id),
  assigned_at jsonb,
  description text,
  special_instructions text,
  estimated_duration integer,
  actual_duration integer,
  categorized_photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  worker_remarks text,
  supervisor_remarks text,
  quality_rating integer CHECK (quality_rating BETWEEN 1 AND 5),
  requires_verification boolean NOT NULL DEFAULT false,
  timer_validation_flag boolean NOT NULL DEFAULT false,
  audit_log jsonb NOT NULL DEFAULT '[]'::jsonb,
  pause_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  photo_requirements jsonb NOT NULL DEFAULT '[]'::jsonb,
  department text CHECK ((department IN ('housekeeping', 'maintenance', 'front_desk')) OR department IS NULL),
  is_custom_task boolean NOT NULL DEFAULT false,
  custom_task_name text,
  custom_task_category text,
  custom_task_priority text,
  custom_task_photo_required boolean,
  custom_task_photo_count integer,
  custom_task_is_recurring boolean NOT NULL DEFAULT false,
  custom_task_recurring_frequency text,
  custom_task_requires_specific_time boolean NOT NULL DEFAULT false,
  custom_task_recurring_time time
);

-- Pause history audit trail for legacy flows (still referenced by reporting)
CREATE TABLE IF NOT EXISTS public.pause_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  paused_at jsonb NOT NULL DEFAULT '{}'::jsonb,
  resumed_at jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index suite tuned to observed pg_stat_user_indexes usage
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_updated_at ON public.tasks(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON public.tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pause_records_task ON public.pause_records(task_id);
