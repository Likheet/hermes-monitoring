-- Add assigned_to column to maintenance_schedules
ALTER TABLE public.maintenance_schedules 
ADD COLUMN IF NOT EXISTS assigned_to text[] DEFAULT NULL;

-- Update the regenerate_maintenance_schedules function to handle assignment
CREATE OR REPLACE FUNCTION public.regenerate_maintenance_schedules(min_completion_ratio numeric default 0.6)
  RETURNS TABLE(
    schedule_id uuid,
    generated_tasks integer,
    period_year integer,
    period_month integer,
    next_due timestamptz
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS
$$
DECLARE
  required_ratio numeric := greatest(least(coalesce(min_completion_ratio, 0.6), 1), 0);
  sched record;
  metadata jsonb;
  auto_reset boolean;
  active boolean;
  freq text;
  frequency_weeks int;
  latest_period_start date;
  target_period_start date;
  next_period_date date;
  existing_count int;
  total_tasks int;
  completed_tasks int;
  ratio numeric;
  last_completed_ts timestamptz;
  inserted_count int;
  new_metadata jsonb;
  previous_period_year int;
  previous_period_month int;
  lock_key bigint := 8945123490123;
  assignees text[];
  assignee_count int;
  curr_assignee text;
BEGIN
  -- Take an advisory lock so only one regeneration runs at a time
  IF NOT pg_try_advisory_xact_lock(lock_key) THEN
    RAISE NOTICE 'Skipping maintenance regeneration; another session holds the lock.';
    RETURN;
  END IF;

  FOR sched IN
    SELECT ms.*
    FROM maintenance_schedules ms
  LOOP
    BEGIN
      metadata := sched.schedule_name::jsonb;
    EXCEPTION
      WHEN others THEN
        IF sched.schedule_name IS NULL OR btrim(sched.schedule_name) = '' THEN
          metadata := '{}'::jsonb;
        ELSE
          metadata := jsonb_build_object('label', sched.schedule_name);
        END IF;
    END;

    auto_reset := coalesce((metadata->>'auto_reset')::boolean, sched.auto_reset, true);
    active := coalesce((metadata->>'active')::boolean, true);

    IF NOT auto_reset OR NOT active THEN
      CONTINUE;
    END IF;

    freq := coalesce(metadata->>'frequency', sched.frequency, 'monthly');
    IF freq NOT IN ('daily','weekly','biweekly','monthly','quarterly','semiannual','annual','custom') THEN
      freq := 'monthly';
    END IF;

    frequency_weeks := null;
    BEGIN
      frequency_weeks := (metadata->>'frequency_weeks')::int;
    EXCEPTION WHEN others THEN
      frequency_weeks := null;
    END;


    SELECT max(make_date(mt.period_year, mt.period_month, 1))
      INTO latest_period_start
    FROM maintenance_tasks mt
    WHERE mt.schedule_id = sched.id
      AND mt.period_year IS NOT NULL
      AND mt.period_month IS NOT NULL;

    IF latest_period_start IS NULL THEN
      CONTINUE;
    END IF;

    previous_period_year := extract(year from latest_period_start)::int;
    previous_period_month := extract(month from latest_period_start)::int;

    target_period_start := latest_period_start;
    IF freq = 'daily' THEN
      target_period_start := latest_period_start + interval '1 day';
    ELSIF freq = 'weekly' THEN
      target_period_start := latest_period_start + interval '1 week';
    ELSIF freq = 'biweekly' THEN
      target_period_start := latest_period_start + interval '2 week';
    ELSIF freq = 'quarterly' THEN
      target_period_start := latest_period_start + interval '3 month';
    ELSIF freq = 'semiannual' THEN
      target_period_start := latest_period_start + interval '6 month';
    ELSIF freq = 'annual' THEN
      target_period_start := latest_period_start + interval '12 month';
    ELSIF freq = 'custom' THEN
      target_period_start := latest_period_start + coalesce(frequency_weeks, 4) * interval '1 week';
    ELSE
      target_period_start := latest_period_start + interval '1 month';
    END IF;

    target_period_start := date_trunc('month', target_period_start);

    IF target_period_start <= latest_period_start THEN
      target_period_start := date_trunc('month', latest_period_start + interval '1 month');
    END IF;

    IF target_period_start > date_trunc('month', now()) THEN
      CONTINUE;
    END IF;

    SELECT count(*)
      INTO existing_count
    FROM maintenance_tasks
    WHERE schedule_id = sched.id
      AND period_year = extract(year from target_period_start)::int
      AND period_month = extract(month from target_period_start)::int;

    IF existing_count > 0 THEN
      CONTINUE;
    END IF;

    SELECT
      count(*) as total,
      count(*) filter (where status in ('completed','verified')) as completed,
      max(coalesce(completed_at, created_at)) as last_completion_ts
      INTO total_tasks, completed_tasks, last_completed_ts
    FROM maintenance_tasks
    WHERE schedule_id = sched.id
      AND period_year = previous_period_year
      AND period_month = previous_period_month;

    IF total_tasks IS NULL OR total_tasks = 0 THEN
      CONTINUE;
    END IF;

    ratio := completed_tasks::numeric / nullif(total_tasks, 0);
    IF ratio IS NULL THEN
      ratio := 0;
    END IF;

    IF ratio < required_ratio THEN
      CONTINUE;
    END IF;

    -- Handle assignment logic
    assignees := sched.assigned_to;
    assignee_count := array_length(assignees, 1);

    WITH previous_tasks AS (
      SELECT *, row_number() OVER (ORDER BY created_at) as rn
      FROM maintenance_tasks
      WHERE schedule_id = sched.id
        AND period_year = previous_period_year
        AND period_month = previous_period_month
    ),
    inserted AS (
      INSERT INTO maintenance_tasks (
        id,
        assigned_to,
        status,
        ac_location,
        task_type,
        room_number,
        period_year,
        period_month,
        schedule_id,
        started_at,
        completed_at,
        photos,
        timer_duration,
        notes,
        created_at
      )
      SELECT
        gen_random_uuid(),
        CASE 
          WHEN assignee_count > 0 THEN assignees[(rn - 1) % assignee_count + 1]
          ELSE null
        END,
        'pending',
        pt.ac_location,
        pt.task_type,
        pt.room_number,
        extract(year from target_period_start)::int,
        extract(month from target_period_start)::int,
        sched.id,
        null,
        null,
        '[]'::jsonb,
        0,
        null,
        now()
      FROM previous_tasks pt
      RETURNING id
    )
    SELECT count(*) INTO inserted_count FROM inserted;

    IF inserted_count = 0 THEN
      CONTINUE;
    END IF;

    next_period_date := date_trunc('month', target_period_start + interval '1 month');

    new_metadata := coalesce(metadata, '{}'::jsonb);
    new_metadata := jsonb_set(new_metadata, '{auto_reset}', to_jsonb(true), true);
    new_metadata := jsonb_set(new_metadata, '{active}', to_jsonb(true), true);
    new_metadata := jsonb_set(new_metadata, '{frequency}', to_jsonb(freq), true);
    IF frequency_weeks IS NOT NULL THEN
      new_metadata := jsonb_set(new_metadata, '{frequency_weeks}', to_jsonb(frequency_weeks), true);
    END IF;
    new_metadata := jsonb_set(new_metadata, '{last_completed}', to_jsonb(coalesce(last_completed_ts, now())), true);
    new_metadata := jsonb_set(new_metadata, '{next_due}', to_jsonb(next_period_date::timestamptz), true);
    new_metadata := jsonb_set(new_metadata, '{updated_at}', to_jsonb(now()), true);

    UPDATE maintenance_schedules
    SET
      last_completed = coalesce(last_completed_ts, now()),
      next_due = next_period_date::timestamptz,
      auto_reset = true,
      schedule_name = new_metadata::text
    WHERE id = sched.id;

    schedule_id := sched.id;
    generated_tasks := inserted_count;
    period_year := extract(year from target_period_start)::int;
    period_month := extract(month from target_period_start)::int;
    next_due := next_period_date::timestamptz;
    RETURN NEXT;
  END LOOP;
END;
$$;
