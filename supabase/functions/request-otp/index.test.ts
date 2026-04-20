// Deno test executed via `supabase functions serve` + curl from a Playwright spec.
// We test by making real HTTP requests; this file is documentation of expected behavior.
//
// Cases:
// 1. POST { email: "admin@example.com" } where admin is in allowed_emails enabled=true → { ok: true }, no allowlist_blocked event written.
// 2. POST { email: "stranger@example.com" } → { ok: true } AND an allowlist_blocked event with payload.attempted_email = "stranger@example.com".
// 3. POST { email: "disabled@example.com" } where the row exists but enabled=false → { ok: true } AND an allowlist_blocked event.
// 4. POST { } (no email) → { ok: false, error: "missing email" }, status 400.
// 5. POST { email: "NOT-AN-EMAIL" } → { ok: false, error: "invalid email" }, status 400.
