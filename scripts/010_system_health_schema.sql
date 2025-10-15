-- System health metrics table
CREATE TABLE IF NOT EXISTS system_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type TEXT NOT NULL CHECK (metric_type IN ('database_size', 'storage_usage', 'active_users', 'api_calls')),
  value NUMERIC NOT NULL,
  metadata JSONB DEFAULT '{}',
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_system_metrics_type ON system_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_system_metrics_recorded_at ON system_metrics(recorded_at DESC);

-- Function to get database size
CREATE OR REPLACE FUNCTION get_database_size()
RETURNS NUMERIC AS $$
BEGIN
  RETURN pg_database_size(current_database()) / (1024 * 1024); -- Size in MB
END;
$$ LANGUAGE plpgsql;

-- Function to record system metrics
CREATE OR REPLACE FUNCTION record_system_metrics()
RETURNS void AS $$
BEGIN
  -- Record database size
  INSERT INTO system_metrics (metric_type, value)
  VALUES ('database_size', get_database_size());
  
  -- Record active users (users with tasks in last 24 hours)
  INSERT INTO system_metrics (metric_type, value)
  SELECT 'active_users', COUNT(DISTINCT assigned_to_user_id)
  FROM tasks
  WHERE assigned_at_server > NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Auto-cleanup old metrics (keep last 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_metrics()
RETURNS void AS $$
BEGIN
  DELETE FROM system_metrics
  WHERE recorded_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Schedule metrics recording (requires pg_cron extension)
-- SELECT cron.schedule('record-metrics', '0 * * * *', 'SELECT record_system_metrics()');
-- SELECT cron.schedule('cleanup-metrics', '0 3 * * *', 'SELECT cleanup_old_metrics()');

-- Auto-archive old tasks (older than 6 months)
CREATE TABLE IF NOT EXISTS archived_tasks (LIKE tasks INCLUDING ALL);

CREATE OR REPLACE FUNCTION archive_old_tasks()
RETURNS INTEGER AS $$
DECLARE
  archived_count INTEGER;
BEGIN
  WITH moved_tasks AS (
    DELETE FROM tasks
    WHERE completed_at_server < NOW() - INTERVAL '6 months'
    AND status = 'COMPLETED'
    RETURNING *
  )
  INSERT INTO archived_tasks
  SELECT * FROM moved_tasks;
  
  GET DIAGNOSTICS archived_count = ROW_COUNT;
  RETURN archived_count;
END;
$$ LANGUAGE plpgsql;

-- Schedule archiving (requires pg_cron extension)
-- SELECT cron.schedule('archive-tasks', '0 2 1 * *', 'SELECT archive_old_tasks()');
