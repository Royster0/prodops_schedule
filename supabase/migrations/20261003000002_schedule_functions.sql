-- The functions the app calls, and realtime. Safe to run more than once.

-- Claims any invites for the signed-in user's email, creates a schedule for them
-- if they belong to none, and returns the schedule to open (the latest joined).
create or replace function private.join_schedule()
returns table (schedule_id uuid, role public.schedule_role, created boolean)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  uid uuid := (select auth.uid());
  user_email text := lower(coalesce((select auth.jwt()) ->> 'email', ''));
  new_id uuid;
begin
  if uid is null then
    raise exception 'Sign in first.' using errcode = '28000';
  end if;
  -- Two tabs opening at once must not create two schedules for one new person.
  perform pg_advisory_xact_lock(hashtext('join_schedule:' || uid::text));

  if user_email <> '' then
    insert into public.schedule_members as m (schedule_id, user_id, role, email)
    select i.schedule_id, uid, i.role, user_email
    from public.schedule_invites i
    where i.email = user_email
    on conflict on constraint schedule_members_pkey do update set role = excluded.role;
    delete from public.schedule_invites i where i.email = user_email;
  end if;

  if not exists (select 1 from public.schedule_members m where m.user_id = uid) then
    insert into public.schedules default values returning id into new_id;
    insert into public.schedule_members (schedule_id, user_id, role, email)
    values (new_id, uid, 'editor', user_email);
    return query select new_id, 'editor'::public.schedule_role, true;
    return;
  end if;

  return query
    select m.schedule_id, m.role, false
    from public.schedule_members m
    where m.user_id = uid
    order by m.joined_at desc
    limit 1;
end;
$$;

revoke all on function private.join_schedule() from public, anon;
grant execute on function private.join_schedule() to authenticated;

create or replace function public.join_schedule()
returns table (schedule_id uuid, role public.schedule_role, created boolean)
language sql security invoker set search_path = '' as $$
  select * from private.join_schedule();
$$;

revoke all on function public.join_schedule() from public, anon;
grant execute on function public.join_schedule() to authenticated;

-- Writes one user action as one transaction. Each op is
-- { "table": <table>, "id": <record id>, "row": <columns> | null }, where a null row
-- deletes the record and the table "schedules" updates the schedule's settings.
-- Runs as the caller, so the policies above decide what may be written.
create or replace function public.apply_changes(p_schedule uuid, p_client text, p_ops jsonb)
returns void
language plpgsql security invoker set search_path = '' as $$
declare
  op jsonb;
  tbl text;
  cols text;
  col_list text;
  value_list text;
  update_list text;
  affected integer;
begin
  if not private.is_editor(p_schedule) then
    raise exception 'You can view this schedule but not change it.' using errcode = '42501';
  end if;

  for op in select * from jsonb_array_elements(p_ops)
  loop
    tbl := op ->> 'table';

    if tbl = 'schedules' then
      update public.schedules s set
        title = r.title,
        week_start = r.week_start,
        clock = r.clock,
        day_start = r.day_start,
        day_end = r.day_end,
        updated_by = p_client
      from jsonb_populate_record(null::public.schedules, op -> 'row') r
      where s.id = p_schedule;
      continue;
    end if;

    cols := case tbl
      when 'tags' then 'name,color'
      when 'employees' then 'name,color,tag_ids,sort_order,is_demo'
      when 'shift_templates' then 'name,code,start_time,end_time,break_mins,color,tag_ids,sort_order'
      when 'shifts' then 'employee_id,date,start_time,end_time,break_mins,template_id,template_name,label,color,tag_ids,note,pattern_id'
      when 'patterns' then 'name,length,days,sort_order'
      when 'holidays' then 'date,name'
      when 'time_off' then 'employee_id,start_date,end_date,type,note'
    end;
    if cols is null then
      raise exception 'Unknown table %', tbl using errcode = '22023';
    end if;

    if op -> 'row' is null or jsonb_typeof(op -> 'row') = 'null' then
      execute format('delete from public.%I where schedule_id = $1 and id = $2', tbl)
        using p_schedule, op ->> 'id';
      continue;
    end if;

    select string_agg(quote_ident(c), ', '),
           string_agg('r.' || quote_ident(c), ', '),
           string_agg(quote_ident(c) || ' = excluded.' || quote_ident(c), ', ')
      into col_list, value_list, update_list
      from unnest(string_to_array(cols, ',')) as c;

    execute format(
      'insert into public.%1$I (schedule_id, id, updated_by, %2$s)
       select $1, $2, $3, %3$s from jsonb_populate_record(null::public.%1$I, $4) r
       on conflict (schedule_id, id) do update set updated_by = excluded.updated_by, %4$s',
      tbl, col_list, value_list, update_list
    ) using p_schedule, op ->> 'id', p_client, op -> 'row';
    get diagnostics affected = row_count;
    if affected = 0 then
      raise exception 'Could not save % %', tbl, op ->> 'id' using errcode = '42501';
    end if;
  end loop;
end;
$$;

revoke all on function public.apply_changes(uuid, text, jsonb) from public, anon;
grant execute on function public.apply_changes(uuid, text, jsonb) to authenticated;

-- Realtime: teammates see each other's changes. Deletes carry the primary key,
-- which includes schedule_id, so the app can ignore other schedules' deletes.
do $$
declare t text;
begin
  foreach t in array array['schedules', 'tags', 'employees', 'shift_templates', 'shifts', 'patterns', 'holidays', 'time_off']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
