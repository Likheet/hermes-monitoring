-- Seed sample tasks for testing

INSERT INTO public.tasks (
  id,
  task_type,
  priority_level,
  status,
  assigned_to_user_id,
  assigned_by_user_id,
  assigned_at_client,
  assigned_at_server,
  expected_duration_minutes,
  photo_required,
  room_number,
  created_at
)
VALUES
  -- Housekeeping tasks
  (
    gen_random_uuid(),
    'Room Cleaning',
    'DAILY_TASK',
    'PENDING',
    '00000000-0000-0000-0000-000000000005', -- Maria Garcia
    '00000000-0000-0000-0000-000000000002', -- Front Office
    NOW(),
    NOW(),
    30,
    true,
    '101',
    NOW()
  ),
  (
    gen_random_uuid(),
    'Deep Cleaning',
    'TIME_SENSITIVE',
    'PENDING',
    '00000000-0000-0000-0000-000000000006', -- John Smith
    '00000000-0000-0000-0000-000000000002', -- Front Office
    NOW(),
    NOW(),
    60,
    true,
    '205',
    NOW()
  ),
  (
    gen_random_uuid(),
    'Turndown Service',
    'GUEST_REQUEST',
    'PENDING',
    '00000000-0000-0000-0000-000000000005', -- Maria Garcia
    '00000000-0000-0000-0000-000000000002', -- Front Office
    NOW(),
    NOW(),
    15,
    false,
    '310',
    NOW()
  ),
  
  -- Maintenance tasks
  (
    gen_random_uuid(),
    'AC Repair',
    'GUEST_REQUEST',
    'PENDING',
    '00000000-0000-0000-0000-000000000007', -- Mike Johnson
    '00000000-0000-0000-0000-000000000002', -- Front Office
    NOW(),
    NOW(),
    45,
    true,
    '102',
    NOW()
  ),
  (
    gen_random_uuid(),
    'Plumbing Check',
    'PREVENTIVE_MAINTENANCE',
    'PENDING',
    '00000000-0000-0000-0000-000000000008', -- Sarah Lee
    '00000000-0000-0000-0000-000000000002', -- Front Office
    NOW(),
    NOW(),
    30,
    false,
    '203',
    NOW()
  ),
  (
    gen_random_uuid(),
    'Electrical Inspection',
    'TIME_SENSITIVE',
    'PENDING',
    '00000000-0000-0000-0000-000000000007', -- Mike Johnson
    '00000000-0000-0000-0000-000000000002', -- Front Office
    NOW(),
    NOW(),
    40,
    true,
    '405',
    NOW()
  )
ON CONFLICT DO NOTHING;

-- Log the seed operation
INSERT INTO public.audit_logs (user_id, action, metadata, created_at)
VALUES ('00000000-0000-0000-0000-000000000001', 'SEED_TASKS', '{"count": 6, "script": "03-seed-tasks.sql"}'::jsonb, NOW());

SELECT 
  'Tasks seeded successfully' as status,
  COUNT(*) as task_count,
  json_object_agg(status, count) as tasks_by_status
FROM (
  SELECT status, COUNT(*) as count
  FROM public.tasks
  GROUP BY status
) subquery;
