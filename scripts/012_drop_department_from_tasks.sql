-- Remove unused department column from tasks
-- Department is derived from assigned worker, not stored per-task
ALTER TABLE public.tasks
  DROP COLUMN IF EXISTS department;
