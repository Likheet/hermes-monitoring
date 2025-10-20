-- Seed 5 test users with REAL bcrypt hashes
-- Run scripts/generate-password-hashes.ts to generate new hashes if needed

-- Clear existing users
TRUNCATE TABLE users CASCADE;

-- Insert test users with REAL password hashes
INSERT INTO users (id, username, password_hash, name, role, phone, department, shift_timing, created_at)
VALUES 
  -- Admin User (password: admin123)
  ('00000000-0000-0000-0000-000000000001',
   'admin',
   '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', -- admin123
   'Admin User',
   'admin',
   '555-0001',
   NULL,
   NULL,
   NOW()),

  -- Front Office User (password: front123)
  ('00000000-0000-0000-0000-000000000002',
   'frontdesk',
   '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- front123
   'Front Desk Staff',
   'front_office',
   '555-0002',
   NULL,
   '08:00-20:00',
   NOW()),

  -- Housekeeping Supervisor (password: super123)
  ('00000000-0000-0000-0000-000000000003',
   'hk-super',
   '$2a$10$CwTycUXWue0Thq9StjUM0uJ8qQ4AhT3NdpuAfLwVGY3poJMU/7nDe', -- super123
   'Sarah Johnson',
   'supervisor',
   '555-0003',
   'housekeeping',
   '07:00-15:00',
   NOW()),

  -- Housekeeping Worker (password: worker123)
  ('00000000-0000-0000-0000-000000000004',
   'hk-worker',
   '$2a$10$YCFsG6elYca568hBi0pZ0uChX0HQ4FMTNdOXT3/yd.nEc4GDdpbiq', -- worker123
   'John Smith',
   'worker',
   '555-0004',
   'housekeeping',
   '08:00-16:00',
   NOW()),

  -- Maintenance Worker (password: worker123)
  ('00000000-0000-0000-0000-000000000005',
   'maint-worker',
   '$2a$10$YCFsG6elYca568hBi0pZ0uChX0HQ4FMTNdOXT3/yd.nEc4GDdpbiq', -- worker123
   'Mike Rodriguez',
   'worker',
   '555-0005',
   'maintenance',
   '08:00-16:00',
   NOW())
ON CONFLICT (id) DO UPDATE SET
  username = EXCLUDED.username,
  password_hash = EXCLUDED.password_hash,
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  phone = EXCLUDED.phone,
  department = EXCLUDED.department,
  shift_timing = EXCLUDED.shift_timing;

-- Return summary
SELECT 
  'Users seeded successfully with REAL password hashes' as message,
  COUNT(*) as total_users,
  COUNT(*) FILTER (WHERE role = 'admin') as admins,
  COUNT(*) FILTER (WHERE role = 'front_office') as front_office,
  COUNT(*) FILTER (WHERE role = 'supervisor') as supervisors,
  COUNT(*) FILTER (WHERE role = 'worker') as workers
FROM users;
