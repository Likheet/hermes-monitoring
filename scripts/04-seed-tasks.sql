-- Seed sample tasks for testing
-- Mix of housekeeping and maintenance tasks in different statuses

-- Clear existing tasks
TRUNCATE TABLE tasks CASCADE;

-- Use assigned_at JSONB field instead of separate client/server columns
INSERT INTO tasks (
  id,
  task_type,
  priority_level,
  room_number,
  status,
  assigned_to_user_id,
  assigned_by_user_id,
  assigned_at,
  description,
  estimated_duration,
  requires_verification,
  created_at,
  updated_at
)
VALUES 
  -- Pending housekeeping tasks
  (gen_random_uuid(), 'room_cleaning', 'high', 'A-101', 'pending', 
   '00000000-0000-0000-0000-000000000004'::uuid, 
   '00000000-0000-0000-0000-000000000002'::uuid,
   jsonb_build_object('client', NOW(), 'server', NOW()),
   'Standard room cleaning with fresh linens',
   45,
   true,
   NOW(), NOW()),
  
  (gen_random_uuid(), 'room_cleaning', 'medium', 'A-102', 'pending',
   '00000000-0000-0000-0000-000000000004'::uuid, 
   '00000000-0000-0000-0000-000000000002'::uuid,
   jsonb_build_object('client', NOW(), 'server', NOW()),
   'Quick turnover cleaning',
   30,
   false,
   NOW(), NOW()),

  -- Active housekeeping task
  (gen_random_uuid(), 'deep_cleaning', 'high', 'A-103', 'in_progress',
   '00000000-0000-0000-0000-000000000004'::uuid, 
   '00000000-0000-0000-0000-000000000002'::uuid,
   jsonb_build_object('client', NOW() - interval '30 minutes', 'server', NOW() - interval '30 minutes'),
   'Deep cleaning with carpet shampooing',
   90,
   true,
   NOW() - interval '30 minutes', NOW()),

  -- Pending maintenance tasks
  (gen_random_uuid(), 'ac_repair', 'urgent', 'B-201', 'pending',
   '00000000-0000-0000-0000-000000000005'::uuid, 
   '00000000-0000-0000-0000-000000000002'::uuid,
   jsonb_build_object('client', NOW(), 'server', NOW()),
   'AC not cooling properly - guest complaint',
   60,
   true,
   NOW(), NOW()),

  (gen_random_uuid(), 'plumbing', 'high', 'B-202', 'pending',
   '00000000-0000-0000-0000-000000000005'::uuid, 
   '00000000-0000-0000-0000-000000000002'::uuid,
   jsonb_build_object('client', NOW(), 'server', NOW()),
   'Leaking faucet in bathroom',
   45,
   true,
   NOW(), NOW()),

  -- Completed task (for testing verification)
  (gen_random_uuid(), 'room_cleaning', 'medium', 'A-104', 'completed',
   '00000000-0000-0000-0000-000000000004'::uuid, 
   '00000000-0000-0000-0000-000000000002'::uuid,
   jsonb_build_object('client', NOW() - interval '2 hours', 'server', NOW() - interval '2 hours'),
   'Standard room cleaning - checkout',
   40,
   true,
   NOW() - interval '2 hours', NOW());

-- Return summary
SELECT 
  'Tasks seeded successfully' as message,
  COUNT(*) as total_tasks,
  COUNT(*) FILTER (WHERE status = 'pending') as pending,
  COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
  COUNT(*) FILTER (WHERE status = 'completed') as completed,
  COUNT(*) FILTER (WHERE task_type LIKE '%cleaning%') as housekeeping,
  COUNT(*) FILTER (WHERE task_type IN ('ac_repair', 'plumbing')) as maintenance
FROM tasks;
