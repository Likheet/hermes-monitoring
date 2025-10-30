-- Remove unused timer validation column from tasks
ALTER TABLE public.tasks
  DROP COLUMN IF EXISTS timer_validation_flag;
