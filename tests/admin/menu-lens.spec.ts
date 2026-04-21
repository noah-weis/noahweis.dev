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
  // Grant the non-admin access to menu-lens so we can verify non-admin access works.
  await service.from("user_app_permissions").insert([
    { email: "user@example.com", app_slug: "menu-lens" },
  ]);
});

test("admin dashboard shows the Menu Lens card", async ({ page, service }) => {
  await signInAs(page, service, "admin@example.com");
  await expect(page.getByTestId("app-card-menu-lens")).toBeVisible();
  await expect(page.getByTestId("app-card-menu-lens")).toContainText("Menu Lens");
});

test("admin can open Menu Lens and sees the scan UI", async ({ page, service }) => {
  await signInAs(page, service, "admin@example.com");
  await page.getByTestId("app-card-menu-lens").click();
  await page.waitForURL("**/admin/apps/menu-lens");
  await expect(page.getByTestId("menu-lens-root")).toBeVisible();
  await expect(page.getByTestId("menu-lens-pick")).toBeVisible();
  await expect(page.locator("h1", { hasText: "Menu Lens" })).toBeVisible();
});

test("non-admin with menu-lens permission can see and open the app", async ({ page, service }) => {
  await signInAs(page, service, "user@example.com");
  await expect(page.getByTestId("app-card-menu-lens")).toBeVisible();
  await page.getByTestId("app-card-menu-lens").click();
  await page.waitForURL("**/admin/apps/menu-lens");
  await expect(page.getByTestId("menu-lens-root")).toBeVisible();
});
