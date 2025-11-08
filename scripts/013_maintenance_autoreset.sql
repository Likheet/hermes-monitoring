-- Enable required extensions for scheduled maintenance regeneration
create extension if not exists pgcrypto with schema public;
create extension if not exists pg_cron with schema pg_catalog;

grant usage on schema cron to postgres;

-- Function: regenerate maintenance schedules into next period when prior period is sufficiently complete
create or replace function public.regenerate_maintenance_schedules(min_completion_ratio numeric default 0.6)
  returns table(
    schedule_id uuid,
    generated_tasks integer,
    period_year integer,
    period_month integer,
    next_due timestamptz
  )
  language plpgsql
  security definer
  set search_path = public, pg_temp
as
$$
declare
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
begin
  -- Take an advisory lock so only one regeneration runs at a time
  if not pg_try_advisory_xact_lock(lock_key) then
    raise notice 'Skipping maintenance regeneration; another session holds the lock.';
    return;
  end if;

  for sched in
    select ms.*
    from maintenance_schedules ms
  loop
    begin
      metadata := sched.schedule_name::jsonb;
    exception
      when others then
        if sched.schedule_name is null or btrim(sched.schedule_name) = '' then
          metadata := '{}'::jsonb;
        else
          metadata := jsonb_build_object('label', sched.schedule_name);
        end if;
    end;

    auto_reset := coalesce((metadata->>'auto_reset')::boolean, sched.auto_reset, true);
    active := coalesce((metadata->>'active')::boolean, true);

    if not auto_reset or not active then
      continue;
    end if;

    freq := coalesce(metadata->>'frequency', sched.frequency, 'monthly');
    if freq not in ('daily','weekly','biweekly','monthly','quarterly','semiannual','annual','custom') then
      freq := 'monthly';
    end if;

    frequency_weeks := null;
    begin
      frequency_weeks := (metadata->>'frequency_weeks')::int;
    exception when others then
      frequency_weeks := null;
    end;
    if frequency_weeks is null then
      frequency_weeks := sched.frequency_weeks;
    end if;

    select max(make_date(mt.period_year, mt.period_month, 1))
      into latest_period_start
    from maintenance_tasks mt
    where mt.schedule_id = sched.id
      and mt.period_year is not null
      and mt.period_month is not null;

    if latest_period_start is null then
      continue;
    end if;

    previous_period_year := extract(year from latest_period_start)::int;
    previous_period_month := extract(month from latest_period_start)::int;

    target_period_start := latest_period_start;
    if freq = 'daily' then
      target_period_start := latest_period_start + interval '1 day';
    elsif freq = 'weekly' then
      target_period_start := latest_period_start + interval '1 week';
    elsif freq = 'biweekly' then
      target_period_start := latest_period_start + interval '2 week';
    elsif freq = 'quarterly' then
      target_period_start := latest_period_start + interval '3 month';
    elsif freq = 'semiannual' then
      target_period_start := latest_period_start + interval '6 month';
    elsif freq = 'annual' then
      target_period_start := latest_period_start + interval '12 month';
    elsif freq = 'custom' then
      target_period_start := latest_period_start + coalesce(frequency_weeks, 4) * interval '1 week';
    else
      target_period_start := latest_period_start + interval '1 month';
    end if;

    target_period_start := date_trunc('month', target_period_start);

    if target_period_start <= latest_period_start then
      target_period_start := date_trunc('month', latest_period_start + interval '1 month');
    end if;

    if target_period_start > date_trunc('month', now()) then
      continue;
    end if;

    select count(*)
      into existing_count
    from maintenance_tasks
    where schedule_id = sched.id
      and period_year = extract(year from target_period_start)::int
      and period_month = extract(month from target_period_start)::int;

    if existing_count > 0 then
      continue;
    end if;

    select
      count(*) as total,
      count(*) filter (where status in ('completed','verified')) as completed,
      max(coalesce(completed_at, created_at)) as last_completion_ts
      into total_tasks, completed_tasks, last_completed_ts
    from maintenance_tasks
    where schedule_id = sched.id
      and period_year = previous_period_year
      and period_month = previous_period_month;

    if total_tasks is null or total_tasks = 0 then
      continue;
    end if;

    ratio := completed_tasks::numeric / nullif(total_tasks, 0);
    if ratio is null then
      ratio := 0;
    end if;

    if ratio < required_ratio then
      continue;
    end if;

    with previous_tasks as (
      select *
      from maintenance_tasks
      where schedule_id = sched.id
        and period_year = previous_period_year
        and period_month = previous_period_month
    ),
    inserted as (
      insert into maintenance_tasks (
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
      select
        gen_random_uuid(),
        null,
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
      from previous_tasks pt
      returning id
    )
    select count(*) into inserted_count from inserted;

    if inserted_count = 0 then
      continue;
    end if;

    next_period_date := date_trunc('month', target_period_start + interval '1 month');

    new_metadata := coalesce(metadata, '{}'::jsonb);
    new_metadata := jsonb_set(new_metadata, '{auto_reset}', to_jsonb(true), true);
    new_metadata := jsonb_set(new_metadata, '{active}', to_jsonb(true), true);
    new_metadata := jsonb_set(new_metadata, '{frequency}', to_jsonb(freq), true);
    if frequency_weeks is not null then
      new_metadata := jsonb_set(new_metadata, '{frequency_weeks}', to_jsonb(frequency_weeks), true);
    end if;
    new_metadata := jsonb_set(new_metadata, '{last_completed}', to_jsonb(coalesce(last_completed_ts, now())), true);
    new_metadata := jsonb_set(new_metadata, '{next_due}', to_jsonb(next_period_date::timestamptz), true);
    new_metadata := jsonb_set(new_metadata, '{updated_at}', to_jsonb(now()), true);

    update maintenance_schedules
    set
      last_completed = coalesce(last_completed_ts, now()),
      next_due = next_period_date::timestamptz,
      auto_reset = true,
      schedule_name = new_metadata::text
    where id = sched.id;

    schedule_id := sched.id;
    generated_tasks := inserted_count;
    period_year := extract(year from target_period_start)::int;
    period_month := extract(month from target_period_start)::int;
    next_due := next_period_date::timestamptz;
    return next;
  end loop;
end;
$$;

revoke all on function public.regenerate_maintenance_schedules(numeric) from public;
grant execute on function public.regenerate_maintenance_schedules(numeric) to postgres;
grant execute on function public.regenerate_maintenance_schedules(numeric) to service_role;

-- Schedule the daily regeneration at 01:05 UTC
select cron.schedule(
  'maintenance-autoreset',
  '5 1 * * *',
  $$select public.regenerate_maintenance_schedules();$$
);
