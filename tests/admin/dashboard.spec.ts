import { test, expect, signInAs } from "../fixtures/supabase";

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

test("admin sees all apps as cards", async ({ page, service }) => {
  await signInAs(page, service, "admin@example.com");
  await expect(page.getByTestId("app-card-users")).toBeVisible();
  await expect(page.getByTestId("app-card-analytics")).toBeVisible();
  await expect(page.getByTestId("app-card-zap")).toBeVisible();
});

test("non-admin sees only allowlist apps (ZAP), not admin-only apps", async ({ page, service }) => {
  await signInAs(page, service, "user@example.com");
  await expect(page.getByTestId("app-card-zap")).toBeVisible();
  await expect(page.getByTestId("app-card-users")).not.toBeVisible();
  await expect(page.getByTestId("app-card-analytics")).not.toBeVisible();
});

test("admin can navigate into the user manager", async ({ page, service }) => {
  await signInAs(page, service, "admin@example.com");
  await page.getByTestId("app-card-users").click();
  await page.waitForURL("**/admin/apps/users");
  await expect(page.getByTestId("user-manager-root")).toBeVisible();
});

test("non-admin navigating directly to /admin/apps/users is bounced to dashboard", async ({ page, service }) => {
  await signInAs(page, service, "user@example.com");
  await page.goto("http://localhost:5173/admin/apps/users");
  await page.waitForURL("**/admin/dashboard");
  // Non-admin sees ZAP but not the admin-only User Manager card.
  await expect(page.getByTestId("app-card-zap")).toBeVisible();
  await expect(page.getByTestId("app-card-users")).not.toBeVisible();
});

test("unknown app slug bounces to dashboard", async ({ page, service }) => {
  await signInAs(page, service, "admin@example.com");
  await page.goto("http://localhost:5173/admin/apps/nope");
  await page.waitForURL("**/admin/dashboard");
});
