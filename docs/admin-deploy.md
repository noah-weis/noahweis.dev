# Admin shell — production runbook

Status: live. Edge Function: `request-otp`. Supabase project ref: see GitHub secret `VITE_SUPABASE_URL`.

## Initial deployment checklist

Run once when standing up the production environment.

### 1. Create the Supabase project
Go to https://supabase.com/dashboard → New project. Record:
- Project URL (`https://<ref>.supabase.co`)
- Anon public key
- Service role key (**never commit**)

### 2. Link and push migrations
```bash
cd D:/vibes/noahweis.dev
supabase login          # opens browser
supabase link --project-ref <ref>
supabase db push        # applies 0001_init.sql and 0002_rls.sql
```

### 3. Deploy the Edge Function
```bash
supabase functions deploy request-otp --no-verify-jwt
```
`--no-verify-jwt` lets browsers call it unauthenticated; security comes from the allowlist check inside. The `SUPABASE_SERVICE_ROLE_KEY` is injected automatically by the Supabase platform.

### 4. Seed the admin row
In the Supabase dashboard → SQL editor:
```sql
insert into allowed_emails (email, label, is_admin, enabled)
values ('<admin email>', 'Noah', true, true);
```

### 5. Set GitHub secrets
In the repo → Settings → Secrets → Actions, add:
- `VITE_SUPABASE_URL` — prod project URL
- `VITE_SUPABASE_ANON_KEY` — prod anon key

### 6. Deploy to Dreamhost
**Via GitHub Actions (recommended):** Push to `main` or `live`, or trigger a manual dispatch. The `test` job runs Playwright against a local Docker stack first; `build-and-deploy` runs only if tests pass.

**Via local rsync (using `scripts/ssh.sh`):**
```bash
# Build with prod env vars first
VITE_SUPABASE_URL=https://<ref>.supabase.co \
VITE_SUPABASE_ANON_KEY=<anon> \
npm run build

# Deploy dist/ to Dreamhost
rsync -az --delete \
  -e "bash scripts/ssh.sh" \
  dist/ dh_zi7i9y@pdx1-shared-a4-10.dreamhost.com:<WEBROOT_PATH>/
```

### 7. Smoke test
Visit `https://noahweis.dev/admin` and walk through:
1. Enter admin email → receive 6-digit code in inbox.
2. Enter code → land on `/admin/dashboard`.
3. Both app cards appear (User Manager, Analytics).
4. Open User Manager → add a second email → row appears.
5. Sign out → sign in as second email → empty dashboard (no permissions yet).
6. Back as admin → grant the second email a per-app permission → confirm the app now appears.
7. Open Analytics → `signed_in`, `signed_out`, `app_opened` events are visible.
8. Submit an unknown email at login → no email arrives → Analytics shows `allowlist_blocked` event with the attempted address in payload.

---

## Ongoing operations

### Adding a new user
Sign in to `/admin`, open User Manager, fill email + label, click **Add user**. The user can immediately request a code.

### Disabling access without deletion
Open User Manager, click **disable** on the user's row. Their next OTP request silently fails; an `allowlist_blocked` event is logged with their email in the payload.

### Rotating the Supabase anon key
Generate a new anon key: Supabase dashboard → Project Settings → API.
Update the `VITE_SUPABASE_ANON_KEY` GitHub secret, then redeploy.
The old key stays valid until you revoke it in the dashboard.

### Migrating the schema
Add `supabase/migrations/000N_<name>.sql`. Test locally with `npm run supabase:reset`. Push to prod with `supabase db push`.

### Editing the Edge Function
Edit `supabase/functions/request-otp/index.ts`. Test locally with:
```bash
supabase functions serve request-otp --no-verify-jwt
```
Deploy with:
```bash
supabase functions deploy request-otp --no-verify-jwt
```

### Adding a new dev app
1. Create `src/routes/admin/apps/<Name>.tsx`.
2. Add an entry to `src/apps/registry.ts` (set `adminOnly: false` if non-admins should access it).
3. Add a route in `src/App.tsx` under the `<AdminRoot>` element.
4. Optionally call `logEvent("event_name", payload, "<slug>")` from within the app for analytics.
