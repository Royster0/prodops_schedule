# Supabase

The schedule is stored in Supabase and people sign in with a magic link. Without the two env
variables below the app runs as before: no sign-in, data in this browser only.

## Setup

1. **Database.** Run the files in `supabase/migrations/` in order, in the dashboard's SQL Editor
   (or `supabase db push` with the CLI). They create the tables, row level security, the
   `join_schedule` and `apply_changes` functions, and turn on realtime for the schedule tables.
   The last file is safe to run again.
2. **Auth URLs.** In Authentication > URL Configuration, set the Site URL to the production
   address and add every address the app runs on to Redirect URLs:
   - `http://localhost:5173/**` (the dev server)
   - `https://<your-app>.vercel.app/**` (production)
   - `https://*-<your-team>.vercel.app/**` (Vercel previews, if you use them)

   The magic link only returns to an address on this list.

3. **Email.** The Email provider is on by default. Supabase's built-in mailer only sends a few
   emails an hour, so set up custom SMTP (Authentication > Emails > SMTP Settings) before the
   team starts using it.
4. **Env variables**, locally in `.env.local` and in Vercel (Project Settings > Environment
   Variables, then redeploy):

   ```
   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```

   Only the publishable key belongs in the app. Never use a secret or `service_role` key here:
   everything with a `VITE_` prefix is shipped to the browser.

## How it works

**Signing in.** `src/auth/AuthGate.tsx` shows the sign-in screen until there is a session. The
link in the email brings the person back signed in; supabase-js keeps the session in the browser
and refreshes it.

**Who sees what.** Every table belongs to a schedule. `schedule_members` says who is on it, as an
`editor` (can change things) or `viewer` (can look). Row level security lets members read and
editors write; the anon role has no access at all. Viewers see "View only" in the header and the
app refuses their edits with a toast.

**Joining.** On every load the app calls `join_schedule()`. It first turns any invites for the
person's email into memberships, then, if they belong to no schedule, creates one with them as
editor. The first time that happens in a browser that already had a schedule saved locally, that
schedule is moved into the new account (the local copy is kept under `schedule.v1.moved`).
Editors invite people by email in Settings > Team; the invite is claimed the next time that person
signs in. Someone on several schedules opens the one they joined most recently.

**Saving.** Every change already goes through `commit()` as one batch of `ChangeOp`s.
`SupabaseRepository.apply()` sends a batch to `apply_changes()`, which writes it in one
transaction, so a paint stroke or an undo is all or nothing. Batches go out one at a time and in
order (anything that queues up behind a slow request is sent together), so an undo can never
land before the change it undoes. If a write fails, the app shows what the server has and says
"Couldn't save".

**Realtime.** The repository subscribes to inserts, updates and deletes on the schedule's tables
and folds teammates' changes into the store. Each tab writes its own id to `updated_by`, so it
can ignore the echo of its own writes. After a dropped connection it reloads everything.

**Shape.** Tables mirror the app's collections (`employees`, `shift_templates`, `shifts`,
`patterns`, `tags`, `holidays`, `time_off`; settings live on the `schedules` row). Rows are keyed
by `(schedule_id, id)` with the app's own ids, so an exported file can be imported into any
schedule. Deleting a person cascades to their shifts and time off, and overlapping time off for
one person is rejected by the database, as in the app. `src/data/supabaseRows.ts` maps rows to
records.
