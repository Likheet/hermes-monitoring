-- Enable Realtime on Critical Tables
-- This allows the app to receive live updates when data changes

-- Enable realtime replication for tasks table
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;

-- Enable realtime replication for users table (for status updates)
ALTER PUBLICATION supabase_realtime ADD TABLE users;

-- Enable realtime replication for shift_schedules
ALTER PUBLICATION supabase_realtime ADD TABLE shift_schedules;

-- Enable realtime replication for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- Enable realtime replication for escalations
ALTER PUBLICATION supabase_realtime ADD TABLE escalations;

-- Verify realtime is enabled
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;
