import { test, expect, signInAs } from "../../fixtures/supabase";

test.beforeAll(async ({ resetDb, service }) => {
  test.setTimeout(120_000);
  await Promise.all([
    resetDb(),
    service.from("allowed_emails").insert([
      { email: "alice@example.com", is_admin: false, enabled: true },
      { email: "bob@example.com",   is_admin: false, enabled: true },
    ]),
  ]);
});

test("create a trip, add a second member by email, member sees it after signing in", async ({ page, service, browser }) => {
  await signInAs(page, service, "alice@example.com");
  await page.goto("http://localhost:5173/admin/apps/zap");
  await expect(page.getByTestId("zap-empty")).toBeVisible();

  await page.getByTestId("zap-new-trip-button").click();
  await page.getByTestId("zap-new-trip-name").fill("Tahoe 2026");
  await page.getByTestId("zap-new-trip-submit").click();

  // Navigate to the trip.
  await page.waitForSelector('[data-testid^="zap-trip-card-"]');
  await page.locator('[data-testid^="zap-trip-card-"]').first().click();

  await expect(page.getByTestId("zap-trip-name")).toHaveText(/Tahoe 2026/);
  await expect(page.getByTestId("zap-member-alice@example.com")).toBeVisible();

  // Add Bob.
  await page.getByTestId("zap-add-member-input").fill("bob@example.com");
  await page.getByTestId("zap-add-member-submit").click();
  await expect(page.getByTestId("zap-member-bob@example.com")).toBeVisible();

  // Bob signs in and sees the trip.
  const bobContext = await browser.newContext();
  const bobPage = await bobContext.newPage();
  await signInAs(bobPage, service, "bob@example.com");
  await bobPage.goto("http://localhost:5173/admin/apps/zap");
  await expect(bobPage.locator('[data-testid^="zap-trip-card-"]')).toHaveCount(1);
  await expect(bobPage.getByText("Tahoe 2026")).toBeVisible();
  await bobContext.close();
});

test("adding an email not on the allowlist shows a friendly error", async ({ page, service }) => {
  await signInAs(page, service, "alice@example.com");
  await page.goto("http://localhost:5173/admin/apps/zap");

  await page.getByTestId("zap-new-trip-button").click();
  await page.getByTestId("zap-new-trip-name").fill("Invalid member test");
  await page.getByTestId("zap-new-trip-submit").click();
  await page.locator('[data-testid^="zap-trip-card-"]').first().click();

  await page.getByTestId("zap-add-member-input").fill("nope@example.com");
  await page.getByTestId("zap-add-member-submit").click();
  await expect(page.getByTestId("zap-trip-error")).toContainText(/isn't set up/i);
});

test("close + reopen a trip", async ({ page, service }) => {
  await signInAs(page, service, "alice@example.com");
  await page.goto("http://localhost:5173/admin/apps/zap");
  await page.getByTestId("zap-new-trip-button").click();
  await page.getByTestId("zap-new-trip-name").fill("Closeable");
  await page.getByTestId("zap-new-trip-submit").click();
  await page.locator('[data-testid^="zap-trip-card-"]').first().click();

  await page.getByTestId("zap-close-trip").click();
  await expect(page.getByTestId("zap-trip-name")).toContainText(/Closed/);
  // Reopen
  await page.getByTestId("zap-close-trip").click();
  await expect(page.getByTestId("zap-trip-name")).not.toContainText(/Closed/);
});
