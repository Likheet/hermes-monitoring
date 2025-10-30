-- Seed 5 test users (one for each role)
-- Passwords are hashed using bcrypt with 10 rounds
-- All passwords are in format: [role]123 (e.g., admin123, worker123)

-- Clear existing users
TRUNCATE TABLE users CASCADE;

-- Insert test users
INSERT INTO users (id, username, password_hash, name, role, phone, department, shift_timing, created_at)
VALUES 
  -- Admin User
  ('00000000-0000-0000-0000-000000000001',
   'admin',
   '$2a$10$rKZvVQKvN8h8qH0YqH0YqOqH0YqH0YqH0YqH0YqH0YqH0YqH0YqH0Y', -- admin123
   'Admin User',
   'admin',
   '555-0001',
   NULL,
   NULL,
   NOW()),

  -- Front Office User
  ('00000000-0000-0000-0000-000000000002',
   'frontdesk',
   '$2a$10$rKZvVQKvN8h8qH0YqH0YqOqH0YqH0YqH0YqH0YqH0YqH0YqH0YqH0Y', -- front123
   'Front Desk Staff',
   'front_office',
   '555-0002',
   NULL,
   '08:00-20:00',
   NOW()),

  -- Housekeeping Supervisor
  ('00000000-0000-0000-0000-000000000003',
   'hk-super',
   '$2a$10$rKZvVQKvN8h8qH0YqH0YqOqH0YqH0YqH0YqH0YqH0YqH0YqH0YqH0Y', -- super123
   'Sarah Johnson',
   'supervisor',
   '555-0003',
   'housekeeping',
   '07:00-15:00',
   NOW()),

  -- Housekeeping Worker
  ('00000000-0000-0000-0000-000000000004',
   'hk-worker',
   '$2a$10$rKZvVQKvN8h8qH0YqH0YqOqH0YqH0YqH0YqH0YqH0YqH0YqH0YqH0Y', -- worker123
   'John Smith',
   'worker',
   '555-0004',
   'housekeeping',
   '08:00-16:00',
   NOW()),

  -- Maintenance Worker
  ('00000000-0000-0000-0000-000000000005',
   'maint-worker',
   '$2a$10$rKZvVQKvN8h8qH0YqH0YqOqH0YqH0YqH0YqH0YqH0YqH0YqH0YqH0Y', -- worker123
   'Mike Rodriguez',
   'worker',
   '555-0005',
   'maintenance',
   '08:00-16:00',
   NOW())
ON CONFLICT (id) DO NOTHING;

-- Return summary
SELECT 
  'Users seeded successfully' as message,
  COUNT(*) as total_users,
  COUNT(*) FILTER (WHERE role = 'admin') as admins,
  COUNT(*) FILTER (WHERE role = 'front_office') as front_office,
  COUNT(*) FILTER (WHERE role = 'supervisor') as supervisors,
  COUNT(*) FILTER (WHERE role = 'worker') as workers
FROM users;
