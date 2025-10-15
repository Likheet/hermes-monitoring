-- Escalation Detection Function (runs via pg_cron every 60 seconds)
-- This function checks all IN_PROGRESS tasks and creates escalation records

CREATE OR REPLACE FUNCTION check_task_escalations()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  task_record RECORD;
  elapsed_minutes INTEGER;
  total_pause_minutes INTEGER;
  active_minutes INTEGER;
  escalation_level INTEGER;
  existing_escalation RECORD;
BEGIN
  -- Loop through all IN_PROGRESS tasks
  FOR task_record IN 
    SELECT 
      t.id,
      t.assigned_to_user_id,
      t.started_at_server,
      t.expected_duration_minutes,
      t.status
    FROM tasks t
    WHERE t.status = 'IN_PROGRESS'
      AND t.started_at_server IS NOT NULL
  LOOP
    -- Calculate elapsed time since task started
    elapsed_minutes := EXTRACT(EPOCH FROM (NOW() - task_record.started_at_server)) / 60;
    
    -- Calculate total pause time
    SELECT COALESCE(SUM(
      CASE 
        WHEN resumed_at_server IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (resumed_at_server - paused_at_server)) / 60
        ELSE EXTRACT(EPOCH FROM (NOW() - paused_at_server)) / 60
      END
    ), 0) INTO total_pause_minutes
    FROM pause_records
    WHERE task_id = task_record.id;
    
    -- Calculate active working time (excluding pauses)
    active_minutes := elapsed_minutes - total_pause_minutes;
    
    -- Determine escalation level
    escalation_level := NULL;
    
    IF active_minutes >= (task_record.expected_duration_minutes * 1.5) THEN
      -- Level 3: 50% overtime
      escalation_level := 3;
    ELSIF active_minutes >= 20 THEN
      -- Level 2: 20 minutes
      escalation_level := 2;
    ELSIF active_minutes >= 15 THEN
      -- Level 1: 15 minutes
      escalation_level := 1;
    END IF;
    
    -- If escalation detected, check if we need to create/update record
    IF escalation_level IS NOT NULL THEN
      -- Check if escalation already exists for this level
      SELECT * INTO existing_escalation
      FROM escalations
      WHERE task_id = task_record.id
        AND level = escalation_level
        AND resolved = false
      LIMIT 1;
      
      -- Create escalation if it doesn't exist
      IF existing_escalation IS NULL THEN
        INSERT INTO escalations (
          task_id,
          worker_id,
          level,
          timestamp_server,
          resolved
        ) VALUES (
          task_record.id,
          task_record.assigned_to_user_id,
          escalation_level,
          NOW(),
          false
        );
        
        -- Log to audit trail
        INSERT INTO audit_logs (
          task_id,
          user_id,
          action,
          timestamp_server,
          metadata
        ) VALUES (
          task_record.id,
          task_record.assigned_to_user_id,
          'ESCALATION_CREATED',
          NOW(),
          jsonb_build_object(
            'level', escalation_level,
            'active_minutes', active_minutes,
            'expected_minutes', task_record.expected_duration_minutes
          )
        );
      END IF;
    END IF;
  END LOOP;
END;
$$;

-- Note: To enable this function to run automatically every 60 seconds,
-- you need to enable pg_cron extension and create a cron job.
-- This can be done from the Supabase dashboard under Database > Extensions
-- Then run: SELECT cron.schedule('check-escalations', '60 seconds', 'SELECT check_task_escalations();');
