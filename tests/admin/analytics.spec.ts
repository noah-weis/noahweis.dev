import { test, expect } from "../fixtures/supabase";

test.beforeEach(async ({ resetDb, service }) => {
  test.setTimeout(120_000);
  resetDb();
  await service.from("allowed_emails").insert([
    { email: "admin@example.com", is_admin: true,  enabled: true },
    { email: "user@example.com",  is_admin: false, enabled: true },
  ]);
  await service.from("events").insert([
    { email: "admin@example.com", app_slug: "users",     event_name: "app_opened", payload: { ctx: "dashboard" } },
    { email: "admin@example.com", app_slug: "analytics", event_name: "app_opened", payload: {} },
    { email: "user@example.com",  app_slug: null,        event_name: "signed_in",  payload: {} },
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

test("analytics summary shows totals from seed", async ({ page, service }) => {
  await signInAsAdmin(page, service);
  await page.goto("http://localhost:5173/admin/apps/analytics");
  await expect(page.getByTestId("analytics-total-events")).toContainText(/\d+/);
  const total = await page.getByTestId("analytics-total-events").textContent();
  expect(parseInt(total ?? "0", 10)).toBeGreaterThanOrEqual(4);
  const distinctUsers = await page.getByTestId("analytics-distinct-users").textContent();
  expect(parseInt(distinctUsers ?? "0", 10)).toBeGreaterThanOrEqual(2);
});

test("filtering by event name narrows the totals", async ({ page, service }) => {
  await signInAsAdmin(page, service);
  await page.goto("http://localhost:5173/admin/apps/analytics");
  // Wait for loading to finish (element shows a number, not "…").
  await expect(page.getByTestId("analytics-total-events")).toContainText(/\d+/);
  const before = parseInt((await page.getByTestId("analytics-total-events").textContent()) ?? "0", 10);
  await page.getByTestId("analytics-filter-event").fill("app_opened");
  await page.getByTestId("analytics-filter-apply").click();
  // Wait for loading to finish after applying filter.
  await expect(page.getByTestId("analytics-total-events")).toContainText(/\d+/);
  await page.waitForTimeout(200);
  const after = parseInt((await page.getByTestId("analytics-total-events").textContent()) ?? "0", 10);
  expect(after).toBeLessThan(before);
  expect(after).toBeGreaterThanOrEqual(2);
});

test("event table lists rows and expands payload on click", async ({ page, service }) => {
  await signInAsAdmin(page, service);
  await page.goto("http://localhost:5173/admin/apps/analytics");
  // Wait for at least one row to appear.
  await expect(page.getByTestId("analytics-event-row").first()).toBeVisible();
  // Find the first expand button regardless of row order (seed has one non-empty payload).
  const expandBtn = page.getByTestId("analytics-expand-payload").first();
  await expect(expandBtn).toBeVisible();
  await expandBtn.click();
  await expect(page.getByTestId("analytics-payload-json").first()).toBeVisible();
});

test("sparkline renders an svg with bars", async ({ page, service }) => {
  await signInAsAdmin(page, service);
  await page.goto("http://localhost:5173/admin/apps/analytics");
  await expect(page.getByTestId("analytics-sparkline")).toBeVisible();
  const bars = await page.getByTestId("analytics-sparkline").locator("rect").count();
  expect(bars).toBeGreaterThan(0);
});

test("pagination shows next page", async ({ page, service }) => {
  // Seed 60 events to force pagination at 50/page.
  const big = Array.from({ length: 60 }, (_, i) => ({
    email: "admin@example.com",
    app_slug: "users",
    event_name: "bulk",
    payload: { i },
  }));
  await service.from("events").insert(big);

  await signInAsAdmin(page, service);
  await page.goto("http://localhost:5173/admin/apps/analytics");
  await expect(page.getByTestId("analytics-pagination-info")).toContainText("Page 1");
  await page.getByTestId("analytics-pagination-next").click();
  await expect(page.getByTestId("analytics-pagination-info")).toContainText("Page 2");
});
