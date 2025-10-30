-- Enhanced Timer and Shift Management Schema
-- Run this after the base schema (001_create_schema.sql)

-- Add new columns to tasks table
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS delay_reason TEXT,
ADD COLUMN IF NOT EXISTS timer_validation_flags JSONB DEFAULT '[]'::jsonb;

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

-- RLS Policies for handovers
ALTER TABLE handovers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view handovers" ON handovers
  FOR SELECT USING (true);

CREATE POLICY "Workers can create handovers" ON handovers
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Workers can update their handovers" ON handovers
  FOR UPDATE USING (true);
