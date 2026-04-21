import { test, expect, signInAs } from "../../fixtures/supabase";

test.beforeAll(async ({ resetDb, service }) => {
  test.setTimeout(120_000);
  await Promise.all([
    resetDb(),
    service.from("allowed_emails").insert([
      { email: "admin@example.com", is_admin: true,  enabled: true },
      { email: "user@example.com",  is_admin: false, enabled: true },
      { email: "disabled@example.com", is_admin: false, enabled: false },
    ]),
  ]);
});

test("enabled non-admin can open ZAP and lands on empty trip list", async ({ page, service }) => {
  await signInAs(page, service, "user@example.com");
  await page.getByTestId("app-card-zap").click();
  await page.waitForURL("**/admin/apps/zap");
  await expect(page.getByTestId("zap-trip-list")).toBeVisible();
  await expect(page.getByTestId("zap-empty")).toBeVisible();
});

test("admin can also open ZAP", async ({ page, service }) => {
  await signInAs(page, service, "admin@example.com");
  await page.getByTestId("app-card-zap").click();
  await page.waitForURL("**/admin/apps/zap");
  await expect(page.getByTestId("zap-trip-list")).toBeVisible();
});
