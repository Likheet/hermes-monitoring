-- Seed users table with test data
-- This script populates the users table with initial test users for development

-- Fixed department values to match CHECK constraint: only 'housekeeping' or 'maintenance' allowed
-- Admin and front_office users have NULL department since they manage both departments
INSERT INTO users (id, name, role, phone, department, shift_timing, created_at)
VALUES
  -- Admin user (no department - manages all)
  (gen_random_uuid(), 'Admin User', 'admin', '+1234567890', NULL, '00:00-23:59', NOW()),
  
  -- Front Office users (no department - assigns to all)
  (gen_random_uuid(), 'Front Office Staff', 'front_office', '+1234567891', NULL, '08:00-16:00', NOW()),
  
  -- Supervisors (must have department: housekeeping or maintenance)
  (gen_random_uuid(), 'Housekeeping Supervisor', 'supervisor', '+1234567892', 'housekeeping', '08:00-17:00', NOW()),
  (gen_random_uuid(), 'Maintenance Supervisor', 'supervisor', '+1234567893', 'maintenance', '08:00-17:00', NOW()),
  
  -- Workers (must have department: housekeeping or maintenance)
  (gen_random_uuid(), 'Housekeeping Worker 1', 'worker', '+1234567894', 'housekeeping', '08:00-16:00', NOW()),
  (gen_random_uuid(), 'Housekeeping Worker 2', 'worker', '+1234567895', 'housekeeping', '09:00-17:00', NOW()),
  (gen_random_uuid(), 'Maintenance Worker 1', 'worker', '+1234567896', 'maintenance', '08:00-16:00', NOW()),
  (gen_random_uuid(), 'Maintenance Worker 2', 'worker', '+1234567897', 'maintenance', '09:00-17:00', NOW())
ON CONFLICT (id) DO NOTHING;

-- Log the result
DO $$
DECLARE
  user_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO user_count FROM users;
  RAISE NOTICE 'Total users in database: %', user_count;
END $$;
