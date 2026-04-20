import { test, expect } from "../fixtures/supabase";

test.beforeEach(({ resetDb, service }) => {
  test.setTimeout(120_000);
  return Promise.all([
    resetDb(),
    service.from("allowed_emails").insert([
      { email: "admin@example.com", is_admin: true, enabled: true },
    ]),
  ]);
});

async function signInAsAdmin(page: any, service: any) {
  const { data: link } = await service.auth.admin.generateLink({ type: "magiclink", email: "admin@example.com" });
  const otp = link!.properties.email_otp!;
  await page.route("**/functions/v1/request-otp", (route: any) =>
    route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) })
  );
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
