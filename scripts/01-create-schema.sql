-- Hermes Resort Task Management System - Complete Database Schema
-- Phase 1.2: Create all tables with proper relations and username support

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Users table with username/password authentication
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('worker', 'supervisor', 'front_office', 'admin')),
  phone TEXT,
  department TEXT CHECK (department IN ('housekeeping', 'maintenance') OR department IS NULL),
  shift_timing TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type TEXT NOT NULL,
  room_number TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'assigned', 'in_progress', 'paused', 'completed', 'verified', 'rejected')),
  priority_level TEXT CHECK (priority_level IN ('low', 'medium', 'high', 'urgent')),
  assigned_to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  verified_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Timestamps (JSONB for dual timestamp support)
  assigned_at JSONB,
  
  -- Task details
  description TEXT,
  special_instructions TEXT,
  estimated_duration INTEGER,
  actual_duration INTEGER,
  
  -- Photos (JSONB array)
  categorized_photos JSONB DEFAULT '[]'::jsonb,
  
  -- Remarks
  worker_remarks TEXT,
  supervisor_remarks TEXT,
  
  -- Quality and verification
  quality_rating INTEGER CHECK (quality_rating >= 1 AND quality_rating <= 5),
  requires_verification BOOLEAN DEFAULT false,
  
  -- Timer validation
  timer_validation_flag BOOLEAN DEFAULT false,
  
  -- Audit trail (JSONB array)
  audit_log JSONB DEFAULT '[]'::jsonb,
  
  -- Pause history (JSONB array)
  pause_history JSONB DEFAULT '[]'::jsonb,
  
  -- Photo requirements
  photo_requirements JSONB DEFAULT '[]'::jsonb
);

-- Archived tasks for historical data
CREATE TABLE IF NOT EXISTS archived_tasks (
  id UUID PRIMARY KEY,
  task_type TEXT NOT NULL,
  room_number TEXT,
  status TEXT NOT NULL,
  priority_level TEXT,
  assigned_to_user_id UUID,
  assigned_by_user_id UUID,
  created_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  actual_duration INTEGER,
  quality_rating INTEGER,
  archived_at TIMESTAMPTZ DEFAULT NOW(),
  archive_reason TEXT
);

-- ============================================================================
-- SHIFT MANAGEMENT
-- ============================================================================

-- Shift schedules
CREATE TABLE IF NOT EXISTS shift_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  schedule_date DATE NOT NULL,
  shift_start TIME NOT NULL,
  shift_end TIME NOT NULL,
  break_start TIME,
  break_end TIME,
  is_override BOOLEAN DEFAULT false,
  override_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(worker_id, schedule_date)
);

-- Legacy shifts table (for backward compatibility)
CREATE TABLE IF NOT EXISTS shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  days_of_week TEXT[] NOT NULL,
  shift_start TIME NOT NULL,
  shift_end TIME NOT NULL,
  break_start TIME,
  break_end TIME,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rotation patterns
CREATE TABLE IF NOT EXISTS rotation_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  cycle_length_days INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rotation pattern details
CREATE TABLE IF NOT EXISTS rotation_pattern_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_id UUID NOT NULL REFERENCES rotation_patterns(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL,
  shift_start TIME NOT NULL,
  shift_end TIME NOT NULL,
  break_start TIME,
  break_end TIME,
  is_off_day BOOLEAN DEFAULT false,
  UNIQUE(pattern_id, day_number)
);

-- Worker rotation assignments
CREATE TABLE IF NOT EXISTS worker_rotation_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pattern_id UUID NOT NULL REFERENCES rotation_patterns(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE,
  current_day_in_cycle INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shift swap requests
CREATE TABLE IF NOT EXISTS shift_swap_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_worker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  reason TEXT,
  approved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- MAINTENANCE MANAGEMENT
-- ============================================================================

-- Maintenance schedules
CREATE TABLE IF NOT EXISTS maintenance_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_name TEXT NOT NULL,
  area TEXT NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'semiannual', 'annual')),
  last_completed TIMESTAMPTZ,
  next_due TIMESTAMPTZ,
  auto_reset BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Maintenance tasks
CREATE TABLE IF NOT EXISTS maintenance_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'verified')),
  ac_location TEXT,
  task_type TEXT NOT NULL,
  room_number TEXT,
  period_year INTEGER,
  period_month INTEGER,
  schedule_id UUID REFERENCES maintenance_schedules(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  photos JSONB DEFAULT '[]'::jsonb,
  timer_duration INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TASK TEMPLATES & CONFIGURATION
-- ============================================================================

-- Task templates
CREATE TABLE IF NOT EXISTS task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  department TEXT NOT NULL CHECK (department IN ('housekeeping', 'maintenance')),
  description TEXT,
  estimated_duration INTEGER,
  priority_level TEXT CHECK (priority_level IN ('low', 'medium', 'high', 'urgent')),
  requires_verification BOOLEAN DEFAULT false,
  photo_requirements JSONB DEFAULT '[]'::jsonb,
  special_instructions TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TRACKING & HISTORY
-- ============================================================================

-- Pause records
CREATE TABLE IF NOT EXISTS pause_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  paused_at JSONB NOT NULL,
  resumed_at JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Task handovers
CREATE TABLE IF NOT EXISTS handovers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  from_worker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_worker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Task issues
CREATE TABLE IF NOT EXISTS task_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  reported_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  issue_type TEXT NOT NULL,
  description TEXT NOT NULL,
  photos JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  resolved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- NOTIFICATIONS & ALERTS
-- ============================================================================

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- USER PREFERENCES & SYSTEM
-- ============================================================================

-- User preferences
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  theme TEXT DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'system')),
  language TEXT DEFAULT 'en',
  notifications_enabled BOOLEAN DEFAULT true,
  sound_enabled BOOLEAN DEFAULT true,
  auto_logout_minutes INTEGER DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- System metrics
CREATE TABLE IF NOT EXISTS system_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  metric_type TEXT NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_department ON users(department);

-- Tasks indexes
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_room_number ON tasks(room_number);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);

-- Shift schedules indexes
CREATE INDEX IF NOT EXISTS idx_shift_schedules_worker_date ON shift_schedules(worker_id, schedule_date);
CREATE INDEX IF NOT EXISTS idx_shift_schedules_date ON shift_schedules(schedule_date);

-- Notifications indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

-- ============================================================================
-- SUMMARY
-- ============================================================================

-- Count tables created
SELECT 
  'Schema created successfully!' as message,
  COUNT(*) as total_tables
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
  AND table_name != 'schema_migrations';
