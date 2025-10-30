-- Seed shift schedules for the next 7 days

INSERT INTO public.shift_schedules (
  id,
  worker_id,
  schedule_date,
  shift_start,
  shift_end,
  has_break,
  break_start,
  break_end,
  is_override,
  created_by,
  created_at
)
SELECT
  gen_random_uuid(),
  u.id,
  CURRENT_DATE + (d || ' days')::interval,
  '08:00:00'::time,
  '16:00:00'::time,
  true,
  '12:00:00'::time,
  '13:00:00'::time,
  false,
  '00000000-0000-0000-0000-000000000001', -- Created by admin
  NOW()
FROM public.users u
CROSS JOIN generate_series(0, 6) as d
WHERE u.role = 'worker'
ON CONFLICT DO NOTHING;

SELECT 
  'Shift schedules seeded successfully' as status,
  COUNT(*) as schedule_count,
  COUNT(DISTINCT worker_id) as worker_count,
  MIN(schedule_date) as start_date,
  MAX(schedule_date) as end_date
FROM public.shift_schedules;
