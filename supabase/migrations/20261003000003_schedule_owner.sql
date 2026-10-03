-- Each schedule has one owner: the person who created it. Only the owner decides who
-- can see or change the schedule (invites, roles, removing people). Editors change
-- the schedule itself, viewers only look. Run after the earlier migrations.

alter table public.schedules
  add column if not exists owner_id uuid references auth.users (id) on delete set null;
create index if not exists schedules_owner on public.schedules (owner_id);

-- Schedules made before owners existed: the first editor to join becomes the owner.
update public.schedules s
set owner_id = (
  select m.user_id from public.schedule_members m
  where m.schedule_id = s.id and m.role = 'editor'
  order by m.joined_at
  limit 1
)
where s.owner_id is null;

create or replace function private.is_owner(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.schedules
    where id = target and owner_id = (select auth.uid())
  );
$$;

revoke all on function private.is_owner(uuid) from public, anon;
grant execute on function private.is_owner(uuid) to authenticated;

-- Membership: only the owner changes someone's role or removes them, and never their
-- own row, so a schedule can't lose its owner. Anyone else may leave.
drop policy if exists "editors update" on public.schedule_members;
drop policy if exists "editors remove" on public.schedule_members;
drop policy if exists "owner updates" on public.schedule_members;
drop policy if exists "owner removes, members leave" on public.schedule_members;
create policy "owner updates" on public.schedule_members for update to authenticated
  using (private.is_owner(schedule_id) and user_id <> (select auth.uid()))
  with check (private.is_owner(schedule_id) and user_id <> (select auth.uid()));
create policy "owner removes, members leave" on public.schedule_members for delete to authenticated
  using (
    (private.is_owner(schedule_id) and user_id <> (select auth.uid()))
    or (user_id = (select auth.uid()) and not private.is_owner(schedule_id))
  );

-- Invites: only the owner sends, changes or cancels them.
drop policy if exists "editors invite" on public.schedule_invites;
drop policy if exists "editors update" on public.schedule_invites;
drop policy if exists "editors remove" on public.schedule_invites;
drop policy if exists "owner invites" on public.schedule_invites;
drop policy if exists "owner updates" on public.schedule_invites;
drop policy if exists "owner removes" on public.schedule_invites;
create policy "owner invites" on public.schedule_invites for insert to authenticated
  with check (private.is_owner(schedule_id));
create policy "owner updates" on public.schedule_invites for update to authenticated
  using (private.is_owner(schedule_id)) with check (private.is_owner(schedule_id));
create policy "owner removes" on public.schedule_invites for delete to authenticated
  using (private.is_owner(schedule_id));

-- Through the API only these columns can change: a role, or the schedule's settings.
-- Ownership can't be taken by editing a row.
revoke update on public.schedules, public.schedule_members from authenticated;
grant update (title, week_start, clock, day_start, day_end, updated_by) on public.schedules to authenticated;
grant update (role) on public.schedule_members to authenticated;

-- join_schedule now records the owner and can open a chosen schedule.
drop function if exists public.join_schedule();
drop function if exists private.join_schedule();
drop function if exists public.join_schedule(uuid);
drop function if exists private.join_schedule(uuid);

-- Claims invites for the signed-in user's email, creates a schedule they own if they
-- belong to none, and returns the schedule to open: `preferred` when they are still a
-- member of it, otherwise the one they joined most recently.
create function private.join_schedule(preferred uuid default null)
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
      -- An invite never changes the owner's own access.
      and not exists (
        select 1 from public.schedules s where s.id = i.schedule_id and s.owner_id = uid
      )
    on conflict on constraint schedule_members_pkey do update set role = excluded.role;
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
    order by (m.schedule_id = preferred) desc nulls last, m.joined_at desc
    limit 1;
end;
$$;

revoke all on function private.join_schedule(uuid) from public, anon;
grant execute on function private.join_schedule(uuid) to authenticated;

create function public.join_schedule(preferred uuid default null)
returns table (schedule_id uuid, role public.schedule_role, created boolean)
language sql security invoker set search_path = '' as $$
  select * from private.join_schedule(preferred);
$$;

revoke all on function public.join_schedule(uuid) from public, anon;
grant execute on function public.join_schedule(uuid) to authenticated;
