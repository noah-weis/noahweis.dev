// Expected behavior, verified end-to-end from Playwright specs (receipt.spec.ts)
// which stub the Edge Function via Playwright route intercepts.
//
// Direct cases (on the Supabase stack, not unit-tested here):
//
// 1. POST without Authorization → 401 "missing bearer token".
// 2. POST { storagePath: "not-a-uuid/x.jpg" } → 400 "invalid trip id".
// 3. POST with JWT whose email is NOT a member of the path's trip → 403.
// 4. Valid path + member, but object missing in storage → 404 "image not found".
// 5. Happy path (Anthropic mock): returns { ok: true, total_cents, date, label, items }.
// 6. Anthropic non-JSON response → 502 "anthropic returned non-json".
// 7. Anthropic shape invalid (missing total_cents) → 502 "unexpected shape".
