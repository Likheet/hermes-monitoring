-- Enhanced Timer, Escalation, and Shift Management Schema
-- Run this after the base schema (001_create_schema.sql)

-- Add new columns to tasks table
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS delay_reason TEXT,
ADD COLUMN IF NOT EXISTS timer_validation_flags JSONB DEFAULT '[]'::jsonb;

-- Escalations table
CREATE TABLE IF NOT EXISTS escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES users(id),
  level INTEGER NOT NULL CHECK (level IN (1, 2, 3)),
  timestamp_client TIMESTAMPTZ,
  timestamp_server TIMESTAMPTZ DEFAULT NOW(),
  acknowledged_by UUID REFERENCES users(id),
  acknowledged_at TIMESTAMPTZ,
  resolved BOOLEAN DEFAULT false,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escalations_task ON escalations(task_id);
CREATE INDEX IF NOT EXISTS idx_escalations_worker ON escalations(worker_id);
CREATE INDEX IF NOT EXISTS idx_escalations_resolved ON escalations(resolved);

-- Shifts table
CREATE TABLE IF NOT EXISTS shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES users(id),
  shift_start TIME NOT NULL,
  shift_end TIME NOT NULL,
  days_of_week INTEGER[] NOT NULL CHECK (array_length(days_of_week, 1) > 0),
  effective_from DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shifts_worker ON shifts(worker_id);
CREATE INDEX IF NOT EXISTS idx_shifts_effective ON shifts(effective_from);

-- Handovers table
CREATE TABLE IF NOT EXISTS handovers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id),
  from_worker_id UUID NOT NULL REFERENCES users(id),
  to_worker_id UUID REFERENCES users(id),
  shift_date DATE NOT NULL,
  status_update TEXT NOT NULL,
  priority_changed BOOLEAN DEFAULT false,
  handover_notes TEXT,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_handovers_task ON handovers(task_id);
CREATE INDEX IF NOT EXISTS idx_handovers_from_worker ON handovers(from_worker_id);
CREATE INDEX IF NOT EXISTS idx_handovers_to_worker ON handovers(to_worker_id);
CREATE INDEX IF NOT EXISTS idx_handovers_date ON handovers(shift_date);

-- RLS Policies for escalations
ALTER TABLE escalations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view escalations" ON escalations
  FOR SELECT USING (true);

CREATE POLICY "System can insert escalations" ON escalations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Supervisors and admins can update escalations" ON escalations
  FOR UPDATE USING (true);

-- RLS Policies for shifts
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view shifts" ON shifts
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage shifts" ON shifts
  FOR ALL USING (true);

-- RLS Policies for handovers
ALTER TABLE handovers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view handovers" ON handovers
  FOR SELECT USING (true);

CREATE POLICY "Workers can create handovers" ON handovers
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Workers can update their handovers" ON handovers
  FOR UPDATE USING (true);
