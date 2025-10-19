-- Seed users table with test data
-- This script populates the users table with initial test users for development

-- Temporarily disable the foreign key constraint to auth.users
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_fkey;

-- Insert test users with fixed UUIDs for consistent testing
INSERT INTO public.users (id, name, role, phone, department, shift_timing, created_at)
VALUES
  -- Admin user (no department - manages all)
  ('00000000-0000-0000-0000-000000000001', 'Admin User', 'admin', '+1234567890', NULL, '00:00-23:59', NOW()),
  
  -- Front Office users (no department - assigns to all)
  ('00000000-0000-0000-0000-000000000002', 'Front Office Staff', 'front_office', '+1234567891', NULL, '08:00-16:00', NOW()),
  
  -- Supervisors (must have department: housekeeping or maintenance)
  ('00000000-0000-0000-0000-000000000003', 'Housekeeping Supervisor', 'supervisor', '+1234567892', 'housekeeping', '08:00-17:00', NOW()),
  ('00000000-0000-0000-0000-000000000004', 'Maintenance Supervisor', 'supervisor', '+1234567893', 'maintenance', '08:00-17:00', NOW()),
  
  -- Workers (must have department: housekeeping or maintenance)
  ('00000000-0000-0000-0000-000000000005', 'Maria Garcia', 'worker', '+1234567894', 'housekeeping', '08:00-16:00', NOW()),
  ('00000000-0000-0000-0000-000000000006', 'John Smith', 'worker', '+1234567895', 'housekeeping', '09:00-17:00', NOW()),
  ('00000000-0000-0000-0000-000000000007', 'Mike Johnson', 'worker', '+1234567896', 'maintenance', '08:00-16:00', NOW()),
  ('00000000-0000-0000-0000-000000000008', 'Sarah Lee', 'worker', '+1234567897', 'maintenance', '09:00-17:00', NOW())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  phone = EXCLUDED.phone,
  department = EXCLUDED.department,
  shift_timing = EXCLUDED.shift_timing;

-- Log the seed operation
INSERT INTO public.audit_logs (user_id, action, metadata, created_at)
VALUES ('00000000-0000-0000-0000-000000000001', 'SEED_USERS', '{"count": 8, "script": "01-seed-users.sql"}'::jsonb, NOW())
ON CONFLICT DO NOTHING;

-- Return summary
SELECT 
  'Users seeded successfully' as status,
  COUNT(*) as total_users,
  json_object_agg(role, count) as users_by_role
FROM (
  SELECT role, COUNT(*) as count
  FROM public.users
  GROUP BY role
) subquery;
