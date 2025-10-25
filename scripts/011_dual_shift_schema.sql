-- Dual Shift System Migration
-- Replaces single shift with dual shifts (shift_1 and shift_2) to allow flexible scheduling

-- First, create a backup of existing shift_schedules
CREATE TABLE IF NOT EXISTS shift_schedules_backup AS 
SELECT * FROM shift_schedules;

-- Add new columns for dual shift support
ALTER TABLE shift_schedules 
ADD COLUMN IF NOT EXISTS shift_1_start TIME,
ADD COLUMN IF NOT EXISTS shift_1_end TIME,
ADD COLUMN IF NOT EXISTS shift_1_break_start TIME,
ADD COLUMN IF NOT EXISTS shift_1_break_end TIME,
ADD COLUMN IF NOT EXISTS shift_2_start TIME,
ADD COLUMN IF NOT EXISTS shift_2_end TIME,
ADD COLUMN IF NOT EXISTS shift_2_break_start TIME,
ADD COLUMN IF NOT EXISTS shift_2_break_end TIME,
ADD COLUMN IF NOT EXISTS has_shift_2 BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_dual_shift BOOLEAN DEFAULT false;

-- Migrate existing single shift data to shift_1
UPDATE shift_schedules 
SET 
  shift_1_start = shift_start,
  shift_1_end = shift_end,
  shift_1_break_start = break_start,
  shift_1_break_end = break_end,
  is_dual_shift = false
WHERE shift_1_start IS NULL;

-- Create a function to validate dual shift times
CREATE OR REPLACE FUNCTION validate_dual_shift_times(
  p_shift_1_start TIME,
  p_shift_1_end TIME,
  p_shift_1_break_start TIME,
  p_shift_1_break_end TIME,
  p_shift_2_start TIME,
  p_shift_2_end TIME,
  p_shift_2_break_start TIME,
  p_shift_2_break_end TIME,
  p_has_shift_2 BOOLEAN
) RETURNS BOOLEAN AS $$
DECLARE
  shift_1_duration INTEGER;
  shift_2_duration INTEGER;
  break_1_duration INTEGER;
  break_2_duration INTEGER;
  shift_1_start_minutes INTEGER;
  shift_1_end_minutes INTEGER;
  shift_2_start_minutes INTEGER;
  shift_2_end_minutes INTEGER;
BEGIN
  -- Calculate shift 1 duration in minutes
  shift_1_start_minutes := EXTRACT(HOUR FROM p_shift_1_start) * 60 + EXTRACT(MINUTE FROM p_shift_1_start);
  shift_1_end_minutes := EXTRACT(HOUR FROM p_shift_1_end) * 60 + EXTRACT(MINUTE FROM p_shift_1_end);
  
  IF shift_1_end_minutes < shift_1_start_minutes THEN
    shift_1_duration := (24 * 60 - shift_1_start_minutes) + shift_1_end_minutes;
  ELSE
    shift_1_duration := shift_1_end_minutes - shift_1_start_minutes;
  END IF;
  
  -- Validate shift 1 duration (should be reasonable, e.g., 1-12 hours)
  IF shift_1_duration < 60 OR shift_1_duration > 720 THEN
    RETURN FALSE;
  END IF;
  
  -- Validate break 1 if present
  IF p_shift_1_break_start IS NOT NULL AND p_shift_1_break_end IS NOT NULL THEN
    break_1_duration := EXTRACT(HOUR FROM p_shift_1_break_end) * 60 + EXTRACT(MINUTE FROM p_shift_1_break_end) -
                     (EXTRACT(HOUR FROM p_shift_1_break_start) * 60 + EXTRACT(MINUTE FROM p_shift_1_break_start));
    
    -- Allow more flexible break durations (up to 4 hours for dual shifts)
    IF break_1_duration < 0 OR break_1_duration > 240 THEN
      RETURN FALSE;
    END IF;
  END IF;
  
  -- Validate shift 2 if present
  IF p_has_shift_2 THEN
    IF p_shift_2_start IS NULL OR p_shift_2_end IS NULL THEN
      RETURN FALSE;
    END IF;
    
    shift_2_start_minutes := EXTRACT(HOUR FROM p_shift_2_start) * 60 + EXTRACT(MINUTE FROM p_shift_2_start);
    shift_2_end_minutes := EXTRACT(HOUR FROM p_shift_2_end) * 60 + EXTRACT(MINUTE FROM p_shift_2_end);
    
    IF shift_2_end_minutes < shift_2_start_minutes THEN
      shift_2_duration := (24 * 60 - shift_2_start_minutes) + shift_2_end_minutes;
    ELSE
      shift_2_duration := shift_2_end_minutes - shift_2_start_minutes;
    END IF;
    
    -- Validate shift 2 duration
    IF shift_2_duration < 60 OR shift_2_duration > 720 THEN
      RETURN FALSE;
    END IF;
    
    -- Validate break 2 if present
    IF p_shift_2_break_start IS NOT NULL AND p_shift_2_break_end IS NOT NULL THEN
      break_2_duration := EXTRACT(HOUR FROM p_shift_2_break_end) * 60 + EXTRACT(MINUTE FROM p_shift_2_break_end) -
                       (EXTRACT(HOUR FROM p_shift_2_break_start) * 60 + EXTRACT(MINUTE FROM p_shift_2_break_start));
      
      IF break_2_duration < 0 OR break_2_duration > 240 THEN
        RETURN FALSE;
      END IF;
    END IF;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Create a function to check for overlapping shifts
CREATE OR REPLACE FUNCTION check_shift_overlap(
  p_worker_id UUID,
  p_schedule_date DATE,
  p_shift_1_start TIME,
  p_shift_1_end TIME,
  p_shift_2_start TIME,
  p_shift_2_end TIME,
  p_has_shift_2 BOOLEAN,
  p_schedule_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  overlap_count INTEGER;
BEGIN
  -- Check for overlapping shifts with existing schedules
  SELECT COUNT(*) INTO overlap_count
  FROM shift_schedules
  WHERE worker_id = p_worker_id
    AND schedule_date = p_schedule_date
    AND (p_schedule_id IS NULL OR id != p_schedule_id)
    AND (
      -- Check shift 1 overlap with existing shift 1
      (shift_1_start IS NOT NULL AND shift_1_end IS NOT NULL AND (
        (p_shift_1_start >= shift_1_start AND p_shift_1_start < shift_1_end) OR
        (p_shift_1_end > shift_1_start AND p_shift_1_end <= shift_1_end) OR
        (p_shift_1_start <= shift_1_start AND p_shift_1_end >= shift_1_end)
      ))
      OR
      -- Check shift 1 overlap with existing shift 2
      (shift_2_start IS NOT NULL AND shift_2_end IS NOT NULL AND p_has_shift_2 AND (
        (p_shift_1_start >= shift_2_start AND p_shift_1_start < shift_2_end) OR
        (p_shift_1_end > shift_2_start AND p_shift_1_end <= shift_2_end) OR
        (p_shift_1_start <= shift_2_start AND p_shift_1_end >= shift_2_end)
      ))
      OR
      -- Check shift 2 overlap with existing shift 1 (if shift 2 exists)
      (p_has_shift_2 AND shift_1_start IS NOT NULL AND shift_1_end IS NOT NULL AND (
        (p_shift_2_start >= shift_1_start AND p_shift_2_start < shift_1_end) OR
        (p_shift_2_end > shift_1_start AND p_shift_2_end <= shift_1_end) OR
        (p_shift_2_start <= shift_1_start AND p_shift_2_end >= shift_1_end)
      ))
      OR
      -- Check shift 2 overlap with existing shift 2 (if both have shift 2)
      (p_has_shift_2 AND has_shift_2 AND shift_2_start IS NOT NULL AND shift_2_end IS NOT NULL AND (
        (p_shift_2_start >= shift_2_start AND p_shift_2_start < shift_2_end) OR
        (p_shift_2_end > shift_2_start AND p_shift_2_end <= shift_2_end) OR
        (p_shift_2_start <= shift_2_start AND p_shift_2_end >= shift_2_end)
      ))
    );
  
  RETURN overlap_count = 0;
END;
$$ LANGUAGE plpgsql;

-- Add constraints for dual shift validation
ALTER TABLE shift_schedules 
ADD CONSTRAINT check_dual_shift_times 
  CHECK (validate_dual_shift_times(
    shift_1_start, shift_1_end, shift_1_break_start, shift_1_break_end,
    shift_2_start, shift_2_end, shift_2_break_start, shift_2_break_end,
    has_shift_2
  ));

-- Add index for better performance on dual shift queries
CREATE INDEX IF NOT EXISTS idx_shift_schedules_worker_date_dual ON shift_schedules(worker_id, schedule_date, is_dual_shift);

-- Create a view for backward compatibility with existing single-shift queries
CREATE OR REPLACE VIEW shift_schedules_legacy AS
SELECT 
  id,
  worker_id,
  schedule_date,
  COALESCE(shift_1_start, shift_start) as shift_start,
  COALESCE(shift_1_end, shift_end) as shift_end,
  COALESCE(shift_1_break_start, break_start) as break_start,
  COALESCE(shift_1_break_end, break_end) as break_end,
  is_override,
  override_reason,
  notes,
  created_at
FROM shift_schedules;

-- Update the existing unique constraint to work with dual shifts
ALTER TABLE shift_schedules DROP CONSTRAINT IF EXISTS shift_schedules_worker_id_schedule_date_key;
ALTER TABLE shift_schedules ADD CONSTRAINT shift_schedules_worker_id_schedule_date_key UNIQUE (worker_id, schedule_date);

-- Grant necessary permissions (adjust as needed for your setup)
-- GRANT ALL ON shift_schedules TO authenticated;
-- GRANT SELECT ON shift_schedules TO anon;

SELECT 'Dual shift schema migration completed successfully!' as message;
