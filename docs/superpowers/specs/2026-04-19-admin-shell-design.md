# Admin Shell — Design

**Date:** 2026-04-19
**Status:** Approved (design phase)
**Scope:** Auth + admin shell + user manager + analytics primitive for noahweis.dev

## Goal

Build the shared infrastructure that every future "dev app" on noahweis.dev will sit on top of:

1. A passwordless email-OTP login at `/admin`.
2. A dashboard of apps that filters by per-user permissions.
3. A user manager (admin-only) for granting/revoking access.
4. An event-logging primitive (`logEvent`) plus an analytics dashboard (admin-only) that future apps get for free.
5. Persistent sessions so returning users are auto-signed-in.

No public sign-up. The only path to access is the admin granting it via the user manager.

## Non-goals

- OAuth / social login (Google, GitHub, etc.).
- SMS OTP (cost + complexity).
- Magic links (we use 6-digit codes so the email and the browser don't need to be on the same device).
- Per-app custom analytics widgets — v1 ships a generic event browser; richer per-app charts are a follow-up once real apps exist.
- Multi-tenancy / organizations.

## Architecture

```
Browser (React SPA, static files on Dreamhost)
   |
   |-- supabase-js
   |     |
   |     |-- Auth (sign-in via Edge Function, session in localStorage)
   |     |-- Postgres (RLS-protected reads/writes)
   |     `-- Edge Function: request-otp (allowlist gate)
   |
   `-- Same-origin: only static assets. No backend on Dreamhost.
```

- **Hosting:** unchanged. The Vite build still produces static files deployed to Dreamhost via the existing `scripts/ssh.sh` flow.
- **Backend:** Supabase (managed). Free tier is sufficient.
- **Secrets needed at build time:** `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Both are safe to ship in the bundle (Supabase's design assumes the anon key is public; security comes from RLS + the Edge Function).

## Auth flow

1. User visits `/admin`. If a Supabase session exists in localStorage and refreshes successfully, redirect to `/admin/dashboard`. Otherwise show the login screen.
2. Login screen step 1: user enters their email, clicks **Send code**.
3. Browser calls the `request-otp` Edge Function with the email.
4. Edge Function looks up the email in `allowed_emails` where `enabled = true`. If absent, it returns `{ ok: true }` *without* sending an OTP (we do not leak whether an email is on the allowlist — strangers see the same UX as authorized users until the code-entry step).
5. If allowed, the Edge Function calls Supabase's admin auth API to send the OTP email.
6. Login screen step 2: user enters the 6-digit code. Browser calls `supabase.auth.verifyOtp({ email, token, type: 'email' })`.
7. On success, Supabase issues a session (access token ~1 hour, refresh token ~60 days, both in localStorage). Browser writes a `signed_in` event; a Postgres trigger on `events` updates `last_sign_in_at` on the user's `allowed_emails` row when an event with `event_name = 'signed_in'` is inserted (this keeps the write off the client, which has no permission to update `allowed_emails`). Browser then redirects to `/admin/dashboard`.
8. On wrong code, the user can re-enter or restart with a different email.

Session persistence is handled by `supabase-js`'s default localStorage adapter — no custom code required. Returning users with a valid refresh token are signed in transparently on page load.

## Authorization model

- **`is_admin = true`** → can access every app, including the user manager and analytics. There is exactly one admin (you). The admin row is seeded manually in Supabase.
- **`is_admin = false`** → can access only the apps listed in `user_app_permissions` for their email.
- A user with `enabled = false` cannot sign in (the `request-otp` Edge Function treats them as not-allowed) and existing sessions are invalidated on next refresh by an RLS check.

Enforcement happens in three layers:
1. **Edge Function** — blocks OTP delivery for non-allowlisted/disabled emails.
2. **Route guard component** — wraps every `/admin/*` route, redirects to `/admin` if no session, and to `/admin/dashboard` (with a "no access" toast) if the user lacks permission for the requested app.
3. **RLS policies** — Postgres rejects reads/writes that the user shouldn't be able to perform, so a hostile client can't bypass the guards.

## Data model (Supabase Postgres)

```sql
-- The allowlist. The PK is the email itself (lowercased on write).
create table allowed_emails (
  email           text primary key,
  label           text,
  is_admin        boolean not null default false,
  enabled         boolean not null default true,
  created_at      timestamptz not null default now(),
  last_sign_in_at timestamptz
);

-- Per-user app permissions. Admins bypass this table.
create table user_app_permissions (
  email     text references allowed_emails(email) on delete cascade,
  app_slug  text not null,
  primary key (email, app_slug)
);

-- Generic event log. Written by logEvent() from any app.
create table events (
  id          bigserial primary key,
  email       text references allowed_emails(email) on delete set null,
  app_slug    text,
  event_name  text not null,
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index events_created_at_idx  on events (created_at desc);
create index events_email_idx       on events (email);
create index events_app_slug_idx    on events (app_slug);
create index events_event_name_idx  on events (event_name);

-- Trigger: keep allowed_emails.last_sign_in_at in sync with sign-in events,
-- so the client never needs update permission on allowed_emails.
create or replace function bump_last_sign_in() returns trigger
language plpgsql security definer as $$
begin
  if new.event_name = 'signed_in' and new.email is not null then
    update allowed_emails
    set last_sign_in_at = new.created_at
    where email = new.email;
  end if;
  return new;
end;
$$;

create trigger events_bump_last_sign_in
  after insert on events
  for each row execute function bump_last_sign_in();
```

### RLS policies (summary)

- `allowed_emails`:
  - Any signed-in user may `select` their own row (so the client can check `is_admin`).
  - Only admins may `select` all rows, `insert`, `update`, or `delete`.
- `user_app_permissions`:
  - Any signed-in user may `select` rows where `email = auth.email()`.
  - Only admins may write.
- `events`:
  - Any signed-in user may `insert` a row where `email = auth.email()` (so `logEvent` works without elevated perms).
  - Only admins may `select`.

The Edge Function uses the service-role key (server-side, never shipped to the browser) to bypass RLS for the allowlist check and for triggering OTP send.

## React shell

```
src/
  routes/
    Home.tsx            (existing)
    Cal.tsx             (existing)
    admin/
      AdminRoot.tsx     (route layout: handles session bootstrap, renders <Outlet/>)
      Login.tsx         (email entry + code entry, two-step UI)
      Dashboard.tsx     (grid of app cards, filtered by permissions)
      apps/
        UserManager.tsx (admin-only: list, add, edit, remove, toggle enabled, set per-app perms)
        Analytics.tsx   (admin-only: filter + paginate the events table)
  apps/
    registry.ts         (typed list of apps; one entry per app)
    AppCard.tsx         (visual card used on the dashboard)
    RequireApp.tsx      (route guard for individual apps)
  lib/
    supabase.ts         (single supabase-js client)
    auth.ts             (useSession hook, signOut, currentUserRow helpers)
    logEvent.ts         (logEvent(name, payload, appSlug?) helper)
    permissions.ts      (canAccessApp(user, slug))
  styles/
    admin.module.css    (shell styling)
```

### App registry

```ts
// src/apps/registry.ts
import { UserManager } from "../routes/admin/apps/UserManager";
import { Analytics }   from "../routes/admin/apps/Analytics";

export type AppDef = {
  slug: string;
  name: string;
  description: string;
  adminOnly: boolean;
  component: React.ComponentType;
};

export const APPS: AppDef[] = [
  { slug: "users",     name: "User Manager",  description: "Grant or revoke access.",       adminOnly: true,  component: UserManager },
  { slug: "analytics", name: "Analytics",     description: "Sign-ins and app events.",      adminOnly: true,  component: Analytics   },
  // Future apps slot in here. Add an entry, add a route, done.
];
```

The dashboard renders one `<AppCard/>` per app the current user can access. Routes for `/admin/apps/<slug>` are generated from the registry.

### Routes

| Path                          | Component        | Guard                                     |
| ----------------------------- | ---------------- | ----------------------------------------- |
| `/admin`                      | `Login`          | redirects to `/admin/dashboard` if signed in |
| `/admin/dashboard`            | `Dashboard`      | requires session                          |
| `/admin/apps/:slug`           | resolved from registry | requires session + `canAccessApp`   |
| `/admin/*` (any other)        | redirect to `/admin/dashboard` | requires session                |

## User Manager (admin-only)

A single page with a table of all rows in `allowed_emails`. Columns:

- Email
- Label (editable inline)
- Admin? (read-only badge for safety; toggling admin is intentionally not exposed in the UI to prevent accidents — change in Supabase directly if ever needed)
- Enabled (toggle)
- Last sign-in (read-only timestamp)
- Apps (popover lists all non-admin-only apps with checkboxes; saves to `user_app_permissions`)
- Remove (button with confirm)

Plus an "Add user" form at the top: email + label + initial app permissions.

All writes go through `supabase-js`. RLS enforces that only admins can do this — a non-admin who somehow bypassed the route guard would see only their own row in the list and get 403s on any write attempt.

## Analytics (admin-only)

A single page that queries `events` with filters:

- Time range (last 24h / 7d / 30d / custom)
- App slug (multi-select from registry)
- Event name (free-text contains)
- User (email autocomplete from `allowed_emails`)

Renders:

1. **Top strip**: signed-in users in range, total events in range, distinct apps used in range.
2. **Daily activity sparkline**: events per day in the selected range.
3. **Event table**: paginated, newest first, columns = time, user, app, event, payload (expandable JSON).

This is intentionally a generic event browser — no per-app charts in v1.

## `logEvent` primitive

```ts
// src/lib/logEvent.ts
export async function logEvent(
  eventName: string,
  payload: Record<string, unknown> = {},
  appSlug?: string,
): Promise<void> {
  const session = await supabase.auth.getSession();
  if (!session.data.session) return; // no-op if not signed in
  await supabase.from("events").insert({
    email: session.data.session.user.email,
    app_slug: appSlug ?? null,
    event_name: eventName,
    payload,
  });
}
```

Built-in events the shell emits without app code:

- `signed_in` — written on successful OTP verify.
- `signed_out` — written on explicit sign-out.
- `app_opened` — written when a user navigates into `/admin/apps/<slug>`. The slug becomes `app_slug`.
- `allowlist_blocked` — written by the Edge Function when an unknown or disabled email requests an OTP. Logged with `email = null` (no row exists / the row is disabled), and the attempted email goes in `payload.attempted_email`.

Future apps call `logEvent("did_thing", { ...details }, "myapp")` and they automatically appear in analytics.

## Edge Function: `request-otp`

```ts
// supabase/functions/request-otp/index.ts (TypeScript on Deno)
//
// Input:  { email: string }
// Output: { ok: true }   (always — we never reveal allowlist membership)
//
// 1. Lowercase + validate email shape.
// 2. Look up in allowed_emails where enabled = true.
// 3. If not found, insert an `allowlist_blocked` row in events and return ok.
// 4. If found, call admin.signInWithOtp({ email, options: { shouldCreateUser: true } }).
// 5. Return ok.
```

Uses the service-role key (set as a Supabase secret, never reaches the browser).

## Error handling

- **OTP send failure (Supabase outage, etc.)** — login screen shows "Couldn't send code. Try again." and stays on the email step.
- **Wrong / expired code** — login screen shows "That code didn't work" and lets the user try again or restart.
- **Session refresh fails** — user is bounced to `/admin` with a "Please sign in again" toast.
- **RLS denial during normal use** — surfaces as a generic "Something went wrong" toast; a denial here means a bug in the guard layer, so it's worth noticing.
- **`logEvent` failure** — swallowed silently. Analytics is non-critical; we never want a logging failure to break a user action.

## Testing

Playwright is already wired up in this repo. Add scenarios:

1. Visiting `/admin` while signed-out shows the login screen.
2. Submitting an unknown email shows the code-entry step but no real email is sent (verify by mocking the Edge Function in test).
3. Submitting an allowlisted email + correct code lands on the dashboard.
4. A non-admin user sees only their permitted apps on the dashboard.
5. A non-admin user navigating directly to `/admin/apps/users` is redirected with a "no access" toast.
6. The admin can add a new email, see it in the list, and that email can then sign in.
7. Disabling a user prevents future OTP sends.
8. `logEvent` writes a row visible in the analytics table.
9. Returning to `/admin` with a valid session in localStorage skips the login screen.

For local development without burning real OTP emails, Supabase's CLI provides a local stack (`supabase start`) with Inbucket for catching emails.

## Deployment

1. Create the Supabase project (free tier). Save the URL + anon key.
2. Run the SQL migrations to create tables, indexes, and RLS policies.
3. Deploy the `request-otp` Edge Function and set the service-role key as its secret.
4. Manually insert one row into `allowed_emails` for the admin email with `is_admin = true`.
5. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to the build environment (local `.env.local` for dev, build-time env for production deploys).
6. `npm run build` produces static assets. Existing `scripts/ssh.sh` flow uploads to Dreamhost. No changes to the deploy pipeline.

## Open questions for the implementation plan

These don't change the design but the implementer will need to settle them:

- Exact UI styling of the admin shell — match existing site or adopt a new visual language for the admin area? (The existing site is the public landing page; the admin can look distinct.)
- Whether to use a component library (e.g., Radix primitives) or hand-roll. Current site is hand-rolled, so default is hand-rolled unless complexity warrants otherwise.
- Migration tooling: raw SQL files in `supabase/migrations/` (the Supabase CLI default) vs. a TypeScript migration tool. Default to the CLI's SQL files.
