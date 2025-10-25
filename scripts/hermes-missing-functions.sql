-- =====================================================
-- HERMES MISSING DATABASE FUNCTIONS
-- Creates the database functions that the API expects but may not exist
-- Fixes task creation failures due to missing RPC functions
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '🔧 Creating missing Hermes database functions...';
    RAISE NOTICE '';

    -- Function: create_task_with_autopause
    -- Creates a new task with automatic pause handling for existing active tasks
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_task_with_autopause') THEN
        CREATE OR REPLACE FUNCTION create_task_with_autopause(
            task_type TEXT,
            priority_level_db TEXT,
            priority_level_app TEXT,
            assigned_to UUID,
            assigned_by UUID,
            assigned_at JSONB,
            expected_duration INTEGER,
            requires_verification BOOLEAN,
            photo_requirements JSONB,
            room_number TEXT,
            categorized_photos JSONB,
            worker_remarks TEXT,
            supervisor_remarks TEXT,
            -- Custom task fields
            is_custom_task BOOLEAN,
            custom_task_name TEXT,
            custom_task_category TEXT,
            custom_task_priority TEXT,
            custom_task_photo_required BOOLEAN,
            custom_task_photo_count INTEGER,
            custom_task_is_recurring BOOLEAN,
            custom_task_recurring_frequency TEXT,
            custom_task_requires_specific_time BOOLEAN,
            custom_task_recurring_time TIME
        )
        RETURNS TABLE (
            id UUID,
            task_type TEXT,
            status TEXT,
            assigned_to_user_id UUID,
            created_at TIMESTAMPTZ,
            updated_at TIMESTAMPTZ
        )
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        DECLARE
            new_task_id UUID;
            now_timestamp TIMESTAMPTZ := now();
        BEGIN
            -- Generate UUID for the new task
            new_task_id := gen_random_uuid();

            -- Auto-pause existing active tasks for the same worker (if assigned)
            IF assigned_to IS NOT NULL THEN
                UPDATE tasks
                SET
                    status = 'PAUSED',
                    pause_history = COALESCE(pause_history, '[]'::jsonb) || jsonb_build_object(
                        'paused_at', now_timestamp,
                        'resumed_at', NULL,
                        'reason', 'Auto-paused for new task assignment'
                    ),
                    updated_at = now_timestamp
                WHERE assigned_to_user_id = assigned_to
                    AND status = 'IN_PROGRESS';
            END IF;

            -- Insert the new task
            INSERT INTO tasks (
                id,
                task_type,
                room_number,
                status,
                priority_level,
                assigned_to_user_id,
                assigned_by_user_id,
                assigned_at,
                estimated_duration,
                requires_verification,
                photo_requirements,
                categorized_photos,
                worker_remarks,
                supervisor_remarks,
                audit_log,
                department,
                is_custom_task,
                custom_task_name,
                custom_task_category,
                custom_task_priority,
                custom_task_photo_required,
                custom_task_photo_count,
                custom_task_is_recurring,
                custom_task_recurring_frequency,
                custom_task_requires_specific_time,
                custom_task_recurring_time,
                created_at,
                updated_at
            )
            VALUES (
                new_task_id,
                task_type,
                room_number,
                CASE WHEN assigned_to IS NOT NULL THEN 'assigned' ELSE 'pending' END,
                priority_level_db,
                assigned_to,
                assigned_by,
                assigned_at,
                expected_duration,
                requires_verification,
                photo_requirements,
                categorized_photos,
                worker_remarks,
                supervisor_remarks,
                jsonb_build_array(jsonb_build_object(
                    'timestamp', now_timestamp,
                    'user_id', assigned_by,
                    'action', 'TASK_CREATED',
                    'old_status', NULL,
                    'new_status', CASE WHEN assigned_to IS NOT NULL THEN 'ASSIGNED' ELSE 'PENDING' END,
                    'details', 'Task created with type ' || task_type
                )),
                NULL, -- department will be set based on assigned user
                is_custom_task,
                custom_task_name,
                custom_task_category,
                custom_task_priority,
                custom_task_photo_required,
                custom_task_photo_count,
                custom_task_is_recurring,
                custom_task_recurring_frequency,
                custom_task_requires_specific_time,
                custom_task_recurring_time,
                now_timestamp,
                now_timestamp
            );

            -- Set department based on assigned user
            IF assigned_to IS NOT NULL THEN
                UPDATE tasks
                SET department = (
                    SELECT department
                    FROM users
                    WHERE id = assigned_to
                )
                WHERE id = new_task_id;
            END IF;

            -- Return the created task
            RETURN QUERY
            SELECT
                t.id,
                t.task_type,
                t.status,
                t.assigned_to_user_id,
                t.created_at,
                t.updated_at
            FROM tasks t
            WHERE t.id = new_task_id;

            RAISE NOTICE '✓ Created task % (auto-paused existing tasks if needed)', new_task_id;
        END;
        $$;

        RAISE NOTICE '✓ Created create_task_with_autopause function';
    ELSE
        RAISE NOTICE '⏭️  create_task_with_autopause function already exists';
    END IF;

    RAISE NOTICE '';

    -- Function: list_tasks_summary
    -- Optimized function for listing tasks with filtering and pagination
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'list_tasks_summary') THEN
        CREATE OR REPLACE FUNCTION list_tasks_summary(
            status_filter TEXT DEFAULT NULL,
            assigned_to_filter UUID DEFAULT NULL,
            limit_count INTEGER DEFAULT 200,
            offset_count INTEGER DEFAULT 0
        )
        RETURNS TABLE (
            id UUID,
            task_type TEXT,
            status TEXT,
            priority_level TEXT,
            assigned_to_user_id UUID,
            assigned_by_user_id UUID,
            room_number TEXT,
            created_at TIMESTAMPTZ,
            updated_at TIMESTAMPTZ,
            completed_at TIMESTAMPTZ,
            worker_remarks TEXT,
            supervisor_remarks TEXT,
            rating INTEGER,
            department TEXT
        )
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        BEGIN
            RETURN QUERY
            SELECT
                t.id,
                t.task_type,
                t.status,
                t.priority_level,
                t.assigned_to_user_id,
                t.assigned_by_user_id,
                t.room_number,
                t.created_at,
                t.updated_at,
                t.completed_at,
                t.worker_remarks,
                t.supervisor_remarks,
                t.rating,
                t.department
            FROM tasks t
            WHERE
                (status_filter IS NULL OR t.status = status_filter)
                AND (assigned_to_filter IS NULL OR t.assigned_to_user_id = assigned_to_filter)
            ORDER BY t.created_at DESC
            LIMIT limit_count
            OFFSET offset_count;

            RAISE NOTICE '✓ Retrieved tasks summary (status=%, assigned_to=%, limit=%, offset=%)',
                status_filter, assigned_to_filter, limit_count, offset_count;
        END;
        $$;

        RAISE NOTICE '✓ Created list_tasks_summary function';
    ELSE
        RAISE NOTICE '⏭️  list_tasks_summary function already exists';
    END IF;

    RAISE NOTICE '';

    -- Function: get_user_shift_status
    -- Returns current shift status for a user (used in various validation scenarios)
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_user_shift_status') THEN
        CREATE OR REPLACE FUNCTION get_user_shift_status(
            user_id_param UUID,
            check_date DATE DEFAULT CURRENT_DATE
        )
        RETURNS TABLE (
            is_on_shift BOOLEAN,
            shift_start TIME,
            shift_end TIME,
            on_break BOOLEAN
        )
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        DECLARE
            current_time TIME := now()::time;
        BEGIN
            RETURN QUERY
            SELECT
                (ss.shift_start IS NOT NULL) as is_on_shift,
                ss.shift_start,
                ss.shift_end,
                (current_time >= ss.break_start AND current_time <= ss.break_end) as on_break
            FROM shift_schedules ss
            WHERE ss.worker_id = user_id_param
                AND ss.schedule_date = check_date
            ORDER BY ss.shift_start
            LIMIT 1;

            RAISE NOTICE '✓ Checked shift status for user % on %', user_id_param, check_date;
        END;
        $$;

        RAISE NOTICE '✓ Created get_user_shift_status function';
    ELSE
        RAISE NOTICE '⏭️  get_user_shift_status function already exists';
    END IF;

    RAISE NOTICE '';
    RAISE NOTICE '🎉 MISSING FUNCTIONS COMPLETED!';
    RAISE NOTICE '';
    RAISE NOTICE '🔍 Functions created:';
    RAISE NOTICE '   • create_task_with_autopause - Creates tasks with auto-pause logic';
    RAISE NOTICE '   • list_tasks_summary - Optimized task listing with pagination';
    RAISE NOTICE '   • get_user_shift_status - User shift status checking';
    RAISE NOTICE '';
    RAISE NOTICE '💡 These functions fix:';
    RAISE NOTICE '   • Task creation failures due to missing create_task_with_autopause';
    RAISE NOTICE '   • Slow task listing due to missing list_tasks_summary';
    RAISE NOTICE '   • User validation failures due to missing get_user_shift_status';

END $$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION create_task_with_autopause TO authenticated;
GRANT EXECUTE ON FUNCTION list_tasks_summary TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_shift_status TO authenticated;

RAISE NOTICE '';
RAISE NOTICE '🔐 Granted execute permissions to authenticated users';

-- Show all created functions for verification
SELECT
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as parameters,
    pg_get_function_result(p.oid) as returns
FROM pg_proc p
WHERE p.proname IN ('create_task_with_autopause', 'list_tasks_summary', 'get_user_shift_status')
    AND pg_function_is_visible(p.oid)
ORDER BY p.proname;