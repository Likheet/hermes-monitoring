-- Seed data for shifts (example shift schedules)

-- Worker 1 (John Smith) - Morning shift, weekdays
INSERT INTO shifts (worker_id, shift_start, shift_end, days_of_week, effective_from)
SELECT 
  id,
  '08:00:00'::TIME,
  '16:00:00'::TIME,
  ARRAY[1, 2, 3, 4, 5], -- Monday to Friday
  CURRENT_DATE
FROM users
WHERE name = 'John Smith' AND role = 'worker'
ON CONFLICT DO NOTHING;

-- Worker 2 (Sarah Johnson) - Afternoon shift, weekdays
INSERT INTO shifts (worker_id, shift_start, shift_end, days_of_week, effective_from)
SELECT 
  id,
  '14:00:00'::TIME,
  '22:00:00'::TIME,
  ARRAY[1, 2, 3, 4, 5], -- Monday to Friday
  CURRENT_DATE
FROM users
WHERE name = 'Sarah Johnson' AND role = 'worker'
ON CONFLICT DO NOTHING;
