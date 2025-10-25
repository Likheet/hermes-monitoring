-- =====================================================
-- HERMES DATABASE ROLLBACK SCRIPT
-- Replace TIMESTAMP in the filename with your backup timestamp
-- Usage: Replace all {{TIMESTAMP}} placeholders with actual backup timestamp
-- =====================================================

-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
-- !! WARNING: This will destroy all current data and !!
-- !! replace it with the backed up data. Ensure you !!
-- !! have the correct timestamp before running! !!
-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

-- Test mode - uncomment to see what will be restored without actually doing it
-- \echo 'DRY RUN MODE - No changes will be made'
-- -- Uncomment the line below to disable all DROP statements for testing
-- SET session_replication_role = replica;

DO $$
DECLARE
    backup_timestamp TEXT := '{{TIMESTAMP}}';
    tables_exists BOOLEAN := FALSE;
BEGIN
    -- Check if backup tables exist
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'hermes_backup_users_' || backup_timestamp
    ) INTO tables_exists;

    IF NOT tables_exists THEN
        RAISE EXCEPTION '❌ Backup tables with timestamp % not found! Check your timestamp.', backup_timestamp;
    END IF;

    RAISE NOTICE '🚨 STARTING ROLLBACK TO BACKUP: %', backup_timestamp;
    RAISE NOTICE '   This will replace all current data with backup data';
    RAISE NOTICE '';
    RAISE NOTICE 'Press Ctrl+C to cancel, or wait 5 seconds to continue...';
    PERFORM pg_sleep(5);

    RAISE NOTICE '🔄 Proceeding with rollback...';
END $$;

-- Disable foreign key constraints temporarily
SET session_replication_role = replica;

-- Clear current tables
RAISE NOTICE '📋 Clearing current tables...';
TRUNCATE TABLE audit_logs CASCADE;
TRUNCATE TABLE notifications CASCADE;
TRUNCATE TABLE escalations CASCADE;
TRUNCATE TABLE maintenance_tasks CASCADE;
TRUNCATE TABLE maintenance_schedules CASCADE;
TRUNCATE TABLE shift_schedules CASCADE;
TRUNCATE TABLE tasks CASCADE;
TRUNCATE TABLE user_preferences CASCADE;
TRUNCATE TABLE users CASCADE;
RAISE NOTICE '✓ Current tables cleared';

-- Restore data from backup
RAISE NOTICE '♻️  Restoring data from backup...';
INSERT INTO users SELECT * FROM hermes_backup_users_{{TIMESTAMP}};
RAISE NOTICE '✓ Restored users';

INSERT INTO tasks SELECT * FROM hermes_backup_tasks_{{TIMESTAMP}};
RAISE NOTICE '✓ Restored tasks';

INSERT INTO shift_schedules SELECT * FROM hermes_backup_shift_schedules_{{TIMESTAMP}};
RAISE NOTICE '✓ Restored shift_schedules';

INSERT INTO maintenance_tasks SELECT * FROM hermes_backup_maintenance_tasks_{{TIMESTAMP}};
RAISE NOTICE '✓ Restored maintenance_tasks';

INSERT INTO maintenance_schedules SELECT * FROM hermes_backup_maintenance_schedules_{{TIMESTAMP}};
RAISE NOTICE '✓ Restored maintenance_schedules';

INSERT INTO audit_logs SELECT * FROM hermes_backup_audit_logs_{{TIMESTAMP}};
RAISE NOTICE '✓ Restored audit_logs';

INSERT INTO escalations SELECT * FROM hermes_backup_escalations_{{TIMESTAMP}};
RAISE NOTICE '✓ Restored escalations';

INSERT INTO notifications SELECT * FROM hermes_backup_notifications_{{TIMESTAMP}};
RAISE NOTICE '✓ Restored notifications';

INSERT INTO user_preferences SELECT * FROM hermes_backup_user_preferences_{{TIMESTAMP}};
RAISE NOTICE '✓ Restored user_preferences';

-- Re-enable foreign key constraints
RESET session_replication_role;

RAISE NOTICE '';
RAISE NOTICE '🎉 ROLLBACK COMPLETED SUCCESSFULLY!';
RAISE NOTICE '   All data has been restored from backup: {{TIMESTAMP}}';
RAISE NOTICE '';
RAISE NOTICE '⚠️  Verify application functionality before cleanup';
RAISE NOTICE '   To clean up backup tables, run: hermes-cleanup-backups.sql';

-- Show restored data counts
SELECT 'users' as table_name, COUNT(*) as record_count FROM users
UNION ALL
SELECT 'tasks' as table_name, COUNT(*) as record_count FROM tasks
UNION ALL
SELECT 'shift_schedules' as table_name, COUNT(*) as record_count FROM shift_schedules
UNION ALL
SELECT 'maintenance_tasks' as table_name, COUNT(*) as record_count FROM maintenance_tasks;