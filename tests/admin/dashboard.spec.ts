import { test, expect } from "../fixtures/supabase";

test.beforeAll(async ({ resetDb, service }) => {
  test.setTimeout(120_000);
  await Promise.all([
    resetDb(),
    service.from("allowed_emails").insert([
      { email: "admin@example.com", is_admin: true,  enabled: true },
      { email: "user@example.com",  is_admin: false, enabled: true },
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

test("admin sees both built-in apps as cards", async ({ page, service }) => {
  await signInDirect(page, service, "admin@example.com");
  await expect(page.getByTestId("app-card-users")).toBeVisible();
  await expect(page.getByTestId("app-card-analytics")).toBeVisible();
});

test("non-admin with no permissions sees no cards and an empty state message", async ({ page, service }) => {
  await signInDirect(page, service, "user@example.com");
  await expect(page.getByTestId("dashboard-empty")).toBeVisible();
  await expect(page.getByTestId("app-card-users")).not.toBeVisible();
  await expect(page.getByTestId("app-card-analytics")).not.toBeVisible();
});

test("admin can navigate into the user manager", async ({ page, service }) => {
  await signInDirect(page, service, "admin@example.com");
  await page.getByTestId("app-card-users").click();
  await page.waitForURL("**/admin/apps/users");
  await expect(page.getByTestId("user-manager-root")).toBeVisible();
});

test("non-admin navigating directly to /admin/apps/users is bounced to dashboard", async ({ page, service }) => {
  await signInDirect(page, service, "user@example.com");
  await page.goto("http://localhost:5173/admin/apps/users");
  await page.waitForURL("**/admin/dashboard");
  await expect(page.getByTestId("dashboard-empty")).toBeVisible();
});

test("unknown app slug bounces to dashboard", async ({ page, service }) => {
  await signInDirect(page, service, "admin@example.com");
  await page.goto("http://localhost:5173/admin/apps/nope");
  await page.waitForURL("**/admin/dashboard");
});
