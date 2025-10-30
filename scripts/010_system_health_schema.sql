-- System health metrics schema aligned with the live Supabase database.
CREATE TABLE IF NOT EXISTS public.system_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name text,
  metric_value numeric NOT NULL,
  metric_type text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_metrics_type ON public.system_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_system_metrics_recorded_at ON public.system_metrics(recorded_at DESC);

CREATE OR REPLACE FUNCTION public.get_database_size()
RETURNS numeric
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN pg_database_size(current_database()) / (1024 * 1024);
END;
$$;

-- Archival table used for manual clean-up jobs; matches current production columns.
CREATE TABLE IF NOT EXISTS public.archived_tasks (
  id uuid PRIMARY KEY,
  task_type text NOT NULL,
  room_number text,
  status text NOT NULL,
  priority_level text,
  assigned_to_user_id uuid,
  assigned_by_user_id uuid,
  created_at timestamptz,
  completed_at timestamptz,
  verified_at timestamptz,
  actual_duration integer,
  quality_rating integer CHECK (quality_rating BETWEEN 1 AND 5 OR quality_rating IS NULL),
  archived_at timestamptz NOT NULL DEFAULT now(),
  archive_reason text
);
