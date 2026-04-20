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
