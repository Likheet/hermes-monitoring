-- Seed test users with fixed UUIDs for easy testing
-- Passwords are plain text for testing (hash in production)

INSERT INTO public.users (id, email, password, name, role, phone, department, shift_timing)
VALUES
  -- Admin user (no department)
  ('00000000-0000-0000-0000-000000000001', 'admin@resort.com', 'admin123', 'Admin User', 'admin', '+1234567890', NULL, NULL),
  
  -- Front office user (no department)
  ('00000000-0000-0000-0000-000000000002', 'frontdesk@resort.com', 'front123', 'Front Desk Manager', 'front_office', '+1234567891', NULL, '08:00-20:00'),
  
  -- Housekeeping supervisor
  ('00000000-0000-0000-0000-000000000003', 'hk-supervisor@resort.com', 'super123', 'HK Supervisor', 'supervisor', '+1234567892', 'housekeeping', '07:00-15:00'),
  
  -- Maintenance supervisor
  ('00000000-0000-0000-0000-000000000004', 'maint-supervisor@resort.com', 'super123', 'Maintenance Supervisor', 'supervisor', '+1234567893', 'maintenance', '08:00-16:00'),
  
  -- Housekeeping workers
  ('00000000-0000-0000-0000-000000000005', 'hk-worker1@resort.com', 'worker123', 'Maria Garcia', 'worker', '+1234567894', 'housekeeping', '07:00-15:00'),
  ('00000000-0000-0000-0000-000000000006', 'hk-worker2@resort.com', 'worker123', 'Ana Rodriguez', 'worker', '+1234567895', 'housekeeping', '15:00-23:00'),
  
  -- Maintenance workers
  ('00000000-0000-0000-0000-000000000007', 'maint-worker1@resort.com', 'worker123', 'John Smith', 'worker', '+1234567896', 'maintenance', '08:00-16:00'),
  ('00000000-0000-0000-0000-000000000008', 'maint-worker2@resort.com', 'worker123', 'Mike Johnson', 'worker', '+1234567897', 'maintenance', '16:00-00:00')
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  department = EXCLUDED.department;

-- Log the seed operation
INSERT INTO public.audit_logs (user_id, action, metadata)
VALUES ('00000000-0000-0000-0000-000000000001', 'SEED_USERS', '{"count": 8, "script": "02-seed-users.sql"}'::jsonb);

SELECT 
  'Users seeded successfully' AS status,
  COUNT(*) AS user_count,
  json_agg(json_build_object('email', email, 'role', role, 'department', department)) AS users
FROM public.users;
