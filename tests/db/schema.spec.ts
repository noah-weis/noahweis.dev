import { test, expect } from "../fixtures/supabase";

test.describe.serial("schema", () => {
  test.beforeAll(({ resetDb }) => {
    test.setTimeout(120_000);
    return resetDb();
  });

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

test.describe.serial("rls", () => {
  test.beforeAll(async ({ resetDb, service }) => {
    test.setTimeout(120_000);
    resetDb();
    const { error } = await service.from("allowed_emails").insert([
      { email: "admin@example.com", is_admin: true,  enabled: true },
      { email: "user@example.com",  is_admin: false, enabled: true },
    ]);
    if (error) throw error;
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
    const otp = link!.properties.email_otp!;
    await anon.auth.verifyOtp({ email: "user@example.com", token: otp, type: "email" });
    const { data } = await anon.from("allowed_emails").select("email");
    expect(data).toEqual([{ email: "user@example.com" }]);
    await anon.auth.signOut();
  });

  test("non-admin cannot insert into allowed_emails", async ({ anon, service }) => {
    const { data: link } = await service.auth.admin.generateLink({ type: "magiclink", email: "user@example.com" });
    const otp = link!.properties.email_otp!;
    await anon.auth.verifyOtp({ email: "user@example.com", token: otp, type: "email" });
    const { error } = await anon.from("allowed_emails").insert({ email: "evil@example.com", is_admin: true, enabled: true });
    expect(error).not.toBeNull();
    await anon.auth.signOut();
  });

  test("authenticated user can insert their own events", async ({ anon, service }) => {
    const { data: link } = await service.auth.admin.generateLink({ type: "magiclink", email: "user@example.com" });
    const otp = link!.properties.email_otp!;
    await anon.auth.verifyOtp({ email: "user@example.com", token: otp, type: "email" });
    const { error } = await anon.from("events").insert({ email: "user@example.com", event_name: "test", payload: {} });
    expect(error).toBeNull();
    await anon.auth.signOut();
  });
});
