-- Seed shift schedules for the next 7 days
-- This creates default shift schedules for all workers

DO $$
DECLARE
  worker_record RECORD;
  day_offset INTEGER;
  schedule_date DATE;
BEGIN
  -- Loop through all workers
  FOR worker_record IN 
    SELECT id, name, shift_timing FROM users WHERE role = 'worker'
  LOOP
    -- Create schedules for next 7 days
    FOR day_offset IN 0..6 LOOP
      schedule_date := CURRENT_DATE + day_offset;
      
      -- Insert shift schedule
      INSERT INTO shift_schedules (
        id,
        worker_id,
        schedule_date,
        shift_start,
        shift_end,
        has_break,
        break_start,
        break_end,
        is_override,
        created_at,
        updated_at
      )
      VALUES (
        gen_random_uuid(),
        worker_record.id,
        schedule_date,
        '08:00'::time,
        '16:00'::time,
        true,
        '12:00'::time,
        '13:00'::time,
        false,
        NOW(),
        NOW()
      )
      ON CONFLICT DO NOTHING;
      
      RAISE NOTICE 'Created shift schedule for % on %', worker_record.name, schedule_date;
    END LOOP;
  END LOOP;
  
  RAISE NOTICE 'Shift schedules created successfully';
END $$;
