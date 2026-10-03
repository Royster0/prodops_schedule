# Supabase

The schedule is stored in Supabase and people sign in with Google or a magic link by email. Without the two env
variables below the app runs as before: no sign-in, data in this browser only.

## Setup

1. **Database.** Run the files in `supabase/migrations/` in order, in the dashboard's SQL Editor
   (or `supabase db push` with the CLI). They create the tables, row level security, the
   `join_schedule` and `apply_changes` functions, and turn on realtime for the schedule tables.
   Run them in order; every file after the first two is safe to run again.
2. **Auth URLs.** In Authentication > URL Configuration, set the Site URL to the production
   address and add every address the app runs on to Redirect URLs:
   - `http://localhost:5173/**` (the dev server)
   - `https://<your-app>.vercel.app/**` (production)
   - `https://*-<your-team>.vercel.app/**` (Vercel previews, if you use them)

   The magic link only returns to an address on this list.

3. **Email.** The Email provider is on by default. Supabase's built-in mailer only sends a few
   emails an hour, so set up custom SMTP (Authentication > Emails > SMTP Settings) before the
   team starts using it.
4. **Google sign-in.**
   - In [Google Cloud Console](https://console.cloud.google.com/), pick or create a project.
     Under APIs & Services > OAuth consent screen (Google Auth Platform > Branding), set the app
     name, support email and authorized domain `supabase.co` (plus your own domain if you use one),
     with the scopes `openid`, `email` and `profile`. While the app is in Testing, only the test
     users you list can sign in; publish it when the team is ready.
   - Under APIs & Services > Credentials (Google Auth Platform > Clients), create an OAuth client
     ID of type Web application. Authorized JavaScript origins: `http://localhost:5173` and your
     production address. Authorized redirect URI: exactly
     `https://<project-ref>.supabase.co/auth/v1/callback`. Copy the client ID and secret.
   - In Supabase, Authentication > Sign In / Providers > Google: turn it on and paste the client ID
     and secret. The secret stays in Supabase, never in the app.
   - The app's own addresses come from the Redirect URLs in step 2, as for magic links.

   Someone who uses Google and a magic link with the same email gets the same account, so invites
   work either way.

5. **Env variables**, locally in `.env.local` and in Vercel (Project Settings > Environment
   Variables, then redeploy):

   ```
   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```

   Only the publishable key belongs in the app. Never use a secret or `service_role` key here:
   everything with a `VITE_` prefix is shipped to the browser.

## How it works

**Signing in.** `src/auth/AuthGate.tsx` shows the sign-in screen until there is a session.
"Continue with Google" goes to Google through Supabase and comes back signed in, as does the link
in the email; supabase-js keeps the session in the browser
and refreshes it.

**Who sees what.** Every table belongs to a schedule. Each schedule has one **owner**
(`schedules.owner_id`, the person it was created for), and `schedule_members` lists everyone on
it as an `editor` (can change the schedule) or a `viewer` (can look). Row level security lets
members read and editors write; the anon role has no access at all. Only the owner invites
people, changes someone's access or removes them, and nobody can change the owner's own access,
so a schedule can't be left without one. Anyone else can leave. Viewers see "View only" in the
header, the painting tools and Add shift are hidden, and the app refuses their edits with a toast.

**People and their sign-ins.** The owner links a sign-in email to a person on the schedule
(Manage > People > Edit) and picks what that person can do, Can edit or Can view. That goes
through `assign_person()`: an email that has already signed in gets that access right away, and
any other email gets an invite carrying the person, emailed like any invite. Each person has at
most one sign-in. Unlinking someone, or linking the person to a different email, puts the old
account back to view only. Deleting a person keeps their account's access as it was.

**View only by default.** A schedule marked "Anyone who signs in can view this schedule"
(`schedules.open_to_signed_in`, owner only, in Settings > Sharing) makes everyone who signs in a
viewer of it until the owner links them to a person or changes their access. The first schedule
ever created starts open, and the migration opens the oldest existing one. Leaving an open
schedule isn't offered, since signing in again would bring the person back as a viewer.

**Joining and existing schedules.** On every load the app calls `join_schedule()`. It turns any
invites for the person's email into memberships, adds them as a viewer of every open schedule,
then, if they still belong to no schedule, creates one they own.

Inviting someone saves the invite and emails them a sign-in link (the Magic Link email template,
which you can reword under Authentication > Emails). Using that link, or signing in later with
Google or a link with the same email, claims the invite and opens that schedule. If the email
can't be sent (for example the built-in mailer's hourly limit), the owner can resend it or copy
the app's address and send it themselves.

- A schedule saved in the browser before sign-in moves into the new account the first time that
  happens (a copy stays under `schedule.v1.moved`). If the account already had a schedule, the
  local one is left alone and editors get a notice in Settings to review it and bring it in
  (replacing what's open, with undo) or set it aside.
- Someone on more than one schedule (for example they signed in, then were invited to a team's)
  can switch between them in Settings > Sharing. The choice is remembered on that device; by
  default the one they joined most recently opens.
- A schedule exported from another browser comes in with Settings > Import.

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
