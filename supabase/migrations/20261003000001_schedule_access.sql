-- Who can read and write each schedule: members read, editors write.

-- Membership checks. Security definer so policies on schedule_members can use them
-- without recursing; kept in the unexposed private schema.
create function private.is_member(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.schedule_members
    where schedule_id = target and user_id = (select auth.uid())
  );
$$;

create function private.is_editor(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.schedule_members
    where schedule_id = target and user_id = (select auth.uid()) and role = 'editor'
  );
$$;

revoke all on function private.is_member(uuid), private.is_editor(uuid) from public, anon;
grant execute on function private.is_member(uuid), private.is_editor(uuid) to authenticated;

-- Row level security: members read, editors write. Nothing is open to anon.
alter table public.schedules enable row level security;
create policy "members read" on public.schedules for select to authenticated
  using (private.is_member(id));
create policy "editors update" on public.schedules for update to authenticated
  using (private.is_editor(id)) with check (private.is_editor(id));

alter table public.schedule_members enable row level security;
create policy "members read" on public.schedule_members for select to authenticated
  using (private.is_member(schedule_id));
create policy "editors update" on public.schedule_members for update to authenticated
  using (private.is_editor(schedule_id)) with check (private.is_editor(schedule_id));
create policy "editors remove" on public.schedule_members for delete to authenticated
  using (private.is_editor(schedule_id));

alter table public.schedule_invites enable row level security;
create policy "members read" on public.schedule_invites for select to authenticated
  using (private.is_member(schedule_id));
create policy "editors invite" on public.schedule_invites for insert to authenticated
  with check (private.is_editor(schedule_id));
create policy "editors update" on public.schedule_invites for update to authenticated
  using (private.is_editor(schedule_id)) with check (private.is_editor(schedule_id));
create policy "editors remove" on public.schedule_invites for delete to authenticated
  using (private.is_editor(schedule_id));

do $$
declare t text;
begin
  foreach t in array array['tags', 'employees', 'shift_templates', 'shifts', 'patterns', 'holidays', 'time_off']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "members read" on public.%I for select to authenticated using (private.is_member(schedule_id))', t);
    execute format(
      'create policy "editors insert" on public.%I for insert to authenticated with check (private.is_editor(schedule_id))', t);
    execute format(
      'create policy "editors update" on public.%I for update to authenticated using (private.is_editor(schedule_id)) with check (private.is_editor(schedule_id))', t);
    execute format(
      'create policy "editors delete" on public.%I for delete to authenticated using (private.is_editor(schedule_id))', t);
  end loop;
end $$;

-- The Data API only sees what is granted; RLS then picks the rows.
-- Supabase's default grants include truncate, which skips RLS, so start from nothing.
revoke all on all tables in schema public from anon, authenticated;
grant select, update on public.schedules to authenticated;
grant select, update, delete on public.schedule_members to authenticated;
grant select, insert, update, delete on public.schedule_invites to authenticated;
grant select, insert, update, delete on
  public.tags, public.employees, public.shift_templates, public.shifts,
  public.patterns, public.holidays, public.time_off
  to authenticated;
