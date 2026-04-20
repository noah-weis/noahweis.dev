import { test, expect } from "../fixtures/supabase";

test.beforeAll(async ({ resetDb, service }) => {
  test.setTimeout(120_000);
  await Promise.all([
    resetDb(),
    service.from("allowed_emails").insert([
      { email: "admin@example.com", is_admin: true, enabled: true },
    ]),
  ]);
});

async function signInDirect(page: any, service: any, email: string) {
  const { data: link } = await service.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: "http://localhost:5173/admin/dashboard" },
  });
  await page.goto(link!.properties.action_link);
  await page.waitForURL(/localhost:5173/);
  await page.goto("http://localhost:5173/admin/dashboard");
  await page.waitForSelector('[data-testid="dashboard-root"]', { timeout: 10_000 });
}

test("opening the user manager writes an app_opened event", async ({ page, service }) => {
  await signInDirect(page, service, "admin@example.com");
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
  await signInDirect(page, service, "admin@example.com");
  await page.getByTestId("admin-topbar-signout").click();
  await page.waitForURL("**/admin");

  const { data } = await service.from("events").select("*").eq("event_name", "signed_out").eq("email", "admin@example.com");
  expect(data?.length).toBeGreaterThanOrEqual(1);
});

test("logEvent works directly from a page", async ({ page, service }) => {
  await signInDirect(page, service, "admin@example.com");
  await page.evaluate(async () => {
    const mod = await import("/src/lib/logEvent.ts");
    await mod.logEvent("custom_thing", { x: 1 }, "users");
  });
  await page.waitForTimeout(300);
  const { data } = await service.from("events").select("*").eq("event_name", "custom_thing");
  expect(data?.length).toBeGreaterThanOrEqual(1);
  expect((data![0].payload as { x: number }).x).toBe(1);
});
