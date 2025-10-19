-- Seed sample tasks for testing

INSERT INTO public.tasks (
  task_type, 
  priority_level, 
  status, 
  assigned_to_user_id, 
  assigned_by_user_id,
  expected_duration_minutes,
  room_number,
  photo_required
)
VALUES
  -- Housekeeping tasks
  ('Room Cleaning', 'DAILY_TASK', 'PENDING', '00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000002', 30, '101', false),
  ('Deep Cleaning', 'TIME_SENSITIVE', 'PENDING', '00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000003', 60, '102', true),
  ('Linen Change', 'DAILY_TASK', 'IN_PROGRESS', '00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000002', 20, '103', false),
  
  -- Maintenance tasks
  ('AC Repair', 'GUEST_REQUEST', 'PENDING', '00000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000002', 45, '201', true),
  ('Plumbing Fix', 'TIME_SENSITIVE', 'IN_PROGRESS', '00000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000004', 90, '202', true),
  ('Electrical Check', 'PREVENTIVE_MAINTENANCE', 'PENDING', '00000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000004', 30, '203', false);

-- Log the seed operation
INSERT INTO public.audit_logs (user_id, action, metadata)
VALUES ('00000000-0000-0000-0000-000000000001', 'SEED_TASKS', '{"count": 6, "script": "04-seed-tasks.sql"}'::jsonb);

SELECT 
  'Tasks seeded successfully' AS status,
  COUNT(*) AS task_count,
  json_agg(json_build_object('type', task_type, 'status', status, 'room', room_number)) AS tasks
FROM public.tasks;
