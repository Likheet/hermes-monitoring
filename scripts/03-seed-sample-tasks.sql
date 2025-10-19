-- Seed sample tasks for testing
-- This creates a variety of tasks in different states

DO $$
DECLARE
  admin_id UUID;
  front_office_id UUID;
  hk_worker_id UUID;
  maint_worker_id UUID;
  task_id UUID;
BEGIN
  -- Get user IDs
  SELECT id INTO admin_id FROM users WHERE role = 'admin' LIMIT 1;
  SELECT id INTO front_office_id FROM users WHERE role = 'front_office' LIMIT 1;
  SELECT id INTO hk_worker_id FROM users WHERE role = 'worker' AND department = 'housekeeping' LIMIT 1;
  SELECT id INTO maint_worker_id FROM users WHERE role = 'worker' AND department = 'maintenance' LIMIT 1;
  
  -- Removed department column as it doesn't exist in tasks table
  -- Create pending housekeeping task
  task_id := gen_random_uuid();
  INSERT INTO tasks (
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
  VALUES (
    task_id,
    'Room Cleaning',
    'DAILY_TASK',
    'PENDING',
    hk_worker_id,
    front_office_id,
    NOW(),
    NOW(),
    30,
    true,
    'A101',
    NOW()
  );
  
  -- Create audit log for the task
  INSERT INTO audit_logs (
    id,
    task_id,
    user_id,
    action,
    old_status,
    new_status,
    timestamp_client,
    timestamp_server,
    created_at
  )
  VALUES (
    gen_random_uuid(),
    task_id,
    front_office_id,
    'TASK_ASSIGNED',
    NULL,
    'PENDING',
    NOW(),
    NOW(),
    NOW()
  );
  
  -- Create in-progress maintenance task
  task_id := gen_random_uuid();
  INSERT INTO tasks (
    id,
    task_type,
    priority_level,
    status,
    assigned_to_user_id,
    assigned_by_user_id,
    assigned_at_client,
    assigned_at_server,
    started_at_client,
    started_at_server,
    expected_duration_minutes,
    photo_required,
    room_number,
    created_at
  )
  VALUES (
    task_id,
    'AC Maintenance',
    'PREVENTIVE_MAINTENANCE',
    'IN_PROGRESS',
    maint_worker_id,
    admin_id,
    NOW() - INTERVAL '1 hour',
    NOW() - INTERVAL '1 hour',
    NOW() - INTERVAL '30 minutes',
    NOW() - INTERVAL '30 minutes',
    60,
    true,
    'B205',
    NOW()
  );
  
  -- Create completed task
  task_id := gen_random_uuid();
  INSERT INTO tasks (
    id,
    task_type,
    priority_level,
    status,
    assigned_to_user_id,
    assigned_by_user_id,
    assigned_at_client,
    assigned_at_server,
    started_at_client,
    started_at_server,
    completed_at_client,
    completed_at_server,
    expected_duration_minutes,
    actual_duration_minutes,
    photo_required,
    room_number,
    created_at
  )
  VALUES (
    task_id,
    'Bathroom Cleaning',
    'DAILY_TASK',
    'COMPLETED',
    hk_worker_id,
    front_office_id,
    NOW() - INTERVAL '2 hours',
    NOW() - INTERVAL '2 hours',
    NOW() - INTERVAL '90 minutes',
    NOW() - INTERVAL '90 minutes',
    NOW() - INTERVAL '30 minutes',
    NOW() - INTERVAL '30 minutes',
    45,
    42,
    true,
    'C303',
    NOW()
  );
  
  RAISE NOTICE 'Sample tasks created successfully';
END $$;
