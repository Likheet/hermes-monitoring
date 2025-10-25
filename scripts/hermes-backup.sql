-- =====================================================
-- HERMES DATABASE BACKUP SCRIPT
-- Run this script before any database changes
-- Creates timestamped backup tables for all critical data
-- =====================================================

-- Create a timestamp for the backup (YYYY-MM-DD_HHMMSS)
DO $$
DECLARE
    backup_timestamp TEXT := to_char(now(), 'YYYY-MM-DD_HH24MISS');
BEGIN
    RAISE NOTICE 'Creating backup with timestamp: %', backup_timestamp;

    -- Backup users table (critical for authentication and role management)
    EXECUTE format('CREATE TABLE IF NOT EXISTS hermes_backup_users_%s AS TABLE users;', backup_timestamp);
    RAISE NOTICE '✓ Backed up users table';

    -- Backup tasks table (main application data)
    EXECUTE format('CREATE TABLE IF NOT EXISTS hermes_backup_tasks_%s AS TABLE tasks;', backup_timestamp);
    RAISE NOTICE '✓ Backed up tasks table';

    -- Backup shift_schedules table (scheduling data)
    EXECUTE format('CREATE TABLE IF NOT EXISTS hermes_backup_shift_schedules_%s AS TABLE shift_schedules;', backup_timestamp);
    RAISE NOTICE '✓ Backed up shift_schedules table';

    -- Backup maintenance_tasks table (maintenance data)
    EXECUTE format('CREATE TABLE IF NOT EXISTS hermes_backup_maintenance_tasks_%s AS TABLE maintenance_tasks;', backup_timestamp);
    RAISE NOTICE '✓ Backed up maintenance_tasks table';

    -- Backup maintenance_schedules table (recurring maintenance)
    EXECUTE format('CREATE TABLE IF NOT EXISTS hermes_backup_maintenance_schedules_%s AS TABLE maintenance_schedules;', backup_timestamp);
    RAISE NOTICE '✓ Backed up maintenance_schedules table';

    -- Backup audit_logs table (change history)
    EXECUTE format('CREATE TABLE IF NOT EXISTS hermes_backup_audit_logs_%s AS TABLE audit_logs;', backup_timestamp);
    RAISE NOTICE '✓ Backed up audit_logs table';

    -- Backup escalations table (escalation tracking)
    EXECUTE format('CREATE TABLE IF NOT EXISTS hermes_backup_escalations_%s AS TABLE escalations;', backup_timestamp);
    RAISE NOTICE '✓ Backed up escalations table';

    -- Backup notifications table (user notifications)
    EXECUTE format('CREATE TABLE IF NOT EXISTS hermes_backup_notifications_%s AS TABLE notifications;', backup_timestamp);
    RAISE NOTICE '✓ Backed up notifications table';

    -- Backup user_preferences table (user settings)
    EXECUTE format('CREATE TABLE IF NOT EXISTS hermes_backup_user_preferences_%s AS TABLE user_preferences;', backup_timestamp);
    RAISE NOTICE '✓ Backed up user_preferences table';

    -- Create summary table with backup info
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS hermes_backup_log_%s AS
        SELECT
            ''%I'' as backup_timestamp,
            now() as created_at,
            (SELECT COUNT(*) FROM users) as users_count,
            (SELECT COUNT(*) FROM tasks) as tasks_count,
            (SELECT COUNT(*) FROM shift_schedules) as shift_schedules_count,
            (SELECT COUNT(*) FROM maintenance_tasks) as maintenance_tasks_count
    ', backup_timestamp, backup_timestamp);

    RAISE NOTICE '✓ Created backup log table';
    RAISE NOTICE '';
    RAISE NOTICE '🔒 BACKUP COMPLETED SUCCESSFULLY!';
    RAISE NOTICE '   Timestamp: %', backup_timestamp;
    RAISE NOTICE '   To restore: Use hermes-rollback-%s.sql script', backup_timestamp;
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  Keep this backup log table for reference';

END $$;

-- Show current backup tables
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE tablename LIKE 'hermes_backup_%'
ORDER BY tablename DESC;