-- Seed shift schedules for workers (7 days)
-- Only workers need shift schedules (not admin, front_office, or supervisors)

-- Clear existing shift schedules
TRUNCATE TABLE shift_schedules CASCADE;

-- Generate 7 days of shifts for both workers
-- Cast worker_id strings to UUID type
INSERT INTO shift_schedules (
  id,
  worker_id,
  schedule_date,
  shift_start,
  shift_end,
  break_start,
  break_end,
  is_override,
  override_reason,
  created_at
)
SELECT 
  gen_random_uuid(),
  worker_id::uuid,  -- Cast to UUID
  CURRENT_DATE + (day_offset || ' days')::interval,
  '08:00:00'::time,
  '16:00:00'::time,
  '12:00:00'::time,
  '13:00:00'::time,
  false,
  NULL,
  NOW()
FROM 
  (VALUES 
    ('00000000-0000-0000-0000-000000000004'), -- HK Worker
    ('00000000-0000-0000-0000-000000000005')  -- Maintenance Worker
  ) AS workers(worker_id),
  generate_series(0, 6) AS day_offset;

-- Log the seed operation
INSERT INTO audit_logs (task_id, user_id, action, metadata, created_at)
VALUES 
  (NULL, '00000000-0000-0000-0000-000000000001'::uuid, 'seed_shifts', 
   '{"days": 7, "workers": 2, "script": "03-seed-shifts.sql"}'::jsonb, NOW());

-- Return summary
SELECT 
  'Shift schedules seeded successfully' as message,
  COUNT(*) as total_shifts,
  COUNT(DISTINCT worker_id) as workers_with_shifts,
  MIN(schedule_date) as first_date,
  MAX(schedule_date) as last_date
FROM shift_schedules;
