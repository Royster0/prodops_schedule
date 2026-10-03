-- Sign-in emails on people, and view-only access for everyone else who signs in.
-- Run after the earlier migrations.
--
-- The owner links an email to a person on the schedule and picks what that person can
-- do (edit or view). Under the hood that is the person's membership, or an invite when
-- they haven't signed in yet, carrying the person's id.
--
-- A schedule marked open_to_signed_in can be viewed by anyone who signs in: they join
-- it as a viewer automatically. The owner can turn that off.

alter table public.schedule_members add column if not exists employee_id text;
alter table public.schedule_invites add column if not exists employee_id text;

-- Deleting a person drops the link but keeps the account's access as it was.
alter table public.schedule_members drop constraint if exists schedule_members_employee_fk;
alter table public.schedule_members add constraint schedule_members_employee_fk
  foreign key (schedule_id, employee_id) references public.employees (schedule_id, id)
  on delete set null (employee_id);
alter table public.schedule_invites drop constraint if exists schedule_invites_employee_fk;
alter table public.schedule_invites add constraint schedule_invites_employee_fk
  foreign key (schedule_id, employee_id) references public.employees (schedule_id, id)
  on delete cascade;

-- One sign-in per person.
create unique index if not exists schedule_members_employee
  on public.schedule_members (schedule_id, employee_id) where employee_id is not null;
create unique index if not exists schedule_invites_employee
  on public.schedule_invites (schedule_id, employee_id) where employee_id is not null;

alter table public.schedules
  add column if not exists open_to_signed_in boolean not null default false;

-- The team's existing schedule (the oldest) is the one people see when they sign in.
update public.schedules set open_to_signed_in = true
where id = (select id from public.schedules order by created_at limit 1)
  and not exists (select 1 from public.schedules where open_to_signed_in);

-- Link an email to a person, change what they can do, or (with an empty email) unlink
-- them. Returns 'member' when the email already has access, 'invited' when an invite
-- now waits for them to sign in, or 'unlinked'.
create or replace function private.assign_person(
  p_schedule uuid, p_employee text, p_email text, p_role public.schedule_role
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  address text := lower(trim(coalesce(p_email, '')));
  owner uuid;
  target uuid;
begin
  select s.owner_id into owner from public.schedules s where s.id = p_schedule;
  if owner is null or owner <> (select auth.uid()) then
    raise exception 'Only the schedule''s owner can change who has access.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.employees e where e.schedule_id = p_schedule and e.id = p_employee) then
    raise exception 'That person isn''t saved yet. Try again in a moment.' using errcode = '23503';
  end if;
  if address <> '' and address not like '%_@_%' then
    raise exception 'Enter a full email address.' using errcode = '22023';
  end if;

  select m.user_id into target from public.schedule_members m
  where m.schedule_id = p_schedule and lower(m.email) = address and address <> '';

  -- Whoever held this person before goes back to view only (never the owner).
  update public.schedule_members m
  set employee_id = null, role = case when m.user_id = owner then m.role else 'viewer' end
  where m.schedule_id = p_schedule and m.employee_id = p_employee
    and m.user_id is distinct from target;
  delete from public.schedule_invites i
  where i.schedule_id = p_schedule and i.employee_id = p_employee and i.email <> address;

  if address = '' then
    return 'unlinked';
  end if;

  if target is not null then
    delete from public.schedule_invites i where i.schedule_id = p_schedule and i.email = address;
    update public.schedule_members m
    set employee_id = p_employee,
        role = case when m.user_id = owner then m.role else p_role end
    where m.schedule_id = p_schedule and m.user_id = target;
    return 'member';
  end if;

  insert into public.schedule_invites as i (schedule_id, email, role, employee_id, invited_by)
  values (p_schedule, address, p_role, p_employee, owner)
  on conflict on constraint schedule_invites_pkey
  do update set role = excluded.role, employee_id = excluded.employee_id;
  return 'invited';
end;
$$;

revoke all on function private.assign_person(uuid, text, text, public.schedule_role) from public, anon;
grant execute on function private.assign_person(uuid, text, text, public.schedule_role) to authenticated;

create or replace function public.assign_person(
  p_schedule uuid, p_employee text, p_email text, p_role public.schedule_role
) returns text
language sql security invoker set search_path = '' as $$
  select private.assign_person(p_schedule, p_employee, p_email, p_role);
$$;

revoke all on function public.assign_person(uuid, text, text, public.schedule_role) from public, anon;
grant execute on function public.assign_person(uuid, text, text, public.schedule_role) to authenticated;

-- Turn view-only access for everyone who signs in on or off.
create or replace function private.set_schedule_open(p_schedule uuid, p_open boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.schedules s set open_to_signed_in = p_open
  where s.id = p_schedule and s.owner_id = (select auth.uid());
  if not found then
    raise exception 'Only the schedule''s owner can change this.' using errcode = '42501';
  end if;
end;
$$;

revoke all on function private.set_schedule_open(uuid, boolean) from public, anon;
grant execute on function private.set_schedule_open(uuid, boolean) to authenticated;

create or replace function public.set_schedule_open(p_schedule uuid, p_open boolean) returns void
language sql security invoker set search_path = '' as $$
  select private.set_schedule_open(p_schedule, p_open);
$$;

revoke all on function public.set_schedule_open(uuid, boolean) from public, anon;
grant execute on function public.set_schedule_open(uuid, boolean) to authenticated;

-- join_schedule now also carries an invite's person over to the membership, and makes
-- everyone who signs in a viewer of each open schedule they aren't on yet. Someone
-- with no schedule at all still gets a new one they own when nothing is open.
create or replace function private.join_schedule(preferred uuid default null)
returns table (schedule_id uuid, role public.schedule_role, created boolean)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  uid uuid := (select auth.uid());
  user_email text := lower(coalesce((select auth.jwt()) ->> 'email', ''));
  claimed uuid;
  new_id uuid;
begin
  if uid is null then
    raise exception 'Sign in first.' using errcode = '28000';
  end if;
  -- Two tabs opening at once must not create two schedules for one new person.
  perform pg_advisory_xact_lock(hashtext('join_schedule:' || uid::text));

  if user_email <> '' then
    -- The newest invite wins when there are several; it opens first below.
    select i.schedule_id into claimed
    from public.schedule_invites i
    where i.email = user_email
      and not exists (select 1 from public.schedules s where s.id = i.schedule_id and s.owner_id = uid)
    order by i.created_at desc
    limit 1;

    -- A person can have only one sign-in: the invite takes it from anyone else.
    update public.schedule_members m set employee_id = null
    from public.schedule_invites i
    where i.email = user_email and i.employee_id is not null
      and m.schedule_id = i.schedule_id and m.employee_id = i.employee_id and m.user_id <> uid;

    insert into public.schedule_members as m (schedule_id, user_id, role, email, employee_id)
    select i.schedule_id, uid, i.role, user_email, i.employee_id
    from public.schedule_invites i
    where i.email = user_email
      -- An invite never changes the owner's own access.
      and not exists (
        select 1 from public.schedules s where s.id = i.schedule_id and s.owner_id = uid
      )
    on conflict on constraint schedule_members_pkey do update
      set role = excluded.role, employee_id = coalesce(excluded.employee_id, m.employee_id);
    delete from public.schedule_invites i where i.email = user_email;
  end if;

  -- Open schedules: view only until the owner links this account to a person.
  insert into public.schedule_members (schedule_id, user_id, role, email)
  select s.id, uid, 'viewer', user_email
  from public.schedules s
  where s.open_to_signed_in
  on conflict on constraint schedule_members_pkey do nothing;

  if not exists (select 1 from public.schedule_members m where m.user_id = uid) then
    insert into public.schedules (owner_id, open_to_signed_in)
    values (uid, not exists (select 1 from public.schedules)) returning id into new_id;
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
