-- Opening an invite link now opens the schedule the person was invited to, even if
-- they already had another schedule open on that device. Safe to run more than once.

create or replace function private.join_schedule(preferred uuid default null)
returns table (schedule_id uuid, role public.schedule_role, created boolean)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  uid uuid := (select auth.uid());
  user_email text := lower(coalesce((select auth.jwt()) ->> 'email', ''));
  new_id uuid;
  claimed uuid;
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
      -- An invite never changes the owner's own access.
      and not exists (
        select 1 from public.schedules s where s.id = i.schedule_id and s.owner_id = uid
      )
    on conflict on constraint schedule_members_pkey do update set role = excluded.role;
    -- The schedule someone was just invited to opens first, whatever they had open before.
    select i.schedule_id into claimed
    from public.schedule_invites i
    join public.schedule_members m on m.schedule_id = i.schedule_id and m.user_id = uid
    where i.email = user_email
    order by i.created_at desc
    limit 1;
    delete from public.schedule_invites i where i.email = user_email;
  end if;

  if not exists (select 1 from public.schedule_members m where m.user_id = uid) then
    insert into public.schedules (owner_id) values (uid) returning id into new_id;
    insert into public.schedule_members (schedule_id, user_id, role, email)
    values (new_id, uid, 'editor', user_email);
    return query select new_id, 'editor'::public.schedule_role, true;
    return;
  end if;

  return query
    select m.schedule_id, m.role, false
    from public.schedule_members m
    where m.user_id = uid
    order by (m.schedule_id = coalesce(claimed, preferred)) desc nulls last, m.joined_at desc
    limit 1;
end;
$$;
