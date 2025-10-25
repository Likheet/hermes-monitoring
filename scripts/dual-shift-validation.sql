-- Dual Shift Database Validation and Repair Script
-- This script helps identify and fix common dual shift configuration issues

-- =====================================================
-- 1. SCHEMA VALIDATION
-- =====================================================

-- Check if dual shift columns exist in shift_schedules table
DO $$
DECLARE
    dual_shift_columns_missing BOOLEAN := FALSE;
    missing_columns TEXT[];
BEGIN
    -- Check for required dual shift columns
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'shift_schedules' AND column_name = 'shift_1_start'
    ) THEN
        dual_shift_columns_missing := TRUE;
        missing_columns := array_append(missing_columns, 'shift_1_start');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'shift_schedules' AND column_name = 'shift_1_end'
    ) THEN
        dual_shift_columns_missing := TRUE;
        missing_columns := array_append(missing_columns, 'shift_1_end');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'shift_schedules' AND column_name = 'has_shift_2'
    ) THEN
        dual_shift_columns_missing := TRUE;
        missing_columns := array_append(missing_columns, 'has_shift_2');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'shift_schedules' AND column_name = 'is_dual_shift'
    ) THEN
        dual_shift_columns_missing := TRUE;
        missing_columns := array_append(missing_columns, 'is_dual_shift');
    END IF;

    IF dual_shift_columns_missing THEN
        RAISE EXCEPTION 'Dual shift migration incomplete. Missing columns: %', array_to_string(missing_columns, ', ');
    ELSE
        RAISE NOTICE '✅ All dual shift columns are present in shift_schedules table';
    END IF;
END $$;

-- =====================================================
-- 2. DATA CONSISTENCY CHECKS
-- =====================================================

-- Check for inconsistent dual shift data
WITH dual_shift_issues AS (
    SELECT
        ss.id,
        ss.worker_id,
        ss.schedule_date,
        u.name as worker_name,
        ss.has_shift_2,
        ss.is_dual_shift,
        ss.shift_1_start,
        ss.shift_1_end,
        ss.shift_2_start,
        ss.shift_2_end,
        -- Flag inconsistencies
        CASE
            WHEN (ss.has_shift_2 OR ss.is_dual_shift) AND (ss.shift_2_start IS NULL OR ss.shift_2_end IS NULL)
            THEN 'Dual shift flagged but missing shift 2 times'
            WHEN (ss.shift_2_start IS NOT NULL AND ss.shift_2_end IS NOT NULL) AND NOT (ss.has_shift_2 OR ss.is_dual_shift)
            THEN 'Has shift 2 times but not flagged as dual shift'
            WHEN ss.shift_1_start IS NULL OR ss.shift_1_end IS NULL
            THEN 'Missing primary shift times'
            ELSE NULL
        END as issue_type
    FROM shift_schedules ss
    JOIN users u ON ss.worker_id = u.id
    WHERE ss.schedule_date >= CURRENT_DATE - INTERVAL '7 days' -- Check recent schedules
)
SELECT
    worker_name,
    schedule_date,
    has_shift_2,
    is_dual_shift,
    shift_1_start,
    shift_1_end,
    shift_2_start,
    shift_2_end,
    issue_type
FROM dual_shift_issues
WHERE issue_type IS NOT NULL
ORDER BY schedule_date DESC, worker_name;

-- =====================================================
-- 3. USER PROFILE CONSISTENCY CHECK
-- =====================================================

-- Check if user profiles have dual shift fields
DO $$
DECLARE
    user_dual_shift_missing BOOLEAN := FALSE;
    missing_user_columns TEXT[];
BEGIN
    -- Check for dual shift columns in users table
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'is_dual_shift'
    ) THEN
        user_dual_shift_missing := TRUE;
        missing_user_columns := array_append(missing_user_columns, 'is_dual_shift');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'has_shift_2'
    ) THEN
        user_dual_shift_missing := TRUE;
        missing_user_columns := array_append(missing_user_columns, 'has_shift_2');
    END IF;

    IF user_dual_shift_missing THEN
        RAISE NOTICE '⚠️ User table missing dual shift columns: %', array_to_string(missing_user_columns, ', ');
    ELSE
        RAISE NOTICE '✅ User table has dual shift columns';
    END IF;
END $$;

-- Show users with inconsistent dual shift settings
SELECT
    u.name,
    u.role,
    u.is_dual_shift,
    u.has_shift_2,
    u.shift_2_start,
    u.shift_2_end,
    CASE
        WHEN (u.is_dual_shift OR u.has_shift_2) AND (u.shift_2_start IS NULL OR u.shift_2_end IS NULL)
        THEN 'User flagged as dual shift but missing shift 2 times'
        WHEN (u.shift_2_start IS NOT NULL AND u.shift_2_end IS NOT NULL) AND NOT (u.is_dual_shift OR u.has_shift_2)
        THEN 'User has shift 2 times but not flagged as dual shift'
        ELSE NULL
    END as issue_type
FROM users u
WHERE u.role IN ('worker', 'supervisor')
    AND (
        (u.is_dual_shift OR u.has_shift_2) AND (u.shift_2_start IS NULL OR u.shift_2_end IS NULL)
        OR
        (u.shift_2_start IS NOT NULL AND u.shift_2_end IS NOT NULL) AND NOT (u.is_dual_shift OR u.has_shift_2)
    );

-- =====================================================
-- 4. TODAY'S SHIFT SCHEDULES SUMMARY
-- =====================================================

-- Show today's shift schedules with dual shift information
SELECT
    u.name as worker_name,
    u.department,
    ss.schedule_date,
    ss.is_override,
    ss.override_reason,
    -- Primary shift
    COALESCE(ss.shift_1_start, ss.shift_start, u.shift_start) as primary_shift_start,
    COALESCE(ss.shift_1_end, ss.shift_end, u.shift_end) as primary_shift_end,
    COALESCE(ss.shift_1_break_start, ss.break_start, u.break_start) as primary_break_start,
    COALESCE(ss.shift_1_break_end, ss.break_end, u.break_end) as primary_break_end,
    -- Second shift
    ss.has_shift_2,
    ss.is_dual_shift,
    ss.shift_2_start,
    ss.shift_2_end,
    ss.shift_2_break_start,
    ss.shift_2_break_end,
    -- Computed fields
    CASE
        WHEN (ss.has_shift_2 OR ss.is_dual_shift OR (ss.shift_2_start IS NOT NULL AND ss.shift_2_end IS NOT NULL))
        THEN 'DUAL SHIFT'
        ELSE 'SINGLE SHIFT'
    END as shift_type,
    -- Availability check
    CASE
        WHEN CURRENT_TIME BETWEEN COALESCE(ss.shift_1_start, ss.shift_start, u.shift_start) AND COALESCE(ss.shift_1_end, ss.shift_end, u.shift_end)
        THEN 'ON SHIFT 1'
        WHEN ss.has_shift_2 AND CURRENT_TIME BETWEEN ss.shift_2_start AND ss.shift_2_end
        THEN 'ON SHIFT 2'
        WHEN CURRENT_TIME BETWEEN COALESCE(ss.shift_1_break_start, ss.break_start, u.break_start) AND COALESCE(ss.shift_1_break_end, ss.break_end, u.break_end)
        THEN 'ON BREAK'
        WHEN ss.has_shift_2 AND CURRENT_TIME BETWEEN ss.shift_2_break_start AND ss.shift_2_break_end
        THEN 'ON SHIFT 2 BREAK'
        ELSE 'OFF DUTY'
    END as current_status
FROM shift_schedules ss
JOIN users u ON ss.worker_id = u.id
WHERE ss.schedule_date = CURRENT_DATE
    AND u.role IN ('worker', 'supervisor', 'front_office')
ORDER BY u.name, primary_shift_start;

-- =====================================================
-- 5. REPAIR FUNCTIONS
-- =====================================================

-- Function to fix inconsistent dual shift flags
CREATE OR REPLACE FUNCTION fix_dual_shift_consistency()
RETURNS TABLE(worker_name TEXT, schedule_date DATE, action_taken TEXT) AS $$
BEGIN
    -- Update schedules that have shift 2 times but aren't flagged as dual shift
    UPDATE shift_schedules
    SET
        has_shift_2 = true,
        is_dual_shift = true
    WHERE shift_2_start IS NOT NULL
        AND shift_2_end IS NOT NULL
        AND NOT (has_shift_2 OR is_dual_shift)
    RETURNING
        (SELECT name FROM users WHERE id = worker_id) as worker_name,
        schedule_date,
        'Fixed missing dual shift flags' as action_taken;

    -- Update schedules that are flagged as dual shift but missing times
    UPDATE shift_schedules
    SET
        has_shift_2 = false,
        is_dual_shift = false
    WHERE (has_shift_2 OR is_dual_shift)
        AND (shift_2_start IS NULL OR shift_2_end IS NULL)
    RETURNING
        (SELECT name FROM users WHERE id = worker_id) as worker_name,
        schedule_date,
        'Cleared incorrect dual shift flags' as action_taken;

    RETURN;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. USAGE INSTRUCTIONS
-- =====================================================

-- To run the repair function:
-- SELECT * FROM fix_dual_shift_consistency();

-- To manually fix a specific worker's dual shift settings:
-- UPDATE shift_schedules
-- SET
--     has_shift_2 = true,
--     is_dual_shift = true,
--     shift_2_start = '14:00',
--     shift_2_end = '22:00'
-- WHERE worker_id = 'worker-uuid-here'
--   AND schedule_date = CURRENT_DATE;

SELECT '✅ Dual shift validation complete. Review the results above and use the fix_dual_shift_consistency() function if needed.' as status;