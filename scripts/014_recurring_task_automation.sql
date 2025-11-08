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
  v_days_to_add INT;
BEGIN
  -- Only process if task was marked as completed or verified AND is recurring
  IF (NEW.status IN ('completed', 'verified'))
    AND NEW.custom_task_is_recurring = true
    AND NEW.custom_task_recurring_frequency IS NOT NULL
  THEN
    -- Calculate days to add based on frequency
    v_days_to_add := CASE NEW.custom_task_recurring_frequency
      WHEN 'daily' THEN 1
      WHEN 'weekly' THEN 7
      WHEN 'biweekly' THEN 14
      WHEN 'monthly' THEN 30
      ELSE 1
    END;

    -- Generate new task with all the same custom properties
    INSERT INTO public.tasks (
      id,
      task_type,
      room_number,
      status,
      priority_level,
      assigned_to_user_id,
      assigned_by_user_id,
      created_at,
      updated_at,
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
      NOW() AT TIME ZONE 'UTC',                 -- Current timestamp
      NOW() AT TIME ZONE 'UTC',                 -- Current timestamp
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

    RAISE LOG 'Recurring task regenerated: % → frequency: %', 
      NEW.id, NEW.custom_task_recurring_frequency;
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
