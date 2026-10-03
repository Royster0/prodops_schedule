# Team schedule

A shift scheduling app for a small team (5 people today, room for about 30). A manager sees the
schedule as a visual grid and changes it by painting: pick a shift template from the palette, then
tap or drag across days. Scheduling only: there is nothing about pay, wages or cost.

Built with React, TypeScript, Vite, [Motion](https://motion.dev) for animation and
[Zustand](https://zustand.docs.pmnd.rs) for state. No CSS framework, no UI kit, no date library.

## Scripts

```bash
npm install
npm run dev        # start the dev server
npm run build      # type-check and build for production
npm test           # run the unit tests once (Vitest)
npm run test:watch # run tests on change
npm run lint       # ESLint
```

## What it does

- **Views:** Day (hour timeline), Week, 2 weeks and Month, with previous, next and Today.
- **Painting:** template brushes, Erase, and Vacation, Sick, Personal and Unavailable brushes.
  Drag across cells to paint many; tap a date header to fill that day for everyone shown.
- **Selection:** tap avatars to select people. Painting a selected person's day fills it for
  everyone selected.
- **Apply shifts:** a template, custom times, a 1 or 2 week work pattern, or time off, for one
  person, the selection, everyone shown or a tag, over any dates, with a plain summary first.
- **Time off and holidays:** ranges that merge and split as you paint; holidays are highlighted and
  skipped when applying. Common US holidays can be added in one step.
- **Filters** by person, tag and shift type; **coverage** per hour on every day; **undo** for every
  change (Ctrl or Cmd+Z).
- **Manage** people, templates, patterns, tags, holidays and settings; export and import JSON.
- Light and dark themes, responsive down to 360px, keyboard shortcuts, reduced motion support.

Keyboard: arrows move the period, T today, D / W / M switch views, V select, E erase, 1 to 9 pick
templates, Escape returns to Select, Ctrl or Cmd+Z undoes.

## How the code is organized

```
src/
  domain/   Pure, tested scheduling rules. No React.
            types, dates, time, format, color, shifts, changeSet, undo, painting, timeOff,
            apply, patterns, filters, coverage, holidays, copy, manage, demo, seed, period,
            scheduleIndex
  data/     Storage: the ScheduleRepository interface, LocalStorageRepository, SupabaseRepository
            and its row mapping, schema and migrations, export and import, preferences.
  auth/     Magic link sign-in and the signed-in account.
  store/    One Zustand store composed from slices (data, undo, view, tool, selection, filters,
            ui), memoized selectors, and board actions.
  components/ Shared UI: Header, Dock, FilterBar, SelectionBar, HintBar, Toast, Popover, Menu,
            Sheet, Segmented, Tabs, ShiftBlock, ShiftBar, TimeOffBlock, CoverageStrip, Avatar,
            form controls.
  views/    Board, WeekView (Week and 2 weeks), DayView, MonthView, EmptyState.
  sheets/   Dialogs: shift, time off, apply, manage (one file per tab), person, template,
            pattern, tag and import.
  hooks/    usePaintStroke, useKeyboardShortcuts, useMediaQuery, useNow, useAppLifecycle.
  styles/   tokens.css (light and dark design tokens) and global.css.
  testing/  Fixtures and in-memory storage for tests.
```

Every change goes through one path: a domain function writes to a `ChangeSet`, which records each
change as a `{ collection, id, before, after }` op. `commit()` in the store applies the ops, pushes
one undo entry and hands the same batch to the repository. Undo replays the `before` values in
reverse.

Rendering stays fast while painting: the schedule index hands out per-cell, per-row and per-day
arrays that are reused when nothing in them changed, so memoized cells, rows and days re-render
only when their own data did. Pointer strokes are tracked outside React state.

## Storage

With `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` set, people sign in with Google or a magic link
and the schedule is stored in Supabase, shared with the team in real time. The owner decides who
can edit and who can only view. [SUPABASE.md](SUPABASE.md) has the setup steps (migrations, auth redirect URLs,
env variables) and how it works.

Without them, data is saved in this browser under one versioned localStorage key (`schedule.v1`),
with writes debounced by about 250 ms. UI preferences (view and theme) always stay on the device,
under `schedule.prefs.v1`.
