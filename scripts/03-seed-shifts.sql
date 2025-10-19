-- Seed shift schedules for the next 7 days

INSERT INTO public.shift_schedules (user_id, date, shift_start, shift_end)
SELECT 
  u.id,
  CURRENT_DATE + (d || ' days')::interval,
  CASE 
    WHEN u.shift_timing LIKE '07:00%' THEN '07:00'::time
    WHEN u.shift_timing LIKE '08:00%' THEN '08:00'::time
    WHEN u.shift_timing LIKE '15:00%' THEN '15:00'::time
    WHEN u.shift_timing LIKE '16:00%' THEN '16:00'::time
    ELSE '08:00'::time
  END,
  CASE 
    WHEN u.shift_timing LIKE '%15:00' THEN '15:00'::time
    WHEN u.shift_timing LIKE '%16:00' THEN '16:00'::time
    WHEN u.shift_timing LIKE '%20:00' THEN '20:00'::time
    WHEN u.shift_timing LIKE '%23:00' THEN '23:00'::time
    WHEN u.shift_timing LIKE '%00:00' THEN '00:00'::time
    ELSE '17:00'::time
  END
FROM public.users u
CROSS JOIN generate_series(0, 6) AS d
WHERE u.shift_timing IS NOT NULL
ON CONFLICT (user_id, date) DO NOTHING;

SELECT 
  'Shift schedules seeded successfully' AS status,
  COUNT(*) AS schedule_count
FROM public.shift_schedules;
