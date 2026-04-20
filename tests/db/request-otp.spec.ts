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
    test.setTimeout(120_000);
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
