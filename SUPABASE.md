# Moving storage to Supabase

The app only talks to storage through `ScheduleRepository` (`src/data/repository.ts`):

```ts
interface ScheduleRepository {
  load(): Promise<ScheduleData>;
  apply(ops: ChangeOp[]): Promise<void>; // batched writes from one user action
  subscribe?(onChange: (data: ScheduleData) => void): () => void; // realtime
  flush?(): void;
  readonly savedLabel: string;
}
```

Today `LocalStorageRepository` keeps everything under one localStorage key. This document describes
how a `SupabaseRepository` would replace it without touching the UI. It is a plan, not an
implementation.

## Tables

One row in `schedules` per team. Every other table belongs to a schedule. Names are snake_case,
keys are `uuid`, dates are `date` and times of day are `time`. The app already creates UUIDs on
the client (`createId()`), so inserts can use the client's id.

```sql
create extension if not exists btree_gist;

create type schedule_role as enum ('editor', 'viewer');
create type time_off_type as enum ('vacation', 'sick', 'personal', 'unavailable');

-- Settings live on the schedule row.
create table schedules (
  id          uuid primary key default gen_random_uuid(),
  title       text     not null default 'Team schedule',
  week_start  smallint not null default 1  check (week_start in (0, 1)),
  clock       smallint not null default 12 check (clock in (12, 24)),
  day_start   smallint not null default 5  check (day_start between 0 and 12),
  day_end     smallint not null default 23 check (day_end between 13 and 24),
  created_at  timestamptz not null default now()
);

create table schedule_members (
  schedule_id uuid not null references schedules (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        schedule_role not null default 'viewer',
  primary key (schedule_id, user_id)
);

create table tags (
  id          uuid primary key,
  schedule_id uuid not null references schedules (id) on delete cascade,
  name        text not null,
  color       text not null check (color ~ '^#[0-9A-Fa-f]{6}$')
);

create table employees (
  id          uuid primary key,
  schedule_id uuid not null references schedules (id) on delete cascade,
  name        text not null,
  color       text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  tag_ids     uuid[] not null default '{}',
  sort_order  integer not null default 0,
  is_demo     boolean not null default false
);

create table shift_templates (
  id          uuid primary key,
  schedule_id uuid not null references schedules (id) on delete cascade,
  name        text not null,
  code        varchar(3) not null,
  start_time  time not null,
  end_time    time not null,            -- end <= start means it ends the next day
  break_mins  smallint not null default 0 check (break_mins >= 0),
  color       text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  tag_ids     uuid[] not null default '{}',
  sort_order  integer not null default 0
);

create table shifts (
  id            uuid primary key,
  schedule_id   uuid not null references schedules (id) on delete cascade,
  employee_id   uuid not null references employees (id) on delete cascade,
  date          date not null,
  start_time    time not null,
  end_time      time not null,
  break_mins    smallint not null default 0 check (break_mins >= 0),
  -- Deleting a template keeps placed shifts; they fall back to the snapshot below.
  template_id   uuid references shift_templates (id) on delete set null,
  template_name text not null default '',
  label         text not null default '',
  color         text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  tag_ids       uuid[] not null default '{}',
  note          text not null default '',
  -- The work pattern that placed the shift, for filtering. Kept as a plain id:
  -- deleting a pattern leaves its shifts in place.
  pattern_id    uuid
);
create index shifts_schedule_date on shifts (schedule_id, date);
create index shifts_employee_date on shifts (employee_id, date);

create table patterns (
  id          uuid primary key,
  schedule_id uuid not null references schedules (id) on delete cascade,
  name        text not null,
  length      smallint not null check (length in (7, 14)),
  -- Index 0 is Monday of week A. null is a day off (the app uses '').
  days        uuid[] not null check (cardinality(days) = length),
  sort_order  integer not null default 0
);

create table holidays (
  id          uuid primary key,
  schedule_id uuid not null references schedules (id) on delete cascade,
  date        date not null,
  name        text not null,
  unique (schedule_id, date)
);

create table time_off (
  id          uuid primary key,
  schedule_id uuid not null references schedules (id) on delete cascade,
  employee_id uuid not null references employees (id) on delete cascade,
  start_date  date not null,
  end_date    date not null check (end_date >= start_date),   -- inclusive
  type        time_off_type not null,
  note        text not null default '',
  -- The app never stores overlapping ranges for one person; the database agrees.
  exclude using gist (employee_id with =, daterange(start_date, end_date, '[]') with &&)
);
create index time_off_schedule on time_off (schedule_id, start_date);
```

Notes on the shape:

- **Cascades.** Deleting an employee removes their shifts and time off in the database, which is
  what `deleteEmployee()` already does in the app. Deleting a schedule removes everything.
- **Tags are `uuid[]` columns**, mirroring the app's `tags: ID[]` so each `ChangeOp` maps to exactly
  one row write. The trade-off is no foreign key from the array to `tags`; the app's `deleteTag()`
  already emits the ops that strip a deleted tag from people, templates and shifts. If stricter
  integrity is wanted later, move to `employee_tags`, `template_tags` and `shift_tags` join tables
  and have the repository diff the arrays.
- **Hours are never stored**, same as the app. They are derived from times and break.

## Row level security: editors write, viewers read

```sql
create or replace function is_member(target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from schedule_members
    where schedule_id = target and user_id = auth.uid()
  );
$$;

create or replace function is_editor(target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from schedule_members
    where schedule_id = target and user_id = auth.uid() and role = 'editor'
  );
$$;

alter table schedules enable row level security;
create policy "members read"   on schedules for select using (is_member(id));
create policy "editors update" on schedules for update using (is_editor(id)) with check (is_editor(id));

alter table schedule_members enable row level security;
create policy "members read"   on schedule_members for select using (is_member(schedule_id));
create policy "editors manage" on schedule_members for all
  using (is_editor(schedule_id)) with check (is_editor(schedule_id));

-- The same two policies on every schedule-owned table.
do $$
declare t text;
begin
  foreach t in array array['tags', 'employees', 'shift_templates', 'shifts', 'patterns', 'holidays', 'time_off']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "members read" on %I for select using (is_member(schedule_id))', t);
    execute format(
      'create policy "editors write" on %I for all using (is_editor(schedule_id)) with check (is_editor(schedule_id))',
      t
    );
  end loop;
end $$;
```

Viewers can load and subscribe but every write is rejected by the database. The UI could read the
member's role and hide the dock and editing controls for viewers, but the security lives in RLS.

## SupabaseRepository

```ts
class SupabaseRepository implements ScheduleRepository {
  readonly savedLabel = 'Saved';
  private cache: ScheduleData | null = null;

  constructor(
    private client: SupabaseClient,
    private scheduleId: string,
  ) {}

  async load(): Promise<ScheduleData> {
    // One select per table, filtered by schedule_id, in parallel.
    // Map snake_case rows to the app's records: start_time '07:00:00' -> start '07:00',
    // sort_order -> order, pattern days null -> '', schedules row -> settings.
    this.cache = await loadAll(this.client, this.scheduleId);
    return this.cache;
  }

  async apply(ops: ChangeOp[]): Promise<void> {
    // One user action is one transaction: send the ops to a Postgres function,
    // e.g. rpc('apply_changes', { schedule_id, ops }), which loops over them and
    // upserts `after` (or deletes when `after` is null) per collection, and
    // updates the schedules row for settings. Parents (employees, templates, tags)
    // are written before shifts and time off so foreign keys hold.
    const { error } = await this.client.rpc('apply_changes', {
      schedule_id: this.scheduleId,
      ops: ops.map(toRowOp),
    });
    if (error) throw error;
    this.cache = applyOps(this.cache!, ops);
  }

  subscribe(onChange: (data: ScheduleData) => void): () => void {
    const channel = this.client
      .channel(`schedule:${this.scheduleId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', filter: `schedule_id=eq.${this.scheduleId}` },
        (payload) => {
          // Turn the row change into a ChangeOp and replay it on the cache.
          // Our own writes echo back with identical values, so replaying is harmless.
          this.cache = applyOps(this.cache!, [fromRealtime(payload)]);
          onChange(this.cache);
        },
      )
      .subscribe();
    return () => void this.client.removeChannel(channel);
  }
}
```

How it fits the existing app:

- **The UI does not change.** Every change already goes through `commit()` in the store, which
  produces one batch of `ChangeOp`s per user action and passes it to `repository.apply()`. A paint
  stroke is one batch, an "Apply 80 shifts" is one batch, and an undo is one batch of inverted ops.
- **Save status.** The store shows "Saving…" while `apply()` is pending and the repository's
  `savedLabel` ("Saved") once it resolves. A rejected write shows the error status.
- **Realtime.** The store already calls `repository.subscribe?.()` after loading and replaces its
  data with what the repository pushes. Debouncing realtime bursts (for example a teammate's large
  apply) by about 100 ms keeps re-renders cheap; cells are memoized on unchanged arrays, so only
  touched cells re-render.
- **Conflicts.** Writes are last-write-wins per row, which suits a small team painting different
  cells. The local undo stack only knows this browser's actions; undoing after a teammate changed
  the same record restores this browser's `before` value, which is the expected behavior for
  "undo what I did".
- **Switching.** Swap `new LocalStorageRepository()` for `new SupabaseRepository(client, id)` in
  `src/store/useScheduleStore.ts`. A one-time migration can call `load()` on the local repository
  and send everything to Supabase with the same `replaceAll()` used by Import.
