-- ============================================================================
-- Migration: 014_recurring_task_automation.sql
-- Purpose: Implement automatic recurring task generation on completion
-- Date: November 8, 2025
-- ============================================================================

-- Enable pgcrypto if not already enabled (for gen_random_uuid)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- FUNCTION: regenerate_recurring_task()
-- ============================================================================
-- Triggers when a recurring custom task is marked as completed or verified
-- Automatically creates the next instance with same properties

CREATE OR REPLACE FUNCTION regenerate_recurring_task()
RETURNS TRIGGER AS $$
DECLARE
  v_new_task_id UUID;
  v_next_timestamp TIMESTAMPTZ;
  v_completed_at TIMESTAMPTZ;
  v_recurring_time TIME WITHOUT TIME ZONE;
  v_assigned_at JSONB;
  v_target_days TEXT[];
  v_candidate_date TIMESTAMPTZ;
  v_current_day TEXT;
  v_loop_counter INT := 0;
BEGIN
  -- Only process if task was marked as completed or verified AND is recurring
  IF (NEW.status IN ('completed', 'verified'))
    AND NEW.custom_task_is_recurring = true
    AND NEW.custom_task_recurring_frequency IS NOT NULL
  THEN
    -- Determine the completed timestamp (fallback to NOW to prevent NULL handling)
    v_completed_at := COALESCE(NEW.completed_at, NEW.verified_at, NOW() AT TIME ZONE 'UTC');

    -- Normalize recurring target time
    v_recurring_time := NULL;
    IF NEW.custom_task_requires_specific_time IS TRUE AND NEW.custom_task_recurring_time IS NOT NULL THEN
      v_recurring_time := NEW.custom_task_recurring_time;
    ELSIF NEW.assigned_at IS NOT NULL THEN
      BEGIN
        v_recurring_time := (NEW.assigned_at ->> 'server')::TIME;
      EXCEPTION WHEN OTHERS THEN
        v_recurring_time := NULL;
      END;
    END IF;

    IF v_recurring_time IS NULL THEN
      v_recurring_time := (v_completed_at AT TIME ZONE 'UTC')::TIME;
    END IF;

    -- Prepare custom weekday list when provided
    IF NEW.custom_task_recurring_days IS NOT NULL AND jsonb_array_length(to_jsonb(NEW.custom_task_recurring_days)) > 0 THEN
      v_target_days := ARRAY(
        SELECT lower(trim(value))
        FROM jsonb_array_elements_text(to_jsonb(NEW.custom_task_recurring_days)) AS value
      );
    ELSE
      v_target_days := NULL;
    END IF;

    -- Calculate the next due timestamp
    IF v_target_days IS NOT NULL THEN
      -- When explicit weekdays are provided, walk forward until the next matching day
      v_candidate_date := date_trunc('day', v_completed_at) + INTERVAL '1 day';
      LOOP
        v_loop_counter := v_loop_counter + 1;
        v_current_day := lower(trim(to_char(v_candidate_date, 'dy')));
        IF v_current_day = ANY(v_target_days) THEN
          EXIT;
        END IF;

        v_candidate_date := v_candidate_date + INTERVAL '1 day';
        IF v_loop_counter > 28 THEN
          -- Failsafe: default to next day if something goes wrong
          EXIT;
        END IF;
      END LOOP;

      v_next_timestamp := date_trunc('day', v_candidate_date) + v_recurring_time;
    ELSE
      -- Fallback to frequency-based increments
      CASE NEW.custom_task_recurring_frequency
        WHEN 'weekly' THEN
          v_next_timestamp := v_completed_at + INTERVAL '1 week';
        WHEN 'biweekly' THEN
          v_next_timestamp := v_completed_at + INTERVAL '2 weeks';
        WHEN 'monthly' THEN
          v_next_timestamp := v_completed_at + INTERVAL '1 month';
        ELSE
          v_next_timestamp := v_completed_at + INTERVAL '1 day';
      END CASE;

      IF NEW.custom_task_requires_specific_time IS TRUE THEN
        v_next_timestamp := date_trunc('day', v_next_timestamp) + v_recurring_time;
      END IF;
    END IF;

    -- Ensure the scheduled time is strictly in the future
    WHILE v_next_timestamp <= v_completed_at LOOP
      v_next_timestamp := v_next_timestamp + INTERVAL '1 day';
      IF NEW.custom_task_requires_specific_time IS TRUE THEN
        v_next_timestamp := date_trunc('day', v_next_timestamp) + v_recurring_time;
      END IF;
    END LOOP;

    -- Prepare DualTimestamp JSON for assigned_at
    v_assigned_at := jsonb_build_object(
      'server', to_char(v_next_timestamp AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'client', to_char(v_next_timestamp AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    );

    -- Generate new task with all the same custom properties
    INSERT INTO public.tasks (
      id,
      task_type,
      room_number,
      status,
      priority_level,
      assigned_to_user_id,
      assigned_by_user_id,
      assigned_at,
      created_at,
      updated_at,
      department,
      is_custom_task,
      custom_task_name,
      custom_task_category,
      custom_task_priority,
      custom_task_photo_required,
      custom_task_photo_count,
      custom_task_is_recurring,
      custom_task_recurring_frequency,
      custom_task_requires_specific_time,
      custom_task_recurring_time,
      custom_task_recurring_days,
      requires_verification,
      photo_requirements,
      estimated_duration,
      audit_log
    ) VALUES (
      gen_random_uuid(),                        -- New UUID
      NEW.task_type,                            -- Same task type
      NEW.room_number,                          -- Same room (if any)
      'pending',                                -- Fresh pending status
      NEW.priority_level,                       -- Same priority
      NEW.assigned_to_user_id,                  -- Keep same assignee (auto-recurring)
      NEW.assigned_by_user_id,                  -- Original creator
      v_assigned_at,                            -- Schedule for the next occurrence
      NOW() AT TIME ZONE 'UTC',                 -- Current timestamp
      NOW() AT TIME ZONE 'UTC',                 -- Current timestamp
      NEW.department,                           -- Preserve department
      true,                                     -- Is custom task
      NEW.custom_task_name,                     -- Same name
      NEW.custom_task_category,                 -- Same category
      NEW.custom_task_priority,                 -- Same priority label
      NEW.custom_task_photo_required,           -- Same photo requirement
      NEW.custom_task_photo_count,              -- Same photo count
      true,                                     -- Keep recurring flag
      NEW.custom_task_recurring_frequency,      -- Same frequency
      NEW.custom_task_requires_specific_time,   -- Same time requirement
      NEW.custom_task_recurring_time,           -- Same time
      NEW.custom_task_recurring_days,           -- Same custom weekday selection
      NEW.requires_verification,                -- Same verification requirement
      NEW.photo_requirements,                   -- Same photo requirements JSON
      NEW.estimated_duration,                   -- Same estimated duration
      jsonb_build_object(
        'auto_generated', true,
        'generated_from_task_id', NEW.id::text,
        'generation_timestamp', NOW() AT TIME ZONE 'UTC',
        'frequency', NEW.custom_task_recurring_frequency,
        'parent_completed_status', NEW.status
      )                                         -- Track lineage in audit log
    );

    RAISE LOG 'Recurring task regenerated: % → frequency: % → next at %', 
      NEW.id, NEW.custom_task_recurring_frequency, v_next_timestamp;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGER: after_recurring_task_completion
-- ============================================================================
-- Fires after ANY task UPDATE, checks if it was a recurring task completion

DROP TRIGGER IF EXISTS after_recurring_task_completion ON public.tasks;

CREATE TRIGGER after_recurring_task_completion
AFTER UPDATE ON public.tasks
FOR EACH ROW
WHEN (NEW.status != OLD.status)  -- Only when status changes
EXECUTE FUNCTION regenerate_recurring_task();

RAISE NOTICE 'Recurring task automation enabled: Trigger created on tasks table';
