-- Maintenance Schedules Configuration
CREATE TABLE IF NOT EXISTS maintenance_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type TEXT NOT NULL CHECK (task_type IN ('ac_indoor', 'ac_outdoor', 'fan', 'exhaust', 'lift')),
  area TEXT NOT NULL CHECK (area IN ('a_block', 'b_block', 'both')),
  frequency TEXT NOT NULL CHECK (frequency IN ('monthly', 'biweekly', 'custom')),
  frequency_weeks INTEGER,
  day_range_start INTEGER CHECK (day_range_start >= 1 AND day_range_start <= 31),
  day_range_end INTEGER CHECK (day_range_end >= 1 AND day_range_end <= 31),
  auto_reset BOOLEAN DEFAULT true,
  active BOOLEAN DEFAULT true,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Generated Maintenance Tasks (from schedules)
CREATE TABLE IF NOT EXISTS maintenance_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID REFERENCES maintenance_schedules(id) ON DELETE CASCADE,
  room_number TEXT NOT NULL,
  task_type TEXT NOT NULL,
  ac_location TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  assigned_to TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  photos JSONB DEFAULT '[]',
  timer_duration INTEGER,
  period_month INTEGER NOT NULL,
  period_year INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_schedule ON maintenance_tasks(schedule_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_status ON maintenance_tasks(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_period ON maintenance_tasks(period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_room ON maintenance_tasks(room_number);
