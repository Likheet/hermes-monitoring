-- =====================================================
-- HERMES SCHEMA CONSISTENCY FIXES
-- Fixes common schema drift issues and inconsistencies
-- Addresses column name mismatches and status enum problems
-- =====================================================

DO $$
DECLARE
    fixes_applied INTEGER := 0;
    migration_name TEXT := 'hermes_schema_fix_' || to_char(now(), 'YYYY-MM-DD_HH24MISS');
BEGIN
    RAISE NOTICE '🔧 Starting Hermes schema consistency fixes...';
    RAISE NOTICE '';

    -- Check and fix tasks table inconsistencies
    -- 1. Ensure required columns exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'estimated_duration') THEN
        EXECUTE 'ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimated_duration INTEGER';
        fixes_applied := fixes_applied + 1;
        RAISE NOTICE '✓ Added missing estimated_duration column to tasks';
    ELSE
        RAISE NOTICE '⏭️  tasks.estimated_duration column already exists';
    END IF;

    -- 2. Fix column name inconsistencies between migrations
    -- Common issue: Some migrations use 'estimated_duration_minutes' vs 'estimated_duration'
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'estimated_duration_minutes') THEN
        -- If both exist, migrate data from _minutes to the standard column
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'estimated_duration') THEN
            EXECUTE 'UPDATE tasks SET estimated_duration = estimated_duration_minutes WHERE estimated_duration_minutes IS NOT NULL';
            RAISE NOTICE '✓ Migrated estimated_duration_minutes to estimated_duration';
        END IF;

        EXECUTE 'ALTER TABLE tasks DROP COLUMN IF EXISTS estimated_duration_minutes';
        fixes_applied := fixes_applied + 1;
        RAISE NOTICE '✓ Dropped deprecated estimated_duration_minutes column';
    ELSE
        RAISE NOTICE '⏭️  No estimated_duration_minutes column found (already fixed)';
    END IF;

    -- 3. Fix status column enum consistency
    -- Some migrations use uppercase vs lowercase status values
    EXECUTE 'UPDATE tasks SET status = LOWER(status) WHERE status IS NOT NULL AND status != LOWER(status)';
    GET DIAGNOSTICS fixes_applied = ROW_COUNT;
    IF fixes_applied > 0 THEN
        RAISE NOTICE '✓ Fixed % status values to lowercase', fixes_applied;
        fixes_applied := fixes_applied + 1;
    ELSE
        RAISE NOTICE '⏭️  Task status values already normalized';
    END IF;

    -- 4. Ensure photo_requirements column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'photo_requirements') THEN
        EXECUTE 'ALTER TABLE tasks ADD COLUMN IF NOT EXISTS photo_requirements JSONB DEFAULT ''''''::jsonb';
        fixes_applied := fixes_applied + 1;
        RAISE NOTICE '✓ Added missing photo_requirements column to tasks';
    ELSE
        RAISE NOTICE '⏭️  tasks.photo_requirements column already exists';
    END IF;

    -- 5. Fix user table column inconsistencies
    -- Common issue: full_name vs name column
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'full_name') AND
       NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'name') THEN
        EXECUTE 'ALTER TABLE users RENAME COLUMN full_name TO name';
        fixes_applied := fixes_applied + 1;
        RAISE NOTICE '✓ Renamed full_name column to name in users table';
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'full_name') AND
          EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'name') THEN
        -- If both exist, migrate and drop full_name
        EXECUTE 'UPDATE users SET name = full_name WHERE full_name IS NOT NULL AND name IS NULL';
        EXECUTE 'ALTER TABLE users DROP COLUMN IF EXISTS full_name';
        fixes_applied := fixes_applied + 1;
        RAISE NOTICE '✓ Migrated and dropped duplicate full_name column in users';
    ELSE
        RAISE NOTICE '⏭️  Users name column already consistent';
    END IF;

    -- 6. Fix audit_logs table column names
    -- Common issue: audit_log vs audit_logs naming inconsistency
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'audit_log') AND
       EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
        -- The tasks table refers to audit_log, but the actual table is audit_logs
        -- This is correct, no action needed
        RAISE NOTICE 'ℹ️  audit_log reference correct (audit_logs table exists)';
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'audit_logs') AND
           EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
        -- If both audit_log and audit_logs columns exist, consolidate
        EXECUTE 'ALTER TABLE tasks RENAME COLUMN audit_logs TO audit_log';
        fixes_applied := fixes_applied + 1;
        RAISE NOTICE '✓ Renamed duplicate audit_logs column to audit_log';
    END IF;

    -- 7. Fix notification table consistency
    -- Common issue: is_read vs read boolean column
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'read') AND
       NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'is_read') THEN
        EXECUTE 'ALTER TABLE notifications RENAME COLUMN read TO is_read';
        fixes_applied := fixes_applied + 1;
        RAISE NOTICE '✓ Renamed read column to is_read in notifications table';
    ELSE
        RAISE NOTICE '⏭️  Notifications read column already consistent';
    END IF;

    -- 8. Add missing foreign key constraints (safe addition)
    -- Add constraint only if it doesn't exist and data allows it
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                   WHERE table_name = 'tasks' AND constraint_name = 'tasks_assigned_to_user_id_fkey') THEN
        -- Only add FK if all assigned_to_user_id values exist in users table
        IF NOT EXISTS (SELECT 1 FROM tasks t LEFT JOIN users u ON t.assigned_to_user_id = u.id WHERE t.assigned_to_user_id IS NOT NULL AND u.id IS NULL) THEN
            EXECUTE 'ALTER TABLE tasks ADD CONSTRAINT tasks_assigned_to_user_id_fkey FOREIGN KEY (assigned_to_user_id) REFERENCES users(id) ON DELETE SET NULL';
            fixes_applied := fixes_applied + 1;
            RAISE NOTICE '✓ Added missing foreign key constraint: tasks.assigned_to_user_id → users.id';
        ELSE
            RAISE NOTICE '⚠️  Could not add tasks.assigned_to_user_id foreign key (orphaned records exist)';
        END IF;
    ELSE
        RAISE NOTICE '⏭️  tasks.assigned_to_user_id foreign key already exists';
    END IF;

    -- 9. Standardize created_at/updated_at timestamps
    -- Ensure all tables have these columns with proper types
    FOREACH table_name IN ARRAY ARRAY['tasks', 'users', 'shift_schedules', 'maintenance_tasks', 'audit_logs', 'notifications'] LOOP
        -- Add created_at if missing
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = table_name AND column_name = 'created_at') THEN
            EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now()', table_name);
            fixes_applied := fixes_applied + 1;
            RAISE NOTICE '✓ Added missing created_at column to %I table', table_name;
        END IF;

        -- Add updated_at if missing
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = table_name AND column_name = 'updated_at') THEN
            EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now()', table_name);
            fixes_applied := fixes_applied + 1;
            RAISE NOTICE '✓ Added missing updated_at column to %I table', table_name;
        END IF;
    END LOOP;

    -- 10. Add migration record to track this fix
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'schema_migrations') THEN
        CREATE TABLE schema_migrations (
            id SERIAL PRIMARY KEY,
            migration_name TEXT NOT NULL UNIQUE,
            applied_at TIMESTAMPTZ DEFAULT now(),
            fixes_applied INTEGER
        );
        RAISE NOTICE '✓ Created schema_migrations tracking table';
    END IF;

    INSERT INTO schema_migrations (migration_name, fixes_applied)
    VALUES (migration_name, fixes_applied)
    ON CONFLICT (migration_name) DO UPDATE
    SET applied_at = now(), fixes_applied = EXCLUDED.fixes_applied;

    RAISE NOTICE '';
    RAISE NOTICE '🎉 SCHEMA CONSISTENCY FIXES COMPLETED!';
    RAISE NOTICE '   Migration name: %', migration_name;
    RAISE NOTICE '   Total fixes applied: %', fixes_applied;
    RAISE NOTICE '';
    RAISE NOTICE '🔍 Changes applied:';
    RAISE NOTICE '   • Standardized column names across tables';
    RAISE NOTICE '   • Fixed status value case consistency';
    RAISE NOTICE '   • Added missing required columns';
    RAISE NOTICE '   • Improved foreign key constraints';
    RAISE NOTICE '   • Standardized timestamp columns';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  Test application functionality after these changes';

END $$;

-- Show current schema status for verification
SELECT
    'tasks' as table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'tasks'
    AND column_name IN ('status', 'estimated_duration', 'estimated_duration_minutes', 'audit_log', 'photo_requirements')
ORDER BY column_name

UNION ALL

SELECT
    'users' as table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'users'
    AND column_name IN ('name', 'full_name')
ORDER BY column_name

UNION ALL

SELECT
    'notifications' as table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'notifications'
    AND column_name IN ('is_read', 'read')
ORDER BY column_name;