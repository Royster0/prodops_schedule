-- Team schedule: tables, row level security and the functions the app calls.
--
-- One row in `schedules` per team. Every other table belongs to a schedule and is
-- keyed by (schedule_id, id), so the same exported file can be imported into two
-- schedules without id clashes. Record ids are the app's own ids (text).
--
-- Access: members read, editors write. People join a schedule through an invite
-- (by email) or get a new schedule of their own the first time they sign in.

create extension if not exists btree_gist with schema extensions;

create schema if not exists private;
grant usage on schema private to authenticated;

create type public.schedule_role as enum ('editor', 'viewer');
create type public.time_off_type as enum ('vacation', 'sick', 'personal', 'unavailable');

-- Settings live on the schedule row.
create table public.schedules (
  id          uuid primary key default gen_random_uuid(),
  title       text     not null default 'Team schedule',
  week_start  smallint not null default 1  check (week_start in (0, 1)),
  clock       smallint not null default 12 check (clock in (12, 24)),
  day_start   smallint not null default 5  check (day_start between 0 and 12),
  day_end     smallint not null default 23 check (day_end between 13 and 24),
  created_at  timestamptz not null default now(),
  -- The browser tab that last wrote the row, so it can ignore its own realtime echo.
  updated_by  text
);

create table public.schedule_members (
  schedule_id uuid not null references public.schedules (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        public.schedule_role not null default 'viewer',
  -- Copied from the user's verified email when they join, for display only.
  email       text not null default '',
  joined_at   timestamptz not null default now(),
  primary key (schedule_id, user_id)
);
create index schedule_members_user on public.schedule_members (user_id);

-- Invites are claimed by email the next time that person opens the app.
create table public.schedule_invites (
  schedule_id uuid not null references public.schedules (id) on delete cascade,
  email       text not null check (email = lower(email) and email like '%_@_%'),
  role        public.schedule_role not null default 'editor',
  invited_by  uuid references auth.users (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  primary key (schedule_id, email)
);
create index schedule_invites_email on public.schedule_invites (email);

create table public.tags (
  schedule_id uuid not null references public.schedules (id) on delete cascade,
  id          text not null,
  name        text not null,
  color       text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  updated_by  text,
  primary key (schedule_id, id)
);

create table public.employees (
  schedule_id uuid not null references public.schedules (id) on delete cascade,
  id          text not null,
  name        text not null,
  color       text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  tag_ids     text[] not null default '{}',
  sort_order  double precision not null default 0,
  is_demo     boolean not null default false,
  updated_by  text,
  primary key (schedule_id, id)
);

create table public.shift_templates (
  schedule_id uuid not null references public.schedules (id) on delete cascade,
  id          text not null,
  name        text not null,
  code        varchar(3) not null,
  start_time  time not null,
  end_time    time not null,            -- end <= start means it ends the next day
  break_mins  smallint not null default 0 check (break_mins >= 0),
  color       text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  tag_ids     text[] not null default '{}',
  sort_order  double precision not null default 0,
  updated_by  text,
  primary key (schedule_id, id)
);

create table public.shifts (
  schedule_id   uuid not null references public.schedules (id) on delete cascade,
  id            text not null,
  employee_id   text not null,
  date          date not null,
  start_time    time not null,
  end_time      time not null,
  break_mins    smallint not null default 0 check (break_mins >= 0),
  -- Plain ids, no foreign keys: deleting a template or pattern keeps placed shifts,
  -- which fall back to the snapshot in template_name and color.
  template_id   text,
  template_name text not null default '',
  label         text not null default '',
  color         text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  tag_ids       text[] not null default '{}',
  note          text not null default '',
  pattern_id    text,
  updated_by    text,
  primary key (schedule_id, id),
  -- Deferred so one batch can write people and their shifts in any order.
  foreign key (schedule_id, employee_id) references public.employees (schedule_id, id)
    on delete cascade deferrable initially deferred
);
create index shifts_schedule_date on public.shifts (schedule_id, date);
create index shifts_employee_date on public.shifts (schedule_id, employee_id, date);

create table public.patterns (
  schedule_id uuid not null references public.schedules (id) on delete cascade,
  id          text not null,
  name        text not null,
  length      smallint not null check (length in (7, 14)),
  -- Template ids by day, index 0 is Monday of week A. '' is a day off.
  days        text[] not null check (cardinality(days) = length),
  sort_order  double precision not null default 0,
  updated_by  text,
  primary key (schedule_id, id)
);

create table public.holidays (
  schedule_id uuid not null references public.schedules (id) on delete cascade,
  id          text not null,
  date        date not null,
  name        text not null,
  updated_by  text,
  primary key (schedule_id, id)
);
create index holidays_schedule_date on public.holidays (schedule_id, date);

create table public.time_off (
  schedule_id uuid not null references public.schedules (id) on delete cascade,
  id          text not null,
  employee_id text not null,
  start_date  date not null,
  end_date    date not null check (end_date >= start_date),   -- inclusive
  type        public.time_off_type not null,
  note        text not null default '',
  updated_by  text,
  primary key (schedule_id, id),
  foreign key (schedule_id, employee_id) references public.employees (schedule_id, id)
    on delete cascade deferrable initially deferred,
  -- The app never stores overlapping ranges for one person; the database agrees.
  -- Deferred because merging and splitting ranges rewrites several rows at once.
  constraint time_off_no_overlap exclude using gist (
    schedule_id with =,
    employee_id with =,
    daterange(start_date, end_date, '[]') with &&
  ) deferrable initially deferred
);
create index time_off_schedule on public.time_off (schedule_id, start_date);
