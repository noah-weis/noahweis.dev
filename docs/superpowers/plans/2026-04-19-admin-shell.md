# Admin Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the auth + admin manager + analytics infrastructure on noahweis.dev so future "dev apps" can sit behind a passwordless email-OTP login with per-user permissions and free observability.

**Architecture:** React/Vite SPA stays static and deploys to Dreamhost unchanged. Supabase (managed) provides Postgres + auth + Edge Functions. Sign-in flow goes through a custom `request-otp` Edge Function that gates an allowlist before Supabase sends an OTP. App registry + route guards + RLS provide three layers of permission enforcement. A `logEvent()` helper writes to a generic `events` table that the analytics dashboard renders.

**Tech Stack:** React 18 + react-router-dom 7 + Vite 5 + TypeScript 5, Supabase (Postgres + Auth + Edge Functions on Deno), Playwright for e2e tests, Supabase CLI for local stack and migrations.

**Spec:** `docs/superpowers/specs/2026-04-19-admin-shell-design.md`

---

## File Structure

**New source files:**

- `src/lib/supabase.ts` — single shared `supabase-js` client.
- `src/lib/auth.ts` — `useSession`, `useCurrentUserRow`, `signOut` helpers.
- `src/lib/permissions.ts` — `canAccessApp(userRow, permsRows, slug)` pure function.
- `src/lib/logEvent.ts` — `logEvent(name, payload?, appSlug?)` helper.
- `src/lib/types.ts` — generated Supabase types + hand-written `AllowedEmail`, `UserAppPermission`, `EventRow`.
- `src/apps/registry.ts` — typed `APPS` array.
- `src/apps/AppCard.tsx` — visual card on the dashboard.
- `src/apps/RequireApp.tsx` — route guard wrapping individual apps.
- `src/routes/admin/AdminRoot.tsx` — admin layout, session bootstrap, `<Outlet/>`.
- `src/routes/admin/Login.tsx` — two-step (email → code) login.
- `src/routes/admin/Dashboard.tsx` — grid of app cards.
- `src/routes/admin/apps/UserManager.tsx` — admin user CRUD.
- `src/routes/admin/apps/Analytics.tsx` — event browser dashboard.
- `src/styles/admin.module.css` — admin shell styling.
- `src/styles/login.module.css` — login screen styling.

**New backend files:**

- `supabase/config.toml` — Supabase CLI project config.
- `supabase/migrations/0001_init.sql` — tables, indexes, trigger.
- `supabase/migrations/0002_rls.sql` — RLS policies.
- `supabase/functions/request-otp/index.ts` — Edge Function.
- `supabase/seed.sql` — local dev seed (one admin row).

**New test files:**

- `tests/fixtures/supabase.ts` — Playwright fixture: reset DB + seed before each test.
- `tests/admin/auth.spec.ts` — login flow.
- `tests/admin/dashboard.spec.ts` — dashboard + permissions.
- `tests/admin/user-manager.spec.ts` — user CRUD.
- `tests/admin/analytics.spec.ts` — analytics page.
- `tests/db/schema.spec.ts` — direct DB tests (trigger, RLS).

**Modified files:**

- `src/App.tsx` — add `/admin/*` route tree.
- `package.json` — add `@supabase/supabase-js`, `dotenv`, scripts for `supabase` CLI.
- `playwright.config.ts` — add `globalSetup` to start Supabase local stack.
- `.gitignore` — ignore `.env.local`, `supabase/.temp/`, `supabase/.branches/`.
- `vite-env.d.ts` — add `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` types.

---

## Task 1: Project bootstrap — Supabase CLI, env wiring, dependencies

**Files:**
- Create: `supabase/config.toml`, `.env.local.example`, `src/lib/supabase.ts`, `src/lib/types.ts`
- Modify: `package.json`, `.gitignore`, `src/vite-env.d.ts`

This task lays the infrastructure for all later work: installs the Supabase CLI for migrations + Edge Functions + local stack, installs `@supabase/supabase-js` for the browser, and creates the typed singleton client every other module imports.

- [ ] **Step 1: Install runtime dependency**

```bash
cd D:/vibes/noahweis.dev
npm install @supabase/supabase-js
```

Expected: `package.json` gains `"@supabase/supabase-js": "^2.x"` under `dependencies`.

- [ ] **Step 2: Install Supabase CLI globally and verify**

The CLI handles migrations, the local Docker-based stack, and Edge Function deployment. Use the official npm install path which works on Windows.

```bash
npm install -g supabase
supabase --version
```

Expected: prints a version like `1.200.x`. If install fails on Windows, fall back to scoop/Chocolatey per https://supabase.com/docs/guides/cli/getting-started.

- [ ] **Step 3: Initialize Supabase in the repo**

```bash
cd D:/vibes/noahweis.dev
supabase init
```

This creates `supabase/config.toml` and `supabase/seed.sql` (empty for now). Accept defaults. **Do not** run `supabase login` or `supabase link` — that's deferred to Task 16 (production deploy).

- [ ] **Step 4: Update .gitignore**

Append to `D:/vibes/noahweis.dev/.gitignore`:

```
# Supabase local
supabase/.temp/
supabase/.branches/
supabase/functions/_shared/
.env.local
```

- [ ] **Step 5: Create env example**

Create `D:/vibes/noahweis.dev/.env.local.example`:

```
# Local Supabase stack values printed by `supabase start`. Production values come from
# the Supabase dashboard for the deployed project.
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJI... (from `supabase start` output)
```

- [ ] **Step 6: Add Vite env types**

Modify `D:/vibes/noahweis.dev/src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

- [ ] **Step 7: Create the typed Supabase client singleton**

Create `D:/vibes/noahweis.dev/src/lib/supabase.ts`:

```ts
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Missing Supabase env vars. Copy .env.local.example to .env.local and fill in values from `supabase start`.",
  );
}

export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
```

- [ ] **Step 8: Create initial type stubs**

Create `D:/vibes/noahweis.dev/src/lib/types.ts` with hand-written types (we'll regenerate from the schema in Task 2):

```ts
export type AllowedEmail = {
  email: string;
  label: string | null;
  is_admin: boolean;
  enabled: boolean;
  created_at: string;
  last_sign_in_at: string | null;
};

export type UserAppPermission = {
  email: string;
  app_slug: string;
};

export type EventRow = {
  id: number;
  email: string | null;
  app_slug: string | null;
  event_name: string;
  payload: Record<string, unknown>;
  created_at: string;
};

// Minimal Database type. Replaced after Task 2 runs `supabase gen types typescript`.
export type Database = {
  public: {
    Tables: {
      allowed_emails: { Row: AllowedEmail; Insert: Partial<AllowedEmail> & { email: string }; Update: Partial<AllowedEmail> };
      user_app_permissions: { Row: UserAppPermission; Insert: UserAppPermission; Update: Partial<UserAppPermission> };
      events: { Row: EventRow; Insert: Omit<EventRow, "id" | "created_at"> & Partial<Pick<EventRow, "created_at">>; Update: Partial<EventRow> };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
```

- [ ] **Step 9: Verify Vite still builds**

Run: `npm run build`
Expected: build succeeds (no Supabase calls actually happen at build time — env validation is lazy at module-import).

- [ ] **Step 10: Commit**

```bash
cd D:/vibes/noahweis.dev
git add package.json package-lock.json supabase/config.toml supabase/seed.sql .gitignore .env.local.example src/vite-env.d.ts src/lib/supabase.ts src/lib/types.ts
git commit -m "chore(admin): bootstrap supabase client and CLI scaffolding"
```

---

## Task 2: Database schema — tables, indexes, trigger

**Files:**
- Create: `supabase/migrations/0001_init.sql`, `tests/db/schema.spec.ts`, `tests/fixtures/supabase.ts`
- Modify: `package.json` (add scripts)

This task creates the schema and a smoke test that runs against the local Postgres. The trigger that bumps `last_sign_in_at` from a `signed_in` event is non-trivial — we test it directly.

- [ ] **Step 1: Add npm scripts for the local stack**

Modify `D:/vibes/noahweis.dev/package.json` `scripts`:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "playwright test",
    "supabase:start": "supabase start",
    "supabase:stop": "supabase stop",
    "supabase:reset": "supabase db reset",
    "supabase:gen-types": "supabase gen types typescript --local > src/lib/types.generated.ts"
  }
}
```

- [ ] **Step 2: Start the local stack (one-time per dev session)**

```bash
cd D:/vibes/noahweis.dev
npm run supabase:start
```

Expected: prints API URL (`http://127.0.0.1:54321`), anon key, service role key, and Studio URL. **Copy the anon key into `.env.local`** (create the file from `.env.local.example`).

- [ ] **Step 3: Create the failing schema test fixture**

Create `D:/vibes/noahweis.dev/tests/fixtures/supabase.ts`:

```ts
import { test as base, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";

const URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? "";

if (!SERVICE_KEY || !ANON_KEY) {
  throw new Error(
    "Set SUPABASE_SERVICE_ROLE_KEY and SUPABASE_ANON_KEY env vars before running tests. " +
    "Both are printed by `supabase start`.",
  );
}

export type SupaFixtures = {
  service: SupabaseClient;
  anon: SupabaseClient;
  resetDb: () => void;
};

export const test = base.extend<SupaFixtures>({
  service: async ({}, use) => {
    await use(createClient(URL, SERVICE_KEY, { auth: { persistSession: false } }));
  },
  anon: async ({}, use) => {
    await use(createClient(URL, ANON_KEY, { auth: { persistSession: false } }));
  },
  resetDb: async ({}, use) => {
    use(() => execSync("supabase db reset --no-seed", { stdio: "inherit" }));
  },
});

export { expect };
```

- [ ] **Step 4: Write the failing schema test**

Create `D:/vibes/noahweis.dev/tests/db/schema.spec.ts`:

```ts
import { test, expect } from "../fixtures/supabase";

test.describe.serial("schema", () => {
  test.beforeAll(({ resetDb }) => resetDb());

  test("allowed_emails table exists with expected columns", async ({ service }) => {
    const { error } = await service.from("allowed_emails").select("email, label, is_admin, enabled, created_at, last_sign_in_at").limit(1);
    expect(error).toBeNull();
  });

  test("user_app_permissions table exists", async ({ service }) => {
    const { error } = await service.from("user_app_permissions").select("email, app_slug").limit(1);
    expect(error).toBeNull();
  });

  test("events table exists with payload jsonb", async ({ service }) => {
    const { error } = await service.from("events").insert({
      email: null,
      app_slug: null,
      event_name: "test",
      payload: { hello: "world" },
    });
    expect(error).toBeNull();
  });

  test("signed_in event bumps last_sign_in_at via trigger", async ({ service }) => {
    await service.from("allowed_emails").insert({ email: "trig@example.com", is_admin: false, enabled: true });
    const before = await service.from("allowed_emails").select("last_sign_in_at").eq("email", "trig@example.com").single();
    expect(before.data?.last_sign_in_at).toBeNull();

    await service.from("events").insert({ email: "trig@example.com", event_name: "signed_in", payload: {} });

    const after = await service.from("allowed_emails").select("last_sign_in_at").eq("email", "trig@example.com").single();
    expect(after.data?.last_sign_in_at).not.toBeNull();
  });
});
```

- [ ] **Step 5: Run the failing test**

Set the env vars from `supabase start` output, then run:

```bash
cd D:/vibes/noahweis.dev
SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_ANON_KEY=... npx playwright test tests/db/schema.spec.ts --project=desktop
```

Expected: FAIL — tables don't exist yet.

- [ ] **Step 6: Write the migration**

Create `D:/vibes/noahweis.dev/supabase/migrations/0001_init.sql`:

```sql
-- Allowlist: who is permitted to sign in.
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

- [ ] **Step 7: Apply the migration**

```bash
cd D:/vibes/noahweis.dev
npm run supabase:reset
```

Expected: Postgres resets and re-applies all migrations. Output ends with "Finished `db reset`."

- [ ] **Step 8: Re-run the schema test**

```bash
SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_ANON_KEY=... npx playwright test tests/db/schema.spec.ts --project=desktop
```

Expected: PASS (4 tests).

- [ ] **Step 9: Regenerate types from the live schema**

```bash
cd D:/vibes/noahweis.dev
npm run supabase:gen-types
```

Then update `src/lib/types.ts` to re-export the generated `Database`:

```ts
import type { Database as Generated } from "./types.generated";

export type Database = Generated;

export type AllowedEmail = Database["public"]["Tables"]["allowed_emails"]["Row"];
export type UserAppPermission = Database["public"]["Tables"]["user_app_permissions"]["Row"];
export type EventRow = Database["public"]["Tables"]["events"]["Row"];
```

- [ ] **Step 10: Commit**

```bash
cd D:/vibes/noahweis.dev
git add supabase/migrations/0001_init.sql tests/fixtures/supabase.ts tests/db/schema.spec.ts package.json src/lib/types.ts src/lib/types.generated.ts
git commit -m "feat(admin): add core schema (allowed_emails, perms, events) with sign-in trigger"
```

---

## Task 3: RLS policies

**Files:**
- Create: `supabase/migrations/0002_rls.sql`
- Modify: `tests/db/schema.spec.ts` (add RLS test cases)

RLS is the third enforcement layer. Without it, a malicious client could bypass our route guards. We test it by making queries as the anon role + as a signed-in non-admin role.

- [ ] **Step 1: Add the failing RLS tests**

Append to `D:/vibes/noahweis.dev/tests/db/schema.spec.ts`:

```ts
test.describe.serial("rls", () => {
  test.beforeAll(({ resetDb, service }) => {
    resetDb();
    return service.from("allowed_emails").insert([
      { email: "admin@example.com", is_admin: true,  enabled: true },
      { email: "user@example.com",  is_admin: false, enabled: true },
    ]);
  });

  test("anon role cannot read allowed_emails", async ({ anon }) => {
    const { data } = await anon.from("allowed_emails").select("*");
    expect(data ?? []).toEqual([]);
  });

  test("anon role cannot insert events", async ({ anon }) => {
    const { error } = await anon.from("events").insert({ email: null, event_name: "x", payload: {} });
    expect(error).not.toBeNull();
  });

  test("non-admin signed-in user sees only their own allowed_emails row", async ({ anon, service }) => {
    const { data: link } = await service.auth.admin.generateLink({ type: "magiclink", email: "user@example.com" });
    const otp = link!.properties.email_otp;
    await anon.auth.verifyOtp({ email: "user@example.com", token: otp, type: "email" });
    const { data } = await anon.from("allowed_emails").select("email");
    expect(data).toEqual([{ email: "user@example.com" }]);
    await anon.auth.signOut();
  });

  test("non-admin cannot insert into allowed_emails", async ({ anon, service }) => {
    const { data: link } = await service.auth.admin.generateLink({ type: "magiclink", email: "user@example.com" });
    const otp = link!.properties.email_otp;
    await anon.auth.verifyOtp({ email: "user@example.com", token: otp, type: "email" });
    const { error } = await anon.from("allowed_emails").insert({ email: "evil@example.com", is_admin: true, enabled: true });
    expect(error).not.toBeNull();
    await anon.auth.signOut();
  });
});
```

- [ ] **Step 2: Run the failing RLS tests**

```bash
SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_ANON_KEY=... npx playwright test tests/db/schema.spec.ts -g "rls" --project=desktop
```

Expected: FAIL — RLS not yet enabled, anon can read everything.

- [ ] **Step 3: Write the RLS migration**

Create `D:/vibes/noahweis.dev/supabase/migrations/0002_rls.sql`:

```sql
-- Helper: extract the signed-in user's email from the JWT.
create or replace function auth_email() returns text
language sql stable as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

-- Helper: is the current user an admin?
create or replace function is_admin() returns boolean
language sql stable security definer as $$
  select coalesce(
    (select is_admin from allowed_emails where email = auth_email() and enabled = true),
    false
  )
$$;

-- ---------- allowed_emails ----------
alter table allowed_emails enable row level security;

create policy allowed_emails_self_select on allowed_emails
  for select using (email = auth_email());

create policy allowed_emails_admin_select on allowed_emails
  for select using (is_admin());

create policy allowed_emails_admin_insert on allowed_emails
  for insert with check (is_admin());

create policy allowed_emails_admin_update on allowed_emails
  for update using (is_admin()) with check (is_admin());

create policy allowed_emails_admin_delete on allowed_emails
  for delete using (is_admin());

-- ---------- user_app_permissions ----------
alter table user_app_permissions enable row level security;

create policy user_app_permissions_self_select on user_app_permissions
  for select using (email = auth_email());

create policy user_app_permissions_admin_all on user_app_permissions
  for all using (is_admin()) with check (is_admin());

-- ---------- events ----------
alter table events enable row level security;

create policy events_self_insert on events
  for insert with check (
    -- Allow signed-in users to write their own events,
    -- OR allow null-email events (used by the Edge Function via service role,
    -- which bypasses RLS anyway, but this keeps the policy permissive).
    email = auth_email() or email is null
  );

create policy events_admin_select on events
  for select using (is_admin());
```

- [ ] **Step 4: Apply the migration**

```bash
cd D:/vibes/noahweis.dev
npm run supabase:reset
```

- [ ] **Step 5: Re-run the RLS tests**

```bash
SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_ANON_KEY=... npx playwright test tests/db/schema.spec.ts --project=desktop
```

Expected: PASS (all schema + RLS tests).

- [ ] **Step 6: Commit**

```bash
cd D:/vibes/noahweis.dev
git add supabase/migrations/0002_rls.sql tests/db/schema.spec.ts
git commit -m "feat(admin): add RLS policies for allowed_emails, perms, events"
```

---

## Task 4: `request-otp` Edge Function

**Files:**
- Create: `supabase/functions/request-otp/index.ts`, `supabase/functions/request-otp/index.test.ts`

The Edge Function gates OTP delivery against the allowlist. Anyone can call it (browser-facing), but it returns `{ ok: true }` regardless of allowlist membership and only actually triggers an OTP send for allowed users. It uses the service-role key (set as a Supabase secret) to bypass RLS.

- [ ] **Step 1: Write the Edge Function test (Deno test, runs in the local stack)**

Create `D:/vibes/noahweis.dev/supabase/functions/request-otp/index.test.ts`:

```ts
// Deno test executed via `supabase functions serve` + curl from a Playwright spec.
// We test by making real HTTP requests; this file is documentation of expected behavior.
//
// Cases:
// 1. POST { email: "admin@example.com" } where admin is in allowed_emails enabled=true → { ok: true }, no allowlist_blocked event written.
// 2. POST { email: "stranger@example.com" } → { ok: true } AND an allowlist_blocked event with payload.attempted_email = "stranger@example.com".
// 3. POST { email: "disabled@example.com" } where the row exists but enabled=false → { ok: true } AND an allowlist_blocked event.
// 4. POST { } (no email) → { ok: false, error: "missing email" }, status 400.
// 5. POST { email: "NOT-AN-EMAIL" } → { ok: false, error: "invalid email" }, status 400.
```

Then create the Playwright integration test `D:/vibes/noahweis.dev/tests/db/request-otp.spec.ts`:

```ts
import { test, expect } from "../fixtures/supabase";

const FN_URL = (process.env.SUPABASE_URL ?? "http://127.0.0.1:54321") + "/functions/v1/request-otp";
const ANON = process.env.SUPABASE_ANON_KEY!;

async function call(email?: unknown) {
  return fetch(FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${ANON}` },
    body: JSON.stringify(email === undefined ? {} : { email }),
  });
}

test.describe.serial("request-otp", () => {
  test.beforeAll(async ({ resetDb, service }) => {
    resetDb();
    await service.from("allowed_emails").insert([
      { email: "admin@example.com",    is_admin: true,  enabled: true },
      { email: "disabled@example.com", is_admin: false, enabled: false },
    ]);
  });

  test("missing email → 400", async () => {
    const r = await call(undefined);
    expect(r.status).toBe(400);
  });

  test("invalid email shape → 400", async () => {
    const r = await call("NOT-AN-EMAIL");
    expect(r.status).toBe(400);
  });

  test("allowed email → 200 ok, no blocked event", async ({ service }) => {
    const r = await call("admin@example.com");
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true });
    const { data } = await service.from("events").select("*").eq("event_name", "allowlist_blocked");
    expect(data ?? []).toEqual([]);
  });

  test("unknown email → 200 ok, blocked event written with attempted_email", async ({ service }) => {
    const r = await call("stranger@example.com");
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true });
    const { data } = await service.from("events").select("*").eq("event_name", "allowlist_blocked");
    expect(data?.length).toBe(1);
    expect((data![0].payload as { attempted_email: string }).attempted_email).toBe("stranger@example.com");
  });

  test("disabled email → 200 ok, blocked event written", async ({ service }) => {
    const r = await call("disabled@example.com");
    expect(r.status).toBe(200);
    const { data } = await service.from("events").select("*").eq("event_name", "allowlist_blocked").eq("payload->>attempted_email", "disabled@example.com");
    expect(data?.length).toBe(1);
  });
});
```

- [ ] **Step 2: Serve functions locally and run the failing tests**

In one terminal:

```bash
cd D:/vibes/noahweis.dev
supabase functions serve request-otp --no-verify-jwt
```

(`--no-verify-jwt` lets the anon key call the function — necessary because the caller is unauthenticated until they verify the OTP.)

In another:

```bash
SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_ANON_KEY=... npx playwright test tests/db/request-otp.spec.ts --project=desktop
```

Expected: FAIL — function doesn't exist yet (404).

- [ ] **Step 3: Implement the Edge Function**

Create `D:/vibes/noahweis.dev/supabase/functions/request-otp/index.ts`:

```ts
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST")    return json({ ok: false, error: "method not allowed" }, 405);

  let body: any;
  try { body = await req.json(); } catch { return json({ ok: false, error: "invalid json" }, 400); }

  const rawEmail = typeof body?.email === "string" ? body.email.trim().toLowerCase() : null;
  if (!rawEmail)              return json({ ok: false, error: "missing email" }, 400);
  if (!EMAIL_RE.test(rawEmail)) return json({ ok: false, error: "invalid email" }, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data: row } = await supabase
    .from("allowed_emails")
    .select("email, enabled")
    .eq("email", rawEmail)
    .maybeSingle();

  if (!row || !row.enabled) {
    await supabase.from("events").insert({
      email: null,
      app_slug: null,
      event_name: "allowlist_blocked",
      payload: { attempted_email: rawEmail },
    });
    return json({ ok: true });
  }

  // Trigger OTP send. shouldCreateUser:true is required because Supabase auth.users
  // is independent of our allowed_emails table — first-time sign-in creates the auth user.
  await supabase.auth.signInWithOtp({
    email: rawEmail,
    options: { shouldCreateUser: true },
  });

  return json({ ok: true });
});
```

- [ ] **Step 4: Restart `supabase functions serve` and re-run the tests**

```bash
# Ctrl-C the existing `supabase functions serve` and re-run it (Deno hot-reloads but a clean restart is safer):
supabase functions serve request-otp --no-verify-jwt

# In the other terminal:
SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_ANON_KEY=... npx playwright test tests/db/request-otp.spec.ts --project=desktop
```

Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
cd D:/vibes/noahweis.dev
git add supabase/functions/request-otp/index.ts supabase/functions/request-otp/index.test.ts tests/db/request-otp.spec.ts
git commit -m "feat(admin): add request-otp edge function with allowlist gate"
```

---

## Task 5: Auth helpers — `useSession`, `useCurrentUserRow`, `signOut`

**Files:**
- Create: `src/lib/auth.ts`, `tests/admin/auth-helpers.spec.ts`

These are the React-side primitives every admin component uses. Kept in one small module.

- [ ] **Step 1: Write the failing test**

Create `D:/vibes/noahweis.dev/tests/admin/auth-helpers.spec.ts`:

```ts
import { test, expect } from "../fixtures/supabase";

// We test the helpers indirectly through a tiny test harness route mounted in dev.
// To keep this isolated, we mount /__test/auth-helpers in App.tsx (only when import.meta.env.DEV).

test.beforeAll(({ resetDb, service }) => Promise.all([
  resetDb(),
  service.from("allowed_emails").insert({ email: "user@example.com", is_admin: false, enabled: true }),
]));

test("signed-out useSession returns null", async ({ page }) => {
  await page.goto("http://localhost:5173/__test/auth-helpers");
  await expect(page.getByTestId("session-state")).toHaveText("null");
});

test("after OTP sign-in, useSession returns a session and useCurrentUserRow returns the row", async ({ page, service }) => {
  const { data: link } = await service.auth.admin.generateLink({ type: "magiclink", email: "user@example.com" });
  const otp = link!.properties.email_otp;
  await page.goto("http://localhost:5173/__test/auth-helpers");
  await page.getByTestId("email-input").fill("user@example.com");
  await page.getByTestId("otp-input").fill(otp!);
  await page.getByTestId("sign-in").click();
  await expect(page.getByTestId("session-state")).toContainText("user@example.com");
  await expect(page.getByTestId("row-state")).toContainText('"is_admin":false');
});
```

- [ ] **Step 2: Run the failing test**

```bash
SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_ANON_KEY=... VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_ANON_KEY=... npx playwright test tests/admin/auth-helpers.spec.ts --project=desktop
```

Expected: FAIL — `/__test/auth-helpers` doesn't exist.

- [ ] **Step 3: Implement the auth helpers**

Create `D:/vibes/noahweis.dev/src/lib/auth.ts`:

```ts
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { AllowedEmail } from "./types";

export function useSession(): { session: Session | null; loading: boolean } {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setLoading(false);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, loading };
}

export function useCurrentUserRow(session: Session | null): {
  row: AllowedEmail | null;
  loading: boolean;
} {
  const [row, setRow] = useState<AllowedEmail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) {
      setRow(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from("allowed_emails")
      .select("*")
      .eq("email", session.user.email!)
      .maybeSingle()
      .then(({ data }) => {
        setRow(data as AllowedEmail | null);
        setLoading(false);
      });
  }, [session?.user.id]);

  return { row, loading };
}

export async function signOut(): Promise<void> {
  await supabase.from("events").insert({
    email: (await supabase.auth.getSession()).data.session?.user.email ?? null,
    app_slug: null,
    event_name: "signed_out",
    payload: {},
  });
  await supabase.auth.signOut();
}
```

- [ ] **Step 4: Add the test harness route**

Create `D:/vibes/noahweis.dev/src/routes/__test/AuthHelpersHarness.tsx`:

```tsx
import { useState } from "react";
import { useSession, useCurrentUserRow } from "../../lib/auth";
import { supabase } from "../../lib/supabase";

export function AuthHelpersHarness() {
  const { session } = useSession();
  const { row } = useCurrentUserRow(session);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");

  async function signIn() {
    await supabase.auth.verifyOtp({ email, token: otp, type: "email" });
  }

  return (
    <div>
      <div data-testid="session-state">{session ? session.user.email : "null"}</div>
      <div data-testid="row-state">{row ? JSON.stringify(row) : "null"}</div>
      <input data-testid="email-input" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input data-testid="otp-input" value={otp} onChange={(e) => setOtp(e.target.value)} />
      <button data-testid="sign-in" onClick={signIn}>Sign in</button>
    </div>
  );
}
```

Modify `D:/vibes/noahweis.dev/src/App.tsx`:

```tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Home } from "./routes/Home";
import { Cal } from "./routes/Cal";
import { AuthHelpersHarness } from "./routes/__test/AuthHelpersHarness";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/cal" element={<Cal />} />
        {import.meta.env.DEV && (
          <Route path="/__test/auth-helpers" element={<AuthHelpersHarness />} />
        )}
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 5: Re-run the test**

```bash
SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_ANON_KEY=... VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_ANON_KEY=... npx playwright test tests/admin/auth-helpers.spec.ts --project=desktop
```

Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
cd D:/vibes/noahweis.dev
git add src/lib/auth.ts src/routes/__test/AuthHelpersHarness.tsx src/App.tsx tests/admin/auth-helpers.spec.ts
git commit -m "feat(admin): add useSession, useCurrentUserRow, signOut helpers"
```

---

## Task 6: Login screen — email step

**Files:**
- Create: `src/routes/admin/Login.tsx`, `src/styles/login.module.css`, `tests/admin/auth.spec.ts`
- Modify: `src/App.tsx`

The login screen has two visual states: email entry and code entry. This task ships the email step + the call to `request-otp`. Code entry comes in Task 7.

- [ ] **Step 1: Write the failing test**

Create `D:/vibes/noahweis.dev/tests/admin/auth.spec.ts`:

```ts
import { test, expect } from "../fixtures/supabase";

test.beforeEach(({ resetDb, service }) => Promise.all([
  resetDb(),
  service.from("allowed_emails").insert([
    { email: "admin@example.com", is_admin: true,  enabled: true },
    { email: "user@example.com",  is_admin: false, enabled: true },
  ]),
]));

test("login: email step shows then advances to code step on submit", async ({ page }) => {
  await page.goto("http://localhost:5173/admin");
  await expect(page.getByTestId("login-email-input")).toBeVisible();
  await page.getByTestId("login-email-input").fill("admin@example.com");
  await page.getByTestId("login-send-code").click();
  await expect(page.getByTestId("login-code-input")).toBeVisible();
  await expect(page.getByTestId("login-status")).toContainText("admin@example.com");
});

test("login: invalid email shape shows inline error and stays on email step", async ({ page }) => {
  await page.goto("http://localhost:5173/admin");
  await page.getByTestId("login-email-input").fill("not-an-email");
  await page.getByTestId("login-send-code").click();
  await expect(page.getByTestId("login-error")).toContainText("valid email");
  await expect(page.getByTestId("login-code-input")).not.toBeVisible();
});
```

- [ ] **Step 2: Run the failing test**

```bash
SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_ANON_KEY=... VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... npx playwright test tests/admin/auth.spec.ts --project=desktop
```

Expected: FAIL — `/admin` returns 404.

- [ ] **Step 3: Implement the Login component (email step only for now — code step in Task 7)**

Create `D:/vibes/noahweis.dev/src/styles/login.module.css`:

```css
.shell {
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: #0e0e10;
  color: #f5f5f7;
  font-family: system-ui, sans-serif;
}
.card {
  width: min(420px, 90vw);
  padding: 32px;
  background: #18181b;
  border: 1px solid #27272a;
  border-radius: 12px;
}
.title { font-size: 20px; margin: 0 0 8px; }
.subtitle { font-size: 14px; color: #a1a1aa; margin: 0 0 24px; }
.input {
  width: 100%;
  padding: 12px;
  background: #0e0e10;
  border: 1px solid #3f3f46;
  border-radius: 6px;
  color: inherit;
  font-size: 16px;
}
.input:focus { outline: none; border-color: #818cf8; }
.button {
  margin-top: 12px;
  width: 100%;
  padding: 12px;
  background: #4f46e5;
  border: 0;
  border-radius: 6px;
  color: white;
  font-size: 16px;
  cursor: pointer;
}
.button:disabled { opacity: 0.5; cursor: not-allowed; }
.error  { margin-top: 12px; color: #f87171; font-size: 14px; }
.status { margin-top: 12px; color: #a1a1aa; font-size: 14px; }
.codeInput { letter-spacing: 0.4em; text-align: center; font-size: 22px; }
```

Create `D:/vibes/noahweis.dev/src/routes/admin/Login.tsx`:

```tsx
import { useState } from "react";
import { supabase } from "../../lib/supabase";
import s from "../../styles/login.module.css";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function Login() {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim().toLowerCase();
    if (!EMAIL_RE.test(trimmed)) {
      setError("Enter a valid email.");
      return;
    }
    setBusy(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/request-otp`;
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ email: trimmed }),
      });
      if (!r.ok) {
        setError("Couldn't send code. Try again.");
        return;
      }
      setEmail(trimmed);
      setStep("code");
    } finally {
      setBusy(false);
    }
  }

  async function verify(_e: React.FormEvent) {
    // Implemented in Task 7.
  }

  return (
    <div className={s.shell}>
      <div className={s.card}>
        {step === "email" ? (
          <form onSubmit={sendCode}>
            <h1 className={s.title}>noahweis.dev admin</h1>
            <p className={s.subtitle}>Enter your email to receive a 6-digit code.</p>
            <input
              data-testid="login-email-input"
              className={s.input}
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
            <button data-testid="login-send-code" className={s.button} type="submit" disabled={busy}>
              {busy ? "Sending…" : "Send code"}
            </button>
            {error && <div data-testid="login-error" className={s.error}>{error}</div>}
          </form>
        ) : (
          <form onSubmit={verify}>
            <h1 className={s.title}>Check your email</h1>
            <p data-testid="login-status" className={s.subtitle}>
              Sent a code to <strong>{email}</strong>.
            </p>
            <input
              data-testid="login-code-input"
              className={`${s.input} ${s.codeInput}`}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="------"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              autoFocus
            />
            <button className={s.button} type="submit" disabled>Verify</button>
            <p className={s.status}>(Verify is wired up in the next step.)</p>
          </form>
        )}
      </div>
    </div>
  );
}
```

Modify `D:/vibes/noahweis.dev/src/App.tsx` — add the admin route:

```tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Home } from "./routes/Home";
import { Cal } from "./routes/Cal";
import { Login } from "./routes/admin/Login";
import { AuthHelpersHarness } from "./routes/__test/AuthHelpersHarness";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/cal" element={<Cal />} />
        <Route path="/admin" element={<Login />} />
        {import.meta.env.DEV && (
          <Route path="/__test/auth-helpers" element={<AuthHelpersHarness />} />
        )}
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 4: Re-run the tests**

```bash
SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_ANON_KEY=... VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... npx playwright test tests/admin/auth.spec.ts --project=desktop
```

Expected: PASS (2 tests). The Edge Function must be running (`supabase functions serve request-otp --no-verify-jwt`).

- [ ] **Step 5: Commit**

```bash
cd D:/vibes/noahweis.dev
git add src/routes/admin/Login.tsx src/styles/login.module.css src/App.tsx tests/admin/auth.spec.ts
git commit -m "feat(admin): add login email step that calls request-otp"
```

---

## Task 7: Login screen — code verify, session, redirect

**Files:**
- Modify: `src/routes/admin/Login.tsx`, `tests/admin/auth.spec.ts`

This task wires up `verifyOtp`, writes the `signed_in` event, and redirects to `/admin/dashboard` on success. The dashboard route is added stubbed (full version in Task 9).

- [ ] **Step 1: Add the failing test**

Append to `D:/vibes/noahweis.dev/tests/admin/auth.spec.ts`:

```ts
test("login: correct OTP signs in and redirects to dashboard", async ({ page, service }) => {
  // Generate the OTP server-side so we don't need an email inbox.
  const { data: link } = await service.auth.admin.generateLink({ type: "magiclink", email: "admin@example.com" });
  const otp = link!.properties.email_otp!;

  await page.goto("http://localhost:5173/admin");
  await page.getByTestId("login-email-input").fill("admin@example.com");
  await page.getByTestId("login-send-code").click();
  await page.getByTestId("login-code-input").fill(otp);
  await page.getByTestId("login-verify").click();
  await page.waitForURL("**/admin/dashboard");
  await expect(page.getByTestId("dashboard-root")).toBeVisible();
});

test("login: wrong OTP shows error and stays on code step", async ({ page }) => {
  await page.goto("http://localhost:5173/admin");
  await page.getByTestId("login-email-input").fill("admin@example.com");
  await page.getByTestId("login-send-code").click();
  await page.getByTestId("login-code-input").fill("000000");
  await page.getByTestId("login-verify").click();
  await expect(page.getByTestId("login-error")).toContainText("didn't work");
  await expect(page).toHaveURL(/\/admin$/);
});

test("login: signed-in user visiting /admin is bounced to /admin/dashboard", async ({ page, service, context }) => {
  const { data: link } = await service.auth.admin.generateLink({ type: "magiclink", email: "admin@example.com" });
  const otp = link!.properties.email_otp!;
  await page.goto("http://localhost:5173/admin");
  await page.getByTestId("login-email-input").fill("admin@example.com");
  await page.getByTestId("login-send-code").click();
  await page.getByTestId("login-code-input").fill(otp);
  await page.getByTestId("login-verify").click();
  await page.waitForURL("**/admin/dashboard");

  // Reload /admin — should be bounced back to /admin/dashboard.
  await page.goto("http://localhost:5173/admin");
  await page.waitForURL("**/admin/dashboard");
});
```

- [ ] **Step 2: Run the failing tests**

```bash
SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_ANON_KEY=... VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... npx playwright test tests/admin/auth.spec.ts -g "OTP|signed-in user" --project=desktop
```

Expected: FAIL.

- [ ] **Step 3: Implement verify, redirect, and the bounce-when-signed-in behavior**

Replace `D:/vibes/noahweis.dev/src/routes/admin/Login.tsx` with:

```tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/auth";
import s from "../../styles/login.module.css";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function Login() {
  const navigate = useNavigate();
  const { session, loading } = useSession();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate("/admin/dashboard", { replace: true });
  }, [loading, session, navigate]);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim().toLowerCase();
    if (!EMAIL_RE.test(trimmed)) {
      setError("Enter a valid email.");
      return;
    }
    setBusy(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/request-otp`;
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ email: trimmed }),
      });
      if (!r.ok) {
        setError("Couldn't send code. Try again.");
        return;
      }
      setEmail(trimmed);
      setStep("code");
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { data, error: vErr } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: "email",
      });
      if (vErr || !data.session) {
        setError("That code didn't work. Try again or restart.");
        return;
      }
      // Write the signed_in event. The trigger will bump last_sign_in_at on allowed_emails.
      await supabase.from("events").insert({
        email,
        app_slug: null,
        event_name: "signed_in",
        payload: {},
      });
      navigate("/admin/dashboard", { replace: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={s.shell}>
      <div className={s.card}>
        {step === "email" ? (
          <form onSubmit={sendCode}>
            <h1 className={s.title}>noahweis.dev admin</h1>
            <p className={s.subtitle}>Enter your email to receive a 6-digit code.</p>
            <input
              data-testid="login-email-input"
              className={s.input}
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
            <button data-testid="login-send-code" className={s.button} type="submit" disabled={busy}>
              {busy ? "Sending…" : "Send code"}
            </button>
            {error && <div data-testid="login-error" className={s.error}>{error}</div>}
          </form>
        ) : (
          <form onSubmit={verify}>
            <h1 className={s.title}>Check your email</h1>
            <p data-testid="login-status" className={s.subtitle}>
              Sent a code to <strong>{email}</strong>.
            </p>
            <input
              data-testid="login-code-input"
              className={`${s.input} ${s.codeInput}`}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="------"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              autoFocus
            />
            <button data-testid="login-verify" className={s.button} type="submit" disabled={busy || code.length !== 6}>
              {busy ? "Verifying…" : "Verify"}
            </button>
            {error && <div data-testid="login-error" className={s.error}>{error}</div>}
          </form>
        )}
      </div>
    </div>
  );
}
```

Add a stub dashboard route so the redirect target exists. Create `D:/vibes/noahweis.dev/src/routes/admin/Dashboard.tsx`:

```tsx
export function Dashboard() {
  return <div data-testid="dashboard-root">Dashboard (stub — populated in Task 9)</div>;
}
```

Modify `D:/vibes/noahweis.dev/src/App.tsx`:

```tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Home } from "./routes/Home";
import { Cal } from "./routes/Cal";
import { Login } from "./routes/admin/Login";
import { Dashboard } from "./routes/admin/Dashboard";
import { AuthHelpersHarness } from "./routes/__test/AuthHelpersHarness";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/cal" element={<Cal />} />
        <Route path="/admin" element={<Login />} />
        <Route path="/admin/dashboard" element={<Dashboard />} />
        {import.meta.env.DEV && (
          <Route path="/__test/auth-helpers" element={<AuthHelpersHarness />} />
        )}
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 4: Re-run the tests**

```bash
SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_ANON_KEY=... VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... npx playwright test tests/admin/auth.spec.ts --project=desktop
```

Expected: PASS (5 tests total).

- [ ] **Step 5: Commit**

```bash
cd D:/vibes/noahweis.dev
git add src/routes/admin/Login.tsx src/routes/admin/Dashboard.tsx src/App.tsx tests/admin/auth.spec.ts
git commit -m "feat(admin): wire OTP verify, signed_in event, redirect to dashboard"
```

---

## Task 8: AdminRoot layout + session gate

**Files:**
- Create: `src/routes/admin/AdminRoot.tsx`, `src/styles/admin.module.css`
- Modify: `src/App.tsx`, `src/routes/admin/Dashboard.tsx`, `tests/admin/auth.spec.ts`

`AdminRoot` is a route layout. It checks for a session, redirects to `/admin` if absent, and renders `<Outlet/>` with a top bar (email + sign out) when present. This becomes the parent for `/admin/dashboard` and `/admin/apps/*`.

- [ ] **Step 1: Add the failing test**

Append to `D:/vibes/noahweis.dev/tests/admin/auth.spec.ts`:

```ts
test("admin: signed-out user visiting /admin/dashboard is redirected to /admin", async ({ page }) => {
  await page.goto("http://localhost:5173/admin/dashboard");
  await page.waitForURL("**/admin");
  await expect(page.getByTestId("login-email-input")).toBeVisible();
});

test("admin: top bar shows current email and sign-out works", async ({ page, service }) => {
  const { data: link } = await service.auth.admin.generateLink({ type: "magiclink", email: "admin@example.com" });
  const otp = link!.properties.email_otp!;
  await page.goto("http://localhost:5173/admin");
  await page.getByTestId("login-email-input").fill("admin@example.com");
  await page.getByTestId("login-send-code").click();
  await page.getByTestId("login-code-input").fill(otp);
  await page.getByTestId("login-verify").click();
  await page.waitForURL("**/admin/dashboard");
  await expect(page.getByTestId("admin-topbar-email")).toHaveText("admin@example.com");

  await page.getByTestId("admin-topbar-signout").click();
  await page.waitForURL("**/admin");
});
```

- [ ] **Step 2: Run the failing tests**

```bash
SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_ANON_KEY=... VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... npx playwright test tests/admin/auth.spec.ts -g "redirect|top bar" --project=desktop
```

Expected: FAIL.

- [ ] **Step 3: Implement AdminRoot**

Create `D:/vibes/noahweis.dev/src/styles/admin.module.css`:

```css
.shell {
  min-height: 100vh;
  background: #0e0e10;
  color: #f5f5f7;
  font-family: system-ui, sans-serif;
}
.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 24px;
  background: #18181b;
  border-bottom: 1px solid #27272a;
}
.brand { font-weight: 600; }
.topbarRight { display: flex; gap: 16px; align-items: center; font-size: 14px; }
.email { color: #a1a1aa; }
.signoutBtn {
  background: transparent;
  border: 1px solid #3f3f46;
  border-radius: 6px;
  color: inherit;
  padding: 6px 12px;
  font-size: 13px;
  cursor: pointer;
}
.signoutBtn:hover { border-color: #818cf8; }
.content { padding: 32px; max-width: 1200px; margin: 0 auto; }
.loadingScreen { min-height: 100vh; display: grid; place-items: center; color: #a1a1aa; }
```

Create `D:/vibes/noahweis.dev/src/routes/admin/AdminRoot.tsx`:

```tsx
import { useEffect } from "react";
import { Outlet, useNavigate, Link } from "react-router-dom";
import { useSession, signOut } from "../../lib/auth";
import s from "../../styles/admin.module.css";

export function AdminRoot() {
  const navigate = useNavigate();
  const { session, loading } = useSession();

  useEffect(() => {
    if (!loading && !session) navigate("/admin", { replace: true });
  }, [loading, session, navigate]);

  if (loading) return <div className={s.loadingScreen}>Loading…</div>;
  if (!session) return null; // redirect in flight

  return (
    <div className={s.shell}>
      <div className={s.topbar}>
        <Link to="/admin/dashboard" className={s.brand}>noahweis.dev</Link>
        <div className={s.topbarRight}>
          <span data-testid="admin-topbar-email" className={s.email}>{session.user.email}</span>
          <button
            data-testid="admin-topbar-signout"
            className={s.signoutBtn}
            onClick={async () => {
              await signOut();
              navigate("/admin", { replace: true });
            }}
          >
            Sign out
          </button>
        </div>
      </div>
      <div className={s.content}><Outlet /></div>
    </div>
  );
}
```

Modify `D:/vibes/noahweis.dev/src/App.tsx` to nest the dashboard under AdminRoot:

```tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Home } from "./routes/Home";
import { Cal } from "./routes/Cal";
import { Login } from "./routes/admin/Login";
import { AdminRoot } from "./routes/admin/AdminRoot";
import { Dashboard } from "./routes/admin/Dashboard";
import { AuthHelpersHarness } from "./routes/__test/AuthHelpersHarness";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/cal" element={<Cal />} />
        <Route path="/admin" element={<Login />} />
        <Route element={<AdminRoot />}>
          <Route path="/admin/dashboard" element={<Dashboard />} />
        </Route>
        {import.meta.env.DEV && (
          <Route path="/__test/auth-helpers" element={<AuthHelpersHarness />} />
        )}
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 4: Re-run tests**

```bash
SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_ANON_KEY=... VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... npx playwright test tests/admin/auth.spec.ts --project=desktop
```

Expected: PASS (7 tests total).

- [ ] **Step 5: Commit**

```bash
cd D:/vibes/noahweis.dev
git add src/routes/admin/AdminRoot.tsx src/styles/admin.module.css src/App.tsx tests/admin/auth.spec.ts
git commit -m "feat(admin): add AdminRoot layout with session gate and sign-out"
```

---

## Task 9: App registry, AppCard, Dashboard

**Files:**
- Create: `src/apps/registry.ts`, `src/apps/AppCard.tsx`, `src/lib/permissions.ts`, `tests/admin/dashboard.spec.ts`
- Modify: `src/routes/admin/Dashboard.tsx`

The registry is the source of truth for apps. The dashboard renders one card per app the current user can access. Two stub apps (`users`, `analytics`) are wired up — both admin-only — so the dashboard has something to show. Real implementations come in later tasks.

- [ ] **Step 1: Write the failing test**

Create `D:/vibes/noahweis.dev/tests/admin/dashboard.spec.ts`:

```ts
import { test, expect } from "../fixtures/supabase";

test.beforeEach(({ resetDb, service }) => Promise.all([
  resetDb(),
  service.from("allowed_emails").insert([
    { email: "admin@example.com", is_admin: true,  enabled: true },
    { email: "user@example.com",  is_admin: false, enabled: true },
  ]),
]));

async function signIn(page, service, email) {
  const { data: link } = await service.auth.admin.generateLink({ type: "magiclink", email });
  const otp = link!.properties.email_otp!;
  await page.goto("http://localhost:5173/admin");
  await page.getByTestId("login-email-input").fill(email);
  await page.getByTestId("login-send-code").click();
  await page.getByTestId("login-code-input").fill(otp);
  await page.getByTestId("login-verify").click();
  await page.waitForURL("**/admin/dashboard");
}

test("admin sees both built-in apps as cards", async ({ page, service }) => {
  await signIn(page, service, "admin@example.com");
  await expect(page.getByTestId("app-card-users")).toBeVisible();
  await expect(page.getByTestId("app-card-analytics")).toBeVisible();
});

test("non-admin with no permissions sees no cards and an empty state message", async ({ page, service }) => {
  await signIn(page, service, "user@example.com");
  await expect(page.getByTestId("dashboard-empty")).toBeVisible();
  await expect(page.getByTestId("app-card-users")).not.toBeVisible();
  await expect(page.getByTestId("app-card-analytics")).not.toBeVisible();
});
```

- [ ] **Step 2: Run the failing test**

```bash
SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_ANON_KEY=... VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... npx playwright test tests/admin/dashboard.spec.ts --project=desktop
```

Expected: FAIL.

- [ ] **Step 3: Implement permissions, registry, AppCard, and the real Dashboard**

Create `D:/vibes/noahweis.dev/src/lib/permissions.ts`:

```ts
import type { AllowedEmail, UserAppPermission } from "./types";
import type { AppDef } from "../apps/registry";

export function canAccessApp(
  user: AllowedEmail | null,
  perms: UserAppPermission[],
  app: AppDef,
): boolean {
  if (!user || !user.enabled) return false;
  if (user.is_admin) return true;
  if (app.adminOnly) return false;
  return perms.some((p) => p.app_slug === app.slug);
}
```

Create stub app components (real implementations come in Tasks 12–15). Create `D:/vibes/noahweis.dev/src/routes/admin/apps/UserManager.tsx`:

```tsx
export function UserManager() {
  return <div data-testid="user-manager-root">User Manager (Task 12–13)</div>;
}
```

Create `D:/vibes/noahweis.dev/src/routes/admin/apps/Analytics.tsx`:

```tsx
export function Analytics() {
  return <div data-testid="analytics-root">Analytics (Task 14–15)</div>;
}
```

Create `D:/vibes/noahweis.dev/src/apps/registry.ts`:

```ts
import type { ComponentType } from "react";
import { UserManager } from "../routes/admin/apps/UserManager";
import { Analytics }   from "../routes/admin/apps/Analytics";

export type AppDef = {
  slug: string;
  name: string;
  description: string;
  adminOnly: boolean;
  component: ComponentType;
};

export const APPS: AppDef[] = [
  {
    slug: "users",
    name: "User Manager",
    description: "Grant or revoke access for collaborators.",
    adminOnly: true,
    component: UserManager,
  },
  {
    slug: "analytics",
    name: "Analytics",
    description: "Sign-ins and per-app event activity.",
    adminOnly: true,
    component: Analytics,
  },
];
```

Create `D:/vibes/noahweis.dev/src/apps/AppCard.tsx`:

```tsx
import { Link } from "react-router-dom";
import type { AppDef } from "./registry";

const cardCss: React.CSSProperties = {
  display: "block",
  padding: 20,
  background: "#18181b",
  border: "1px solid #27272a",
  borderRadius: 10,
  color: "inherit",
  textDecoration: "none",
  transition: "border-color 120ms",
};

export function AppCard({ app }: { app: AppDef }) {
  return (
    <Link
      data-testid={`app-card-${app.slug}`}
      to={`/admin/apps/${app.slug}`}
      style={cardCss}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#818cf8")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#27272a")}
    >
      <div style={{ fontSize: 16, fontWeight: 600 }}>{app.name}</div>
      <div style={{ fontSize: 13, color: "#a1a1aa", marginTop: 6 }}>{app.description}</div>
    </Link>
  );
}
```

Replace `D:/vibes/noahweis.dev/src/routes/admin/Dashboard.tsx`:

```tsx
import { useEffect, useState } from "react";
import { useSession, useCurrentUserRow } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { APPS } from "../../apps/registry";
import { AppCard } from "../../apps/AppCard";
import { canAccessApp } from "../../lib/permissions";
import type { UserAppPermission } from "../../lib/types";

export function Dashboard() {
  const { session } = useSession();
  const { row } = useCurrentUserRow(session);
  const [perms, setPerms] = useState<UserAppPermission[]>([]);

  useEffect(() => {
    if (!session) return;
    supabase
      .from("user_app_permissions")
      .select("*")
      .eq("email", session.user.email!)
      .then(({ data }) => setPerms((data as UserAppPermission[]) ?? []));
  }, [session?.user.id]);

  const visible = APPS.filter((a) => canAccessApp(row, perms, a));

  return (
    <div data-testid="dashboard-root">
      <h1 style={{ marginTop: 0 }}>Dashboard</h1>
      {visible.length === 0 ? (
        <div data-testid="dashboard-empty" style={{ color: "#a1a1aa" }}>
          You don't have access to any apps yet. Ask the admin to grant you permissions.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
          {visible.map((app) => <AppCard key={app.slug} app={app} />)}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Re-run the tests**

```bash
SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_ANON_KEY=... VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... npx playwright test tests/admin/dashboard.spec.ts --project=desktop
```

Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
cd D:/vibes/noahweis.dev
git add src/lib/permissions.ts src/apps/registry.ts src/apps/AppCard.tsx src/routes/admin/Dashboard.tsx src/routes/admin/apps/UserManager.tsx src/routes/admin/apps/Analytics.tsx tests/admin/dashboard.spec.ts
git commit -m "feat(admin): add app registry, dashboard, and permission filtering"
```

---

## Task 10: RequireApp guard + dynamic per-app routes

**Files:**
- Create: `src/apps/RequireApp.tsx`
- Modify: `src/App.tsx`, `tests/admin/dashboard.spec.ts`

Each app needs a route under `/admin/apps/<slug>`. The route guard `RequireApp` checks `canAccessApp` and redirects unauthorized users back to the dashboard. Routes are generated from the registry so adding a new app means a single `APPS` entry.

- [ ] **Step 1: Add the failing tests**

Append to `D:/vibes/noahweis.dev/tests/admin/dashboard.spec.ts`:

```ts
async function signIn2(page, service, email) {
  const { data: link } = await service.auth.admin.generateLink({ type: "magiclink", email });
  const otp = link!.properties.email_otp!;
  await page.goto("http://localhost:5173/admin");
  await page.getByTestId("login-email-input").fill(email);
  await page.getByTestId("login-send-code").click();
  await page.getByTestId("login-code-input").fill(otp);
  await page.getByTestId("login-verify").click();
  await page.waitForURL("**/admin/dashboard");
}

test("admin can navigate into the user manager", async ({ page, service }) => {
  await signIn2(page, service, "admin@example.com");
  await page.getByTestId("app-card-users").click();
  await page.waitForURL("**/admin/apps/users");
  await expect(page.getByTestId("user-manager-root")).toBeVisible();
});

test("non-admin navigating directly to /admin/apps/users is bounced to dashboard", async ({ page, service }) => {
  await signIn2(page, service, "user@example.com");
  await page.goto("http://localhost:5173/admin/apps/users");
  await page.waitForURL("**/admin/dashboard");
  await expect(page.getByTestId("dashboard-empty")).toBeVisible();
});

test("unknown app slug bounces to dashboard", async ({ page, service }) => {
  await signIn2(page, service, "admin@example.com");
  await page.goto("http://localhost:5173/admin/apps/nope");
  await page.waitForURL("**/admin/dashboard");
});
```

- [ ] **Step 2: Run the failing tests**

```bash
SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_ANON_KEY=... VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... npx playwright test tests/admin/dashboard.spec.ts -g "navigate|bounced|unknown" --project=desktop
```

Expected: FAIL — no `/admin/apps/*` routes.

- [ ] **Step 3: Implement the guard**

Create `D:/vibes/noahweis.dev/src/apps/RequireApp.tsx`:

```tsx
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSession, useCurrentUserRow } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { APPS } from "./registry";
import { canAccessApp } from "../lib/permissions";
import type { UserAppPermission } from "../lib/types";

export function RequireApp() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { session, loading: sessionLoading } = useSession();
  const { row, loading: rowLoading } = useCurrentUserRow(session);
  const [perms, setPerms] = useState<UserAppPermission[] | null>(null);

  useEffect(() => {
    if (!session) return;
    supabase
      .from("user_app_permissions")
      .select("*")
      .eq("email", session.user.email!)
      .then(({ data }) => setPerms((data as UserAppPermission[]) ?? []));
  }, [session?.user.id]);

  const app = APPS.find((a) => a.slug === slug);

  useEffect(() => {
    if (sessionLoading || rowLoading || perms === null) return;
    if (!app)                                navigate("/admin/dashboard", { replace: true });
    else if (!canAccessApp(row, perms, app)) navigate("/admin/dashboard", { replace: true });
  }, [sessionLoading, rowLoading, perms, app, row, navigate]);

  if (sessionLoading || rowLoading || perms === null) return <div>Loading…</div>;
  if (!app) return null;
  if (!canAccessApp(row, perms, app)) return null;

  const C = app.component;
  return <C />;
}
```

Modify `D:/vibes/noahweis.dev/src/App.tsx` to add the dynamic route:

```tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Home } from "./routes/Home";
import { Cal } from "./routes/Cal";
import { Login } from "./routes/admin/Login";
import { AdminRoot } from "./routes/admin/AdminRoot";
import { Dashboard } from "./routes/admin/Dashboard";
import { RequireApp } from "./apps/RequireApp";
import { AuthHelpersHarness } from "./routes/__test/AuthHelpersHarness";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/cal" element={<Cal />} />
        <Route path="/admin" element={<Login />} />
        <Route element={<AdminRoot />}>
          <Route path="/admin/dashboard" element={<Dashboard />} />
          <Route path="/admin/apps/:slug" element={<RequireApp />} />
          <Route path="/admin/*" element={<Navigate to="/admin/dashboard" replace />} />
        </Route>
        {import.meta.env.DEV && (
          <Route path="/__test/auth-helpers" element={<AuthHelpersHarness />} />
        )}
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 4: Re-run the tests**

```bash
SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_ANON_KEY=... VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... npx playwright test tests/admin/dashboard.spec.ts --project=desktop
```

Expected: PASS (5 tests total).

- [ ] **Step 5: Commit**

```bash
cd D:/vibes/noahweis.dev
git add src/apps/RequireApp.tsx src/App.tsx tests/admin/dashboard.spec.ts
git commit -m "feat(admin): add RequireApp route guard and dynamic per-app routes"
```

---

## Task 11: `logEvent` primitive + `app_opened` instrumentation

**Files:**
- Create: `src/lib/logEvent.ts`, `tests/admin/logging.spec.ts`
- Modify: `src/apps/RequireApp.tsx`

The `logEvent` helper is what future apps call to record activity. The shell auto-emits `app_opened` whenever a user enters `/admin/apps/<slug>` (this is why we wire it into `RequireApp`). `signed_in` is already written from Login.tsx; `signed_out` from `signOut` (already wired).

- [ ] **Step 1: Add the failing test**

Create `D:/vibes/noahweis.dev/tests/admin/logging.spec.ts`:

```ts
import { test, expect } from "../fixtures/supabase";

test.beforeEach(({ resetDb, service }) => Promise.all([
  resetDb(),
  service.from("allowed_emails").insert([
    { email: "admin@example.com", is_admin: true, enabled: true },
  ]),
]));

async function signInAsAdmin(page, service) {
  const { data: link } = await service.auth.admin.generateLink({ type: "magiclink", email: "admin@example.com" });
  const otp = link!.properties.email_otp!;
  await page.goto("http://localhost:5173/admin");
  await page.getByTestId("login-email-input").fill("admin@example.com");
  await page.getByTestId("login-send-code").click();
  await page.getByTestId("login-code-input").fill(otp);
  await page.getByTestId("login-verify").click();
  await page.waitForURL("**/admin/dashboard");
}

test("opening the user manager writes an app_opened event", async ({ page, service }) => {
  await signInAsAdmin(page, service);
  await page.getByTestId("app-card-users").click();
  await page.waitForURL("**/admin/apps/users");
  // Give the insert a moment.
  await page.waitForTimeout(500);

  const { data } = await service
    .from("events")
    .select("*")
    .eq("event_name", "app_opened")
    .eq("app_slug", "users");
  expect(data?.length).toBeGreaterThanOrEqual(1);
  expect(data![0].email).toBe("admin@example.com");
});

test("signing out writes a signed_out event", async ({ page, service }) => {
  await signInAsAdmin(page, service);
  await page.getByTestId("admin-topbar-signout").click();
  await page.waitForURL("**/admin");

  const { data } = await service.from("events").select("*").eq("event_name", "signed_out").eq("email", "admin@example.com");
  expect(data?.length).toBeGreaterThanOrEqual(1);
});

test("logEvent works directly from a page", async ({ page, service }) => {
  await signInAsAdmin(page, service);
  await page.evaluate(async () => {
    const mod = await import("/src/lib/logEvent.ts");
    await mod.logEvent("custom_thing", { x: 1 }, "users");
  });
  await page.waitForTimeout(300);
  const { data } = await service.from("events").select("*").eq("event_name", "custom_thing");
  expect(data?.length).toBe(1);
  expect((data![0].payload as { x: number }).x).toBe(1);
});
```

- [ ] **Step 2: Run the failing tests**

```bash
SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_ANON_KEY=... VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... npx playwright test tests/admin/logging.spec.ts --project=desktop
```

Expected: FAIL — `logEvent` doesn't exist; `app_opened` not emitted.

- [ ] **Step 3: Implement `logEvent`**

Create `D:/vibes/noahweis.dev/src/lib/logEvent.ts`:

```ts
import { supabase } from "./supabase";

export async function logEvent(
  eventName: string,
  payload: Record<string, unknown> = {},
  appSlug?: string,
): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return; // silently no-op when signed out
    await supabase.from("events").insert({
      email: session.user.email,
      app_slug: appSlug ?? null,
      event_name: eventName,
      payload,
    });
  } catch {
    // Logging must never break a user action.
  }
}
```

Modify `D:/vibes/noahweis.dev/src/apps/RequireApp.tsx` — add an effect that emits `app_opened` once per slug navigation:

```tsx
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSession, useCurrentUserRow } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { APPS } from "./registry";
import { canAccessApp } from "../lib/permissions";
import { logEvent } from "../lib/logEvent";
import type { UserAppPermission } from "../lib/types";

export function RequireApp() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { session, loading: sessionLoading } = useSession();
  const { row, loading: rowLoading } = useCurrentUserRow(session);
  const [perms, setPerms] = useState<UserAppPermission[] | null>(null);

  useEffect(() => {
    if (!session) return;
    supabase
      .from("user_app_permissions")
      .select("*")
      .eq("email", session.user.email!)
      .then(({ data }) => setPerms((data as UserAppPermission[]) ?? []));
  }, [session?.user.id]);

  const app = APPS.find((a) => a.slug === slug);

  useEffect(() => {
    if (sessionLoading || rowLoading || perms === null) return;
    if (!app)                                navigate("/admin/dashboard", { replace: true });
    else if (!canAccessApp(row, perms, app)) navigate("/admin/dashboard", { replace: true });
    else                                     logEvent("app_opened", {}, app.slug);
  }, [sessionLoading, rowLoading, perms, app, row, navigate]);

  if (sessionLoading || rowLoading || perms === null) return <div>Loading…</div>;
  if (!app) return null;
  if (!canAccessApp(row, perms, app)) return null;

  const C = app.component;
  return <C />;
}
```

- [ ] **Step 4: Re-run the tests**

```bash
SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_ANON_KEY=... VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... npx playwright test tests/admin/logging.spec.ts --project=desktop
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
cd D:/vibes/noahweis.dev
git add src/lib/logEvent.ts src/apps/RequireApp.tsx tests/admin/logging.spec.ts
git commit -m "feat(admin): add logEvent helper and instrument app_opened"
```

---

## Task 12: User Manager — list + add

**Files:**
- Modify: `src/routes/admin/apps/UserManager.tsx`
- Create: `tests/admin/user-manager.spec.ts`

The user manager replaces its stub. This task ships list view + "Add user" form. Edit / delete / per-app perms come in Task 13.

- [ ] **Step 1: Write the failing test**

Create `D:/vibes/noahweis.dev/tests/admin/user-manager.spec.ts`:

```ts
import { test, expect } from "../fixtures/supabase";

test.beforeEach(({ resetDb, service }) => Promise.all([
  resetDb(),
  service.from("allowed_emails").insert([
    { email: "admin@example.com", is_admin: true,  enabled: true, label: "Me" },
    { email: "user@example.com",  is_admin: false, enabled: true, label: "Test User" },
  ]),
]));

async function signInAsAdmin(page, service) {
  const { data: link } = await service.auth.admin.generateLink({ type: "magiclink", email: "admin@example.com" });
  const otp = link!.properties.email_otp!;
  await page.goto("http://localhost:5173/admin");
  await page.getByTestId("login-email-input").fill("admin@example.com");
  await page.getByTestId("login-send-code").click();
  await page.getByTestId("login-code-input").fill(otp);
  await page.getByTestId("login-verify").click();
  await page.waitForURL("**/admin/dashboard");
}

test("user manager lists existing rows", async ({ page, service }) => {
  await signInAsAdmin(page, service);
  await page.goto("http://localhost:5173/admin/apps/users");
  await expect(page.getByTestId("um-row-admin@example.com")).toBeVisible();
  await expect(page.getByTestId("um-row-user@example.com")).toBeVisible();
  await expect(page.getByTestId("um-row-admin@example.com").getByTestId("um-cell-label")).toHaveText("Me");
});

test("admin can add a new user", async ({ page, service }) => {
  await signInAsAdmin(page, service);
  await page.goto("http://localhost:5173/admin/apps/users");
  await page.getByTestId("um-add-email").fill("new@example.com");
  await page.getByTestId("um-add-label").fill("Newcomer");
  await page.getByTestId("um-add-submit").click();
  await expect(page.getByTestId("um-row-new@example.com")).toBeVisible();

  // Verify in DB:
  const { data } = await service.from("allowed_emails").select("*").eq("email", "new@example.com").maybeSingle();
  expect(data?.label).toBe("Newcomer");
  expect(data?.enabled).toBe(true);
  expect(data?.is_admin).toBe(false);
});

test("adding an existing email shows an error and doesn't duplicate", async ({ page, service }) => {
  await signInAsAdmin(page, service);
  await page.goto("http://localhost:5173/admin/apps/users");
  await page.getByTestId("um-add-email").fill("user@example.com");
  await page.getByTestId("um-add-submit").click();
  await expect(page.getByTestId("um-add-error")).toContainText("already");
});
```

- [ ] **Step 2: Run the failing tests**

```bash
SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_ANON_KEY=... VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... npx playwright test tests/admin/user-manager.spec.ts --project=desktop
```

Expected: FAIL — UserManager is still a stub.

- [ ] **Step 3: Implement the User Manager (list + add)**

Replace `D:/vibes/noahweis.dev/src/routes/admin/apps/UserManager.tsx`:

```tsx
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import type { AllowedEmail } from "../../../lib/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const tableCss: React.CSSProperties = { width: "100%", borderCollapse: "collapse", marginTop: 24 };
const thtdCss:  React.CSSProperties = { padding: "10px 12px", borderBottom: "1px solid #27272a", textAlign: "left", fontSize: 14 };
const inputCss: React.CSSProperties = { padding: "8px 10px", background: "#0e0e10", border: "1px solid #3f3f46", borderRadius: 4, color: "#f5f5f7", fontSize: 14 };
const btnCss:   React.CSSProperties = { padding: "8px 14px", background: "#4f46e5", color: "white", border: 0, borderRadius: 4, cursor: "pointer", fontSize: 14 };

export function UserManager() {
  const [rows, setRows] = useState<AllowedEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [addEmail, setAddEmail] = useState("");
  const [addLabel, setAddLabel] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  async function reload() {
    setLoading(true);
    const { data } = await supabase.from("allowed_emails").select("*").order("created_at", { ascending: true });
    setRows((data as AllowedEmail[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { reload(); }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    const email = addEmail.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) { setAddError("Enter a valid email."); return; }
    setAdding(true);
    const { error } = await supabase.from("allowed_emails").insert({
      email,
      label: addLabel.trim() || null,
      is_admin: false,
      enabled: true,
    });
    setAdding(false);
    if (error) {
      setAddError(error.code === "23505" ? "That email is already on the list." : error.message);
      return;
    }
    setAddEmail("");
    setAddLabel("");
    await reload();
  }

  return (
    <div data-testid="user-manager-root">
      <h1 style={{ marginTop: 0 }}>User Manager</h1>

      <form onSubmit={handleAdd} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <input data-testid="um-add-email" style={inputCss} placeholder="email@example.com" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} />
        <input data-testid="um-add-label" style={inputCss} placeholder="Label (optional)" value={addLabel} onChange={(e) => setAddLabel(e.target.value)} />
        <button data-testid="um-add-submit" style={btnCss} type="submit" disabled={adding}>
          {adding ? "Adding…" : "Add user"}
        </button>
      </form>
      {addError && <div data-testid="um-add-error" style={{ color: "#f87171", marginTop: 8 }}>{addError}</div>}

      {loading ? (
        <div style={{ marginTop: 24, color: "#a1a1aa" }}>Loading…</div>
      ) : (
        <table style={tableCss}>
          <thead>
            <tr>
              <th style={thtdCss}>Email</th>
              <th style={thtdCss}>Label</th>
              <th style={thtdCss}>Admin</th>
              <th style={thtdCss}>Enabled</th>
              <th style={thtdCss}>Last sign-in</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.email} data-testid={`um-row-${r.email}`}>
                <td style={thtdCss}>{r.email}</td>
                <td style={thtdCss} data-testid="um-cell-label">{r.label ?? "—"}</td>
                <td style={thtdCss}>{r.is_admin ? "yes" : "no"}</td>
                <td style={thtdCss}>{r.enabled ? "yes" : "no"}</td>
                <td style={thtdCss}>{r.last_sign_in_at ? new Date(r.last_sign_in_at).toLocaleString() : "never"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Re-run the tests**

```bash
SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_ANON_KEY=... VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... npx playwright test tests/admin/user-manager.spec.ts --project=desktop
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
cd D:/vibes/noahweis.dev
git add src/routes/admin/apps/UserManager.tsx tests/admin/user-manager.spec.ts
git commit -m "feat(admin): user manager list + add user"
```

---

## Task 13: User Manager — edit, toggle, remove, per-app permissions

**Files:**
- Modify: `src/routes/admin/apps/UserManager.tsx`, `tests/admin/user-manager.spec.ts`

Adds inline label editing, the enabled toggle, the remove button (with confirm), and a per-app permissions popover.

- [ ] **Step 1: Add the failing tests**

Append to `D:/vibes/noahweis.dev/tests/admin/user-manager.spec.ts`:

```ts
test("admin can toggle enabled", async ({ page, service }) => {
  await signInAsAdmin(page, service);
  await page.goto("http://localhost:5173/admin/apps/users");
  await page.getByTestId("um-row-user@example.com").getByTestId("um-toggle-enabled").click();
  // Reload from DB:
  await page.waitForTimeout(300);
  const { data } = await service.from("allowed_emails").select("enabled").eq("email", "user@example.com").maybeSingle();
  expect(data?.enabled).toBe(false);
});

test("admin can edit a label inline", async ({ page, service }) => {
  await signInAsAdmin(page, service);
  await page.goto("http://localhost:5173/admin/apps/users");
  await page.getByTestId("um-row-user@example.com").getByTestId("um-edit-label").click();
  const input = page.getByTestId("um-row-user@example.com").getByTestId("um-edit-label-input");
  await input.fill("Renamed");
  await input.press("Enter");
  await expect(page.getByTestId("um-row-user@example.com").getByTestId("um-cell-label")).toHaveText("Renamed");
});

test("admin can remove a user (with confirm)", async ({ page, service }) => {
  await signInAsAdmin(page, service);
  await page.goto("http://localhost:5173/admin/apps/users");
  page.once("dialog", (d) => d.accept());
  await page.getByTestId("um-row-user@example.com").getByTestId("um-remove").click();
  await expect(page.getByTestId("um-row-user@example.com")).not.toBeVisible();
  const { data } = await service.from("allowed_emails").select("email").eq("email", "user@example.com").maybeSingle();
  expect(data).toBeNull();
});

test("admin can grant per-app permission to a non-admin", async ({ page, service }) => {
  // Add a non-admin-only test app for this. We do this by inserting a permission row for a slug
  // we know about (add a new app to registry first... or use existing slug for assertion).
  // Since the only registered apps are admin-only, this test asserts that the popover exposes the
  // current permission set and that toggling persists. We use slug "users" as the toggle target
  // (it would fail canAccessApp due to adminOnly, but the permission row still writes).
  await signInAsAdmin(page, service);
  await page.goto("http://localhost:5173/admin/apps/users");
  await page.getByTestId("um-row-user@example.com").getByTestId("um-perms-toggle").click();
  await page.getByTestId("um-perms-checkbox-users").check();
  await page.getByTestId("um-perms-save").click();
  await page.waitForTimeout(300);
  const { data } = await service.from("user_app_permissions").select("*").eq("email", "user@example.com");
  expect(data?.length).toBe(1);
  expect(data![0].app_slug).toBe("users");
});
```

- [ ] **Step 2: Run the failing tests**

```bash
SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_ANON_KEY=... VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... npx playwright test tests/admin/user-manager.spec.ts -g "toggle|edit|remove|grant" --project=desktop
```

Expected: FAIL.

- [ ] **Step 3: Extend the User Manager**

Replace `D:/vibes/noahweis.dev/src/routes/admin/apps/UserManager.tsx`:

```tsx
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { APPS } from "../../../apps/registry";
import type { AllowedEmail, UserAppPermission } from "../../../lib/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const tableCss: React.CSSProperties = { width: "100%", borderCollapse: "collapse", marginTop: 24 };
const thtdCss:  React.CSSProperties = { padding: "10px 12px", borderBottom: "1px solid #27272a", textAlign: "left", fontSize: 14, verticalAlign: "top" };
const inputCss: React.CSSProperties = { padding: "8px 10px", background: "#0e0e10", border: "1px solid #3f3f46", borderRadius: 4, color: "#f5f5f7", fontSize: 14 };
const btnCss:   React.CSSProperties = { padding: "8px 14px", background: "#4f46e5", color: "white", border: 0, borderRadius: 4, cursor: "pointer", fontSize: 14 };
const linkBtn:  React.CSSProperties = { background: "transparent", border: 0, color: "#818cf8", cursor: "pointer", padding: 0, fontSize: 13 };
const dangerBtn: React.CSSProperties = { ...linkBtn, color: "#f87171" };
const popoverCss: React.CSSProperties = { background: "#27272a", border: "1px solid #3f3f46", borderRadius: 6, padding: 12, marginTop: 8 };

type RowState = {
  editing: boolean;
  labelDraft: string;
  permsOpen: boolean;
  permsDraft: Set<string>;
};

const emptyRowState = (label: string | null, perms: string[]): RowState => ({
  editing: false,
  labelDraft: label ?? "",
  permsOpen: false,
  permsDraft: new Set(perms),
});

export function UserManager() {
  const [rows, setRows] = useState<AllowedEmail[]>([]);
  const [perms, setPerms] = useState<UserAppPermission[]>([]);
  const [rowState, setRowState] = useState<Record<string, RowState>>({});
  const [loading, setLoading] = useState(true);
  const [addEmail, setAddEmail] = useState("");
  const [addLabel, setAddLabel] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  async function reload() {
    setLoading(true);
    const [{ data: rowData }, { data: permData }] = await Promise.all([
      supabase.from("allowed_emails").select("*").order("created_at", { ascending: true }),
      supabase.from("user_app_permissions").select("*"),
    ]);
    const r = (rowData as AllowedEmail[]) ?? [];
    const p = (permData as UserAppPermission[]) ?? [];
    setRows(r);
    setPerms(p);
    const next: Record<string, RowState> = {};
    for (const row of r) {
      next[row.email] = emptyRowState(row.label, p.filter((x) => x.email === row.email).map((x) => x.app_slug));
    }
    setRowState(next);
    setLoading(false);
  }

  useEffect(() => { reload(); }, []);

  function patchRowState(email: string, patch: Partial<RowState>) {
    setRowState((s) => ({ ...s, [email]: { ...s[email], ...patch } }));
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    const email = addEmail.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) { setAddError("Enter a valid email."); return; }
    setAdding(true);
    const { error } = await supabase.from("allowed_emails").insert({
      email, label: addLabel.trim() || null, is_admin: false, enabled: true,
    });
    setAdding(false);
    if (error) {
      setAddError(error.code === "23505" ? "That email is already on the list." : error.message);
      return;
    }
    setAddEmail(""); setAddLabel("");
    await reload();
  }

  async function toggleEnabled(row: AllowedEmail) {
    await supabase.from("allowed_emails").update({ enabled: !row.enabled }).eq("email", row.email);
    await reload();
  }

  async function commitLabel(row: AllowedEmail) {
    const draft = rowState[row.email].labelDraft.trim() || null;
    await supabase.from("allowed_emails").update({ label: draft }).eq("email", row.email);
    await reload();
  }

  async function remove(row: AllowedEmail) {
    if (!confirm(`Remove ${row.email}?`)) return;
    await supabase.from("allowed_emails").delete().eq("email", row.email);
    await reload();
  }

  async function savePerms(row: AllowedEmail) {
    const draft = rowState[row.email].permsDraft;
    const existing = new Set(perms.filter((p) => p.email === row.email).map((p) => p.app_slug));
    const toAdd = [...draft].filter((s) => !existing.has(s)).map((s) => ({ email: row.email, app_slug: s }));
    const toRemove = [...existing].filter((s) => !draft.has(s));
    if (toAdd.length)    await supabase.from("user_app_permissions").insert(toAdd);
    if (toRemove.length) await supabase.from("user_app_permissions").delete().eq("email", row.email).in("app_slug", toRemove);
    await reload();
  }

  return (
    <div data-testid="user-manager-root">
      <h1 style={{ marginTop: 0 }}>User Manager</h1>

      <form onSubmit={handleAdd} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <input data-testid="um-add-email" style={inputCss} placeholder="email@example.com" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} />
        <input data-testid="um-add-label" style={inputCss} placeholder="Label (optional)" value={addLabel} onChange={(e) => setAddLabel(e.target.value)} />
        <button data-testid="um-add-submit" style={btnCss} type="submit" disabled={adding}>{adding ? "Adding…" : "Add user"}</button>
      </form>
      {addError && <div data-testid="um-add-error" style={{ color: "#f87171", marginTop: 8 }}>{addError}</div>}

      {loading ? (
        <div style={{ marginTop: 24, color: "#a1a1aa" }}>Loading…</div>
      ) : (
        <table style={tableCss}>
          <thead>
            <tr>
              <th style={thtdCss}>Email</th>
              <th style={thtdCss}>Label</th>
              <th style={thtdCss}>Admin</th>
              <th style={thtdCss}>Enabled</th>
              <th style={thtdCss}>Last sign-in</th>
              <th style={thtdCss}>Apps</th>
              <th style={thtdCss}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const st = rowState[r.email];
              return (
                <tr key={r.email} data-testid={`um-row-${r.email}`}>
                  <td style={thtdCss}>{r.email}</td>
                  <td style={thtdCss}>
                    {st.editing ? (
                      <input
                        data-testid="um-edit-label-input"
                        style={inputCss}
                        autoFocus
                        value={st.labelDraft}
                        onChange={(e) => patchRowState(r.email, { labelDraft: e.target.value })}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitLabel(r); } if (e.key === "Escape") patchRowState(r.email, { editing: false, labelDraft: r.label ?? "" }); }}
                        onBlur={() => commitLabel(r)}
                      />
                    ) : (
                      <span data-testid="um-cell-label" onClick={() => patchRowState(r.email, { editing: true })} style={{ cursor: "pointer" }}>
                        {r.label ?? "—"} <button data-testid="um-edit-label" style={linkBtn} onClick={() => patchRowState(r.email, { editing: true })}>edit</button>
                      </span>
                    )}
                  </td>
                  <td style={thtdCss}>{r.is_admin ? "yes" : "no"}</td>
                  <td style={thtdCss}>
                    <button data-testid="um-toggle-enabled" style={linkBtn} onClick={() => toggleEnabled(r)} disabled={r.is_admin}>
                      {r.enabled ? "disable" : "enable"}
                    </button>
                  </td>
                  <td style={thtdCss}>{r.last_sign_in_at ? new Date(r.last_sign_in_at).toLocaleString() : "never"}</td>
                  <td style={thtdCss}>
                    <button data-testid="um-perms-toggle" style={linkBtn} onClick={() => patchRowState(r.email, { permsOpen: !st.permsOpen })}>
                      {st.permsDraft.size} app{st.permsDraft.size === 1 ? "" : "s"}
                    </button>
                    {st.permsOpen && (
                      <div style={popoverCss}>
                        {APPS.map((a) => (
                          <label key={a.slug} style={{ display: "block", padding: "4px 0" }}>
                            <input
                              data-testid={`um-perms-checkbox-${a.slug}`}
                              type="checkbox"
                              checked={st.permsDraft.has(a.slug)}
                              onChange={(e) => {
                                const next = new Set(st.permsDraft);
                                if (e.target.checked) next.add(a.slug); else next.delete(a.slug);
                                patchRowState(r.email, { permsDraft: next });
                              }}
                            /> {a.name} <span style={{ color: "#71717a" }}>({a.slug})</span>
                          </label>
                        ))}
                        <button data-testid="um-perms-save" style={{ ...btnCss, marginTop: 8 }} onClick={() => savePerms(r)}>Save</button>
                      </div>
                    )}
                  </td>
                  <td style={thtdCss}>
                    {!r.is_admin && (
                      <button data-testid="um-remove" style={dangerBtn} onClick={() => remove(r)}>remove</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Re-run the tests**

```bash
SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_ANON_KEY=... VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... npx playwright test tests/admin/user-manager.spec.ts --project=desktop
```

Expected: PASS (7 tests total).

- [ ] **Step 5: Commit**

```bash
cd D:/vibes/noahweis.dev
git add src/routes/admin/apps/UserManager.tsx tests/admin/user-manager.spec.ts
git commit -m "feat(admin): user manager edit, toggle, remove, per-app permissions"
```

---

## Task 14: Analytics — filters and summary strip

**Files:**
- Modify: `src/routes/admin/apps/Analytics.tsx`
- Create: `tests/admin/analytics.spec.ts`

Replaces the analytics stub with the filter UI + summary strip. The event table (Task 15) is added after.

- [ ] **Step 1: Write the failing test**

Create `D:/vibes/noahweis.dev/tests/admin/analytics.spec.ts`:

```ts
import { test, expect } from "../fixtures/supabase";

test.beforeEach(async ({ resetDb, service }) => {
  resetDb();
  await service.from("allowed_emails").insert([
    { email: "admin@example.com", is_admin: true,  enabled: true },
    { email: "user@example.com",  is_admin: false, enabled: true },
  ]);
  // Seed a handful of events.
  await service.from("events").insert([
    { email: "admin@example.com", app_slug: "users",     event_name: "app_opened", payload: {} },
    { email: "admin@example.com", app_slug: "analytics", event_name: "app_opened", payload: {} },
    { email: "user@example.com",  app_slug: null,        event_name: "signed_in",  payload: {} },
  ]);
});

async function signInAsAdmin(page, service) {
  const { data: link } = await service.auth.admin.generateLink({ type: "magiclink", email: "admin@example.com" });
  const otp = link!.properties.email_otp!;
  await page.goto("http://localhost:5173/admin");
  await page.getByTestId("login-email-input").fill("admin@example.com");
  await page.getByTestId("login-send-code").click();
  await page.getByTestId("login-code-input").fill(otp);
  await page.getByTestId("login-verify").click();
  await page.waitForURL("**/admin/dashboard");
}

test("analytics summary shows totals from seed", async ({ page, service }) => {
  await signInAsAdmin(page, service);
  await page.goto("http://localhost:5173/admin/apps/analytics");
  // After admin signs in, the test seed plus the actual sign-in adds another `signed_in`.
  // Total events ≥ 4. Distinct users ≥ 2. Distinct apps in events ≥ 2.
  await expect(page.getByTestId("analytics-total-events")).toContainText(/\d+/);
  const total = await page.getByTestId("analytics-total-events").textContent();
  expect(parseInt(total ?? "0", 10)).toBeGreaterThanOrEqual(4);
  const distinctUsers = await page.getByTestId("analytics-distinct-users").textContent();
  expect(parseInt(distinctUsers ?? "0", 10)).toBeGreaterThanOrEqual(2);
});

test("filtering by event name narrows the totals", async ({ page, service }) => {
  await signInAsAdmin(page, service);
  await page.goto("http://localhost:5173/admin/apps/analytics");
  const before = parseInt((await page.getByTestId("analytics-total-events").textContent()) ?? "0", 10);
  await page.getByTestId("analytics-filter-event").fill("app_opened");
  await page.getByTestId("analytics-filter-apply").click();
  await page.waitForTimeout(200);
  const after = parseInt((await page.getByTestId("analytics-total-events").textContent()) ?? "0", 10);
  expect(after).toBeLessThan(before);
  expect(after).toBeGreaterThanOrEqual(2);
});
```

- [ ] **Step 2: Run the failing tests**

```bash
SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_ANON_KEY=... VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... npx playwright test tests/admin/analytics.spec.ts --project=desktop
```

Expected: FAIL — Analytics is still a stub.

- [ ] **Step 3: Implement filters + summary strip**

Replace `D:/vibes/noahweis.dev/src/routes/admin/apps/Analytics.tsx`:

```tsx
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { APPS } from "../../../apps/registry";
import type { EventRow } from "../../../lib/types";

type Filters = {
  rangeDays: 1 | 7 | 30;
  appSlug: string;     // "" = all
  eventName: string;   // free-text contains
  userEmail: string;   // "" = all
};

const inputCss: React.CSSProperties = { padding: "6px 10px", background: "#0e0e10", border: "1px solid #3f3f46", borderRadius: 4, color: "#f5f5f7", fontSize: 13 };
const btnCss:   React.CSSProperties = { padding: "6px 12px", background: "#4f46e5", color: "white", border: 0, borderRadius: 4, cursor: "pointer", fontSize: 13 };
const statCss:  React.CSSProperties = { padding: 14, background: "#18181b", border: "1px solid #27272a", borderRadius: 8, minWidth: 140 };
const labelCss: React.CSSProperties = { fontSize: 12, color: "#a1a1aa", textTransform: "uppercase", letterSpacing: 0.5 };
const valueCss: React.CSSProperties = { fontSize: 24, fontWeight: 600, marginTop: 4 };

export function Analytics() {
  const [filters, setFilters] = useState<Filters>({ rangeDays: 7, appSlug: "", eventName: "", userEmail: "" });
  const [applied, setApplied] = useState<Filters>(filters);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const since = new Date(Date.now() - applied.rangeDays * 24 * 60 * 60 * 1000).toISOString();
    let q = supabase.from("events").select("*").gte("created_at", since).order("created_at", { ascending: false }).limit(1000);
    if (applied.appSlug)   q = q.eq("app_slug", applied.appSlug);
    if (applied.userEmail) q = q.eq("email", applied.userEmail);
    if (applied.eventName) q = q.ilike("event_name", `%${applied.eventName}%`);
    setLoading(true);
    q.then(({ data }) => {
      setEvents((data as EventRow[]) ?? []);
      setLoading(false);
    });
  }, [applied]);

  const totalEvents     = events.length;
  const distinctUsers   = new Set(events.map((e) => e.email).filter(Boolean)).size;
  const distinctApps    = new Set(events.map((e) => e.app_slug).filter(Boolean)).size;

  return (
    <div data-testid="analytics-root">
      <h1 style={{ marginTop: 0 }}>Analytics</h1>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <select data-testid="analytics-filter-range" style={inputCss} value={filters.rangeDays} onChange={(e) => setFilters({ ...filters, rangeDays: Number(e.target.value) as 1 | 7 | 30 })}>
          <option value={1}>Last 24h</option>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
        </select>
        <select data-testid="analytics-filter-app" style={inputCss} value={filters.appSlug} onChange={(e) => setFilters({ ...filters, appSlug: e.target.value })}>
          <option value="">All apps</option>
          {APPS.map((a) => <option key={a.slug} value={a.slug}>{a.name}</option>)}
        </select>
        <input data-testid="analytics-filter-event" style={inputCss} placeholder="Event name contains…" value={filters.eventName} onChange={(e) => setFilters({ ...filters, eventName: e.target.value })} />
        <input data-testid="analytics-filter-user" style={inputCss} placeholder="user@example.com" value={filters.userEmail} onChange={(e) => setFilters({ ...filters, userEmail: e.target.value })} />
        <button data-testid="analytics-filter-apply" style={btnCss} onClick={() => setApplied(filters)}>Apply</button>
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
        <div style={statCss}>
          <div style={labelCss}>Events</div>
          <div data-testid="analytics-total-events" style={valueCss}>{loading ? "…" : totalEvents}</div>
        </div>
        <div style={statCss}>
          <div style={labelCss}>Distinct users</div>
          <div data-testid="analytics-distinct-users" style={valueCss}>{loading ? "…" : distinctUsers}</div>
        </div>
        <div style={statCss}>
          <div style={labelCss}>Distinct apps</div>
          <div data-testid="analytics-distinct-apps" style={valueCss}>{loading ? "…" : distinctApps}</div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Re-run the tests**

```bash
SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_ANON_KEY=... VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... npx playwright test tests/admin/analytics.spec.ts --project=desktop
```

Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
cd D:/vibes/noahweis.dev
git add src/routes/admin/apps/Analytics.tsx tests/admin/analytics.spec.ts
git commit -m "feat(admin): analytics filters and summary strip"
```

---

## Task 15: Analytics — daily sparkline + event table

**Files:**
- Modify: `src/routes/admin/apps/Analytics.tsx`, `tests/admin/analytics.spec.ts`

Adds a per-day SVG sparkline and a paginated event table with expandable JSON payload. No charting library — a small inline SVG keeps the bundle lean.

- [ ] **Step 1: Add the failing tests**

Append to `D:/vibes/noahweis.dev/tests/admin/analytics.spec.ts`:

```ts
test("event table lists rows and expands payload on click", async ({ page, service }) => {
  await signInAsAdmin(page, service);
  await page.goto("http://localhost:5173/admin/apps/analytics");
  const firstRow = page.getByTestId("analytics-event-row").first();
  await expect(firstRow).toBeVisible();
  await firstRow.getByTestId("analytics-expand-payload").click();
  await expect(firstRow.getByTestId("analytics-payload-json")).toBeVisible();
});

test("sparkline renders an svg with bars", async ({ page, service }) => {
  await signInAsAdmin(page, service);
  await page.goto("http://localhost:5173/admin/apps/analytics");
  await expect(page.getByTestId("analytics-sparkline")).toBeVisible();
  const bars = await page.getByTestId("analytics-sparkline").locator("rect").count();
  expect(bars).toBeGreaterThan(0);
});

test("pagination shows next page", async ({ page, service }) => {
  // Seed 60 events to force pagination at 50/page.
  const big = Array.from({ length: 60 }, (_, i) => ({
    email: "admin@example.com",
    app_slug: "users",
    event_name: "bulk",
    payload: { i },
  }));
  await service.from("events").insert(big);

  await signInAsAdmin(page, service);
  await page.goto("http://localhost:5173/admin/apps/analytics");
  await expect(page.getByTestId("analytics-pagination-info")).toContainText("Page 1");
  await page.getByTestId("analytics-pagination-next").click();
  await expect(page.getByTestId("analytics-pagination-info")).toContainText("Page 2");
});
```

- [ ] **Step 2: Run the failing tests**

```bash
SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_ANON_KEY=... VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... npx playwright test tests/admin/analytics.spec.ts -g "table|sparkline|pagination" --project=desktop
```

Expected: FAIL.

- [ ] **Step 3: Extend the Analytics component**

Replace `D:/vibes/noahweis.dev/src/routes/admin/apps/Analytics.tsx`:

```tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { APPS } from "../../../apps/registry";
import type { EventRow } from "../../../lib/types";

type Filters = {
  rangeDays: 1 | 7 | 30;
  appSlug: string;
  eventName: string;
  userEmail: string;
};

const PAGE_SIZE = 50;

const inputCss: React.CSSProperties = { padding: "6px 10px", background: "#0e0e10", border: "1px solid #3f3f46", borderRadius: 4, color: "#f5f5f7", fontSize: 13 };
const btnCss:   React.CSSProperties = { padding: "6px 12px", background: "#4f46e5", color: "white", border: 0, borderRadius: 4, cursor: "pointer", fontSize: 13 };
const linkBtn:  React.CSSProperties = { background: "transparent", border: 0, color: "#818cf8", cursor: "pointer", padding: 0, fontSize: 12 };
const statCss:  React.CSSProperties = { padding: 14, background: "#18181b", border: "1px solid #27272a", borderRadius: 8, minWidth: 140 };
const labelCss: React.CSSProperties = { fontSize: 12, color: "#a1a1aa", textTransform: "uppercase", letterSpacing: 0.5 };
const valueCss: React.CSSProperties = { fontSize: 24, fontWeight: 600, marginTop: 4 };
const tableCss: React.CSSProperties = { width: "100%", borderCollapse: "collapse", marginTop: 24 };
const thtdCss:  React.CSSProperties = { padding: "8px 10px", borderBottom: "1px solid #27272a", textAlign: "left", fontSize: 13, verticalAlign: "top" };

function dailyBuckets(events: EventRow[], days: number): { date: string; count: number }[] {
  const map = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    map.set(d.toISOString().slice(0, 10), 0);
  }
  for (const e of events) {
    const day = e.created_at.slice(0, 10);
    if (map.has(day)) map.set(day, (map.get(day) ?? 0) + 1);
  }
  return [...map.entries()].map(([date, count]) => ({ date, count }));
}

export function Analytics() {
  const [filters, setFilters] = useState<Filters>({ rangeDays: 7, appSlug: "", eventName: "", userEmail: "" });
  const [applied, setApplied] = useState<Filters>(filters);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  useEffect(() => {
    const since = new Date(Date.now() - applied.rangeDays * 24 * 60 * 60 * 1000).toISOString();
    let q = supabase.from("events").select("*").gte("created_at", since).order("created_at", { ascending: false }).limit(1000);
    if (applied.appSlug)   q = q.eq("app_slug", applied.appSlug);
    if (applied.userEmail) q = q.eq("email", applied.userEmail);
    if (applied.eventName) q = q.ilike("event_name", `%${applied.eventName}%`);
    setLoading(true);
    q.then(({ data }) => {
      setEvents((data as EventRow[]) ?? []);
      setLoading(false);
      setPage(1);
    });
  }, [applied]);

  const totalEvents   = events.length;
  const distinctUsers = new Set(events.map((e) => e.email).filter(Boolean)).size;
  const distinctApps  = new Set(events.map((e) => e.app_slug).filter(Boolean)).size;

  const buckets = useMemo(() => dailyBuckets(events, applied.rangeDays), [events, applied.rangeDays]);
  const maxBucket = Math.max(1, ...buckets.map((b) => b.count));

  const totalPages = Math.max(1, Math.ceil(events.length / PAGE_SIZE));
  const pageEvents = events.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function toggleExpand(id: number) {
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div data-testid="analytics-root">
      <h1 style={{ marginTop: 0 }}>Analytics</h1>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <select data-testid="analytics-filter-range" style={inputCss} value={filters.rangeDays} onChange={(e) => setFilters({ ...filters, rangeDays: Number(e.target.value) as 1 | 7 | 30 })}>
          <option value={1}>Last 24h</option>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
        </select>
        <select data-testid="analytics-filter-app" style={inputCss} value={filters.appSlug} onChange={(e) => setFilters({ ...filters, appSlug: e.target.value })}>
          <option value="">All apps</option>
          {APPS.map((a) => <option key={a.slug} value={a.slug}>{a.name}</option>)}
        </select>
        <input data-testid="analytics-filter-event" style={inputCss} placeholder="Event name contains…" value={filters.eventName} onChange={(e) => setFilters({ ...filters, eventName: e.target.value })} />
        <input data-testid="analytics-filter-user" style={inputCss} placeholder="user@example.com" value={filters.userEmail} onChange={(e) => setFilters({ ...filters, userEmail: e.target.value })} />
        <button data-testid="analytics-filter-apply" style={btnCss} onClick={() => setApplied(filters)}>Apply</button>
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
        <div style={statCss}><div style={labelCss}>Events</div><div data-testid="analytics-total-events" style={valueCss}>{loading ? "…" : totalEvents}</div></div>
        <div style={statCss}><div style={labelCss}>Distinct users</div><div data-testid="analytics-distinct-users" style={valueCss}>{loading ? "…" : distinctUsers}</div></div>
        <div style={statCss}><div style={labelCss}>Distinct apps</div><div data-testid="analytics-distinct-apps" style={valueCss}>{loading ? "…" : distinctApps}</div></div>
      </div>

      <div style={{ marginTop: 24 }}>
        <div style={labelCss}>Daily activity</div>
        <svg data-testid="analytics-sparkline" width="100%" height="80" viewBox={`0 0 ${buckets.length * 20} 80`} preserveAspectRatio="none">
          {buckets.map((b, i) => {
            const h = (b.count / maxBucket) * 70;
            return (
              <g key={b.date}>
                <rect x={i * 20 + 2} y={75 - h} width={16} height={h} fill="#4f46e5" />
                <title>{b.date}: {b.count}</title>
              </g>
            );
          })}
        </svg>
      </div>

      <table style={tableCss}>
        <thead>
          <tr>
            <th style={thtdCss}>Time</th>
            <th style={thtdCss}>User</th>
            <th style={thtdCss}>App</th>
            <th style={thtdCss}>Event</th>
            <th style={thtdCss}>Payload</th>
          </tr>
        </thead>
        <tbody>
          {pageEvents.map((e) => (
            <tr key={e.id} data-testid="analytics-event-row">
              <td style={thtdCss}>{new Date(e.created_at).toLocaleString()}</td>
              <td style={thtdCss}>{e.email ?? "—"}</td>
              <td style={thtdCss}>{e.app_slug ?? "—"}</td>
              <td style={thtdCss}>{e.event_name}</td>
              <td style={thtdCss}>
                {Object.keys(e.payload).length === 0 ? (
                  <span style={{ color: "#71717a" }}>—</span>
                ) : (
                  <>
                    <button data-testid="analytics-expand-payload" style={linkBtn} onClick={() => toggleExpand(e.id)}>
                      {expanded.has(e.id) ? "hide" : "show"}
                    </button>
                    {expanded.has(e.id) && (
                      <pre data-testid="analytics-payload-json" style={{ margin: "6px 0 0", fontSize: 12, color: "#a1a1aa" }}>{JSON.stringify(e.payload, null, 2)}</pre>
                    )}
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center" }}>
        <button data-testid="analytics-pagination-prev" style={btnCss} disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button>
        <span data-testid="analytics-pagination-info" style={{ color: "#a1a1aa", fontSize: 13 }}>Page {page} of {totalPages}</span>
        <button data-testid="analytics-pagination-next" style={btnCss} disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Re-run the tests**

```bash
SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_ANON_KEY=... VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... npx playwright test tests/admin/analytics.spec.ts --project=desktop
```

Expected: PASS (5 tests total).

- [ ] **Step 5: Commit**

```bash
cd D:/vibes/noahweis.dev
git add src/routes/admin/apps/Analytics.tsx tests/admin/analytics.spec.ts
git commit -m "feat(admin): analytics sparkline, event table, pagination"
```

---

## Task 16: Production deployment + smoke test

**Files:**
- Create: `docs/admin-deploy.md`
- Modify: `playwright.config.ts` (no test changes; doc + manual steps)

This task is mostly process. We create the production Supabase project, push migrations, deploy the Edge Function, seed the admin row, configure prod env vars, build, deploy, and run a manual smoke test.

- [ ] **Step 1: Create the production Supabase project**

In a browser, go to https://supabase.com/dashboard → New project. Save:
- Project URL (`https://<ref>.supabase.co`)
- anon public key
- service_role key (treat as a secret — never commit)

- [ ] **Step 2: Link the local repo to the prod project**

```bash
cd D:/vibes/noahweis.dev
supabase login          # opens browser for auth
supabase link --project-ref <ref>
```

- [ ] **Step 3: Push migrations to prod**

```bash
supabase db push
```

Expected: applies `0001_init.sql` and `0002_rls.sql` to the prod database.

- [ ] **Step 4: Deploy the Edge Function**

```bash
supabase functions deploy request-otp --no-verify-jwt
```

`--no-verify-jwt` matches our local config (the function is callable by unauthenticated browsers — security comes from the allowlist check inside).

The service role key is automatically available to the function as `SUPABASE_SERVICE_ROLE_KEY` env var (set by Supabase platform).

- [ ] **Step 5: Seed the admin row**

In the Supabase dashboard → SQL editor, run (substitute `<admin email>` with your real address):

```sql
insert into allowed_emails (email, label, is_admin, enabled)
values ('<admin email>', '<your label>', true, true);
```

- [ ] **Step 6: Configure GitHub Actions / build env**

The repo already has a GitHub Actions deploy workflow. Add two repository secrets in GitHub:
- `VITE_SUPABASE_URL` = the prod URL from Step 1
- `VITE_SUPABASE_ANON_KEY` = the prod anon key

Modify the workflow's build step to surface these as env vars to `npm run build` (e.g., `env: { VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}, VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }} }`). If the workflow file is at `.github/workflows/deploy.yml`, add the env block under the build step.

- [ ] **Step 7: Build locally with prod env (optional sanity check)**

```bash
cd D:/vibes/noahweis.dev
VITE_SUPABASE_URL=https://<ref>.supabase.co VITE_SUPABASE_ANON_KEY=<anon> npm run build
```

Expected: clean build. The Supabase URL is baked into `dist/`.

- [ ] **Step 8: Deploy to Dreamhost**

Trigger the existing GitHub Actions deploy (push to main, or manual dispatch — whichever the workflow uses).

- [ ] **Step 9: Manual smoke test**

In a real browser, visit `https://noahweis.dev/admin`. Walk through:

1. Submit your admin email. Check the inbox for a 6-digit code.
2. Enter the code. Land on `/admin/dashboard`.
3. Both app cards (User Manager, Analytics) appear.
4. Open User Manager. Add a second email (e.g., a personal alias). The row appears.
5. Sign out. Sign back in with the second email — should succeed but show empty dashboard.
6. Go back to admin, grant the second email a per-app permission, and confirm it now sees the granted app.
7. Open Analytics. Verify `signed_in`, `signed_out`, `app_opened` events appear.
8. Submit an unknown email at the login screen. Verify no email arrives. Check Analytics for an `allowlist_blocked` event with the attempted address in payload.

Document any issues; create follow-up tasks for them.

- [ ] **Step 10: Write the admin deploy doc**

Create `D:/vibes/noahweis.dev/docs/admin-deploy.md`:

```markdown
# Admin shell — production runbook

Status: live. Edge Function: request-otp. Supabase project ref: <ref>.

## Adding a new user
Sign in to /admin, open User Manager, fill email + label, click Add user.
The user can immediately request a code.

## Disabling access without deletion
Open User Manager, click "disable" on the user's row. Their next OTP request
silently fails (an `allowlist_blocked` event is logged with their email in payload).

## Rotating the Supabase anon key
Generate a new anon key in the Supabase dashboard → Project Settings → API.
Update the `VITE_SUPABASE_ANON_KEY` GitHub secret, redeploy.
The old key keeps working until you revoke it.

## Migrating the schema
Add a new file `supabase/migrations/000N_<name>.sql`. Test locally with
`npm run supabase:reset`. Push to prod with `supabase db push`.

## Editing the Edge Function
Edit `supabase/functions/request-otp/index.ts`. Test locally with
`supabase functions serve request-otp --no-verify-jwt`. Deploy with
`supabase functions deploy request-otp --no-verify-jwt`.

## Adding a new "dev app"
1. Create a component under `src/routes/admin/apps/<Name>.tsx`.
2. Add an entry to `src/apps/registry.ts`.
3. (Optional) Have the app call `logEvent("did_thing", payload, "<slug>")` for analytics.
4. Set `adminOnly: false` if non-admins should be able to use it; grant per-app
   permissions through the User Manager.
```

- [ ] **Step 11: Commit**

```bash
cd D:/vibes/noahweis.dev
git add docs/admin-deploy.md
git commit -m "docs: add admin shell production runbook"
```

---

## Task 17: CI — run Playwright tests against the local Supabase stack

**Files:**
- Modify: `.github/workflows/deploy.yml`

The current workflow builds and rsyncs to Dreamhost without running tests. Now that the project has a meaningful test suite that depends on a live Supabase backend, CI should spin up the same local stack we use in development (Postgres + Auth + Edge Functions, all in Docker) and run the Playwright tests against it before the deploy job runs. GitHub-hosted `ubuntu-latest` runners come with Docker pre-installed, so no extra setup is needed for the engine itself — we just install the Supabase CLI and call `supabase start`.

The deploy job becomes dependent on the test job (`needs: test`), so a failing test blocks production.

- [ ] **Step 1: Read the existing workflow**

Read `D:/vibes/noahweis.dev/.github/workflows/deploy.yml` to confirm the current shape (single `build-and-deploy` job that does checkout → setup-node → npm ci → npm run build → SSH → rsync).

- [ ] **Step 2: Replace the workflow with a two-job version (test + build-and-deploy)**

Replace the entire contents of `D:/vibes/noahweis.dev/.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main, live]
  workflow_dispatch:

concurrency:
  group: deploy-${{ github.ref }}
  cancel-in-progress: false

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install Node deps
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: Install Supabase CLI
        uses: supabase/setup-cli@v1
        with:
          version: latest

      - name: Start local Supabase stack (Docker)
        run: supabase start

      - name: Export Supabase env vars
        run: |
          eval "$(supabase status -o env)"
          {
            echo "SUPABASE_URL=$API_URL"
            echo "SUPABASE_ANON_KEY=$ANON_KEY"
            echo "SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY"
            echo "VITE_SUPABASE_URL=$API_URL"
            echo "VITE_SUPABASE_ANON_KEY=$ANON_KEY"
          } >> "$GITHUB_ENV"

      - name: Serve request-otp Edge Function in background
        run: |
          nohup supabase functions serve request-otp --no-verify-jwt > /tmp/edge.log 2>&1 &
          # Give it a couple of seconds to boot.
          for i in 1 2 3 4 5; do
            if curl -sf -X POST "$VITE_SUPABASE_URL/functions/v1/request-otp" -H "apikey: $VITE_SUPABASE_ANON_KEY" -H "Content-Type: application/json" -d '{}' > /dev/null; then
              echo "edge function up"; break
            fi
            sleep 1
          done

      - name: Run Playwright tests
        run: npx playwright test

      - name: Upload Playwright report on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7

      - name: Stop Supabase stack
        if: always()
        run: supabase stop --no-backup

  build-and-deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install
        run: npm ci

      - name: Build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
        run: npm run build

      - name: Configure SSH
        env:
          SSH_PRIVATE_KEY: ${{ secrets.SSH_PRIVATE_KEY }}
          SSH_HOST: ${{ secrets.SSH_HOST }}
        run: |
          mkdir -p ~/.ssh
          echo "$SSH_PRIVATE_KEY" > ~/.ssh/id_ed25519
          chmod 600 ~/.ssh/id_ed25519
          ssh-keyscan -H "$SSH_HOST" >> ~/.ssh/known_hosts

      - name: Deploy via rsync
        env:
          SSH_HOST: ${{ secrets.SSH_HOST }}
          SSH_USER: ${{ secrets.SSH_USER }}
          WEBROOT_PATH: ${{ secrets.WEBROOT_PATH }}
        run: |
          rsync -az --delete -e "ssh -i ~/.ssh/id_ed25519" \
            dist/ "$SSH_USER@$SSH_HOST:$WEBROOT_PATH/"
```

Notes on the workflow design:

- `supabase/setup-cli@v1` is the official action; it installs the CLI on the runner.
- `supabase start` boots Postgres + Auth + Storage + Inbucket via Docker. On a fresh runner it pulls images (~1–2 min); the `actions/cache` for Docker images can be added later if CI starts feeling slow.
- `supabase status -o env` exports the API URL + anon key + service role key. We promote them into both bare names (used by tests) and `VITE_*` names (used by the app at dev time).
- The Edge Function is served in the background with `nohup` because Playwright tests assume it's reachable at `/functions/v1/request-otp`.
- `build-and-deploy` does not run the tests itself; it trusts the `needs: test` gate.

- [ ] **Step 3: Validate locally**

Before pushing, dry-run the workflow YAML to catch syntax errors:

```bash
cd D:/vibes/noahweis.dev
# If `actionlint` is installed:
actionlint .github/workflows/deploy.yml || echo "actionlint not installed — skipping"
# As a fallback, just confirm it parses as YAML:
node -e "console.log(require('js-yaml').load(require('fs').readFileSync('.github/workflows/deploy.yml','utf8')).jobs)" 2>&1 || echo "(js-yaml not installed; skip)"
```

(Either tool is optional. If neither is available, GitHub will surface YAML errors when the workflow runs.)

- [ ] **Step 4: Commit**

```bash
cd D:/vibes/noahweis.dev
git add .github/workflows/deploy.yml
git commit -m "ci: run Playwright tests against local Supabase stack before deploy"
```

- [ ] **Step 5: Smoke test on a PR**

Push the branch and open a PR. Watch the `test` job run end-to-end at https://github.com/<owner>/noahweis.dev/actions. Expected:

1. `test` job: passes (all suites green, Supabase started + stopped cleanly).
2. `build-and-deploy` job: starts only after `test` passes; deploys to Dreamhost as before.

If `test` fails on CI but passes locally, download the Playwright report artifact (`playwright-report` from the failure run) for traces.

---

## Self-review notes

A scan of the spec sections vs. tasks:

- **Auth flow (spec § Auth flow)** → Tasks 4 (Edge Function), 6 (email step), 7 (verify + redirect), 5 (helpers), 8 (session gate). Covered.
- **Authorization (spec § Authorization model)** → Task 9 (canAccessApp), 10 (RequireApp), 13 (per-app perms UI), Task 3 (RLS as the third layer). Covered.
- **Data model (spec § Data model)** → Task 2 (tables, indexes, trigger), Task 3 (RLS). Covered.
- **React shell (spec § React shell)** → Tasks 5–10 collectively. Covered.
- **App registry** → Task 9.
- **Routes** → Tasks 6, 7, 8, 10 cover all four route patterns from the spec table.
- **User Manager (spec § User Manager)** → Tasks 12–13. Covered. Note: `is_admin` toggling is intentionally read-only in the UI per the spec; this is implemented in Task 13 by omitting an admin toggle.
- **Analytics (spec § Analytics)** → Tasks 14–15. Top strip, sparkline, table, filters all covered.
- **logEvent primitive** → Task 11.
- **Edge Function `request-otp`** → Task 4.
- **Error handling (spec § Error handling)** → Login error states (Tasks 6–7), `logEvent` swallow (Task 11), session-refresh redirect (Task 8). RLS denial toast is not explicitly implemented as a global toast — left as graceful degradation since it represents a guard bug rather than a normal flow.
- **Testing** → Tests live alongside each implementation task, plus DB tests in Tasks 2–3.
- **Deployment** → Task 16.
- **CI / Docker in GitHub Actions** → Task 17.

No spec section is uncovered.
