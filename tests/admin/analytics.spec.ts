import { test, expect } from "../fixtures/supabase";

test.beforeAll(async ({ resetDb, service }) => {
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

test("analytics summary shows totals from seed", async ({ page, service }) => {
  await signInDirect(page, service, "admin@example.com");
  await page.goto("http://localhost:5173/admin/apps/analytics");
  await expect(page.getByTestId("analytics-total-events")).toContainText(/\d+/);
  const total = await page.getByTestId("analytics-total-events").textContent();
  expect(parseInt(total ?? "0", 10)).toBeGreaterThanOrEqual(3);
  const distinctUsers = await page.getByTestId("analytics-distinct-users").textContent();
  expect(parseInt(distinctUsers ?? "0", 10)).toBeGreaterThanOrEqual(2);
});

test("filtering by event name narrows the totals", async ({ page, service }) => {
  await signInDirect(page, service, "admin@example.com");
  await page.goto("http://localhost:5173/admin/apps/analytics");
  await expect(page.getByTestId("analytics-total-events")).toContainText(/\d+/);
  const before = parseInt((await page.getByTestId("analytics-total-events").textContent()) ?? "0", 10);
  await page.getByTestId("analytics-filter-event").fill("app_opened");
  await page.getByTestId("analytics-filter-apply").click();
  await expect(page.getByTestId("analytics-total-events")).toContainText(/\d+/);
  await page.waitForTimeout(200);
  const after = parseInt((await page.getByTestId("analytics-total-events").textContent()) ?? "0", 10);
  expect(after).toBeLessThan(before);
  expect(after).toBeGreaterThanOrEqual(2);
});

test("event table lists rows and expands payload on click", async ({ page, service }) => {
  await signInDirect(page, service, "admin@example.com");
  await page.goto("http://localhost:5173/admin/apps/analytics");
  await expect(page.getByTestId("analytics-event-row").first()).toBeVisible();
  const expandBtn = page.getByTestId("analytics-expand-payload").first();
  await expect(expandBtn).toBeVisible();
  await expandBtn.click();
  await expect(page.getByTestId("analytics-payload-json").first()).toBeVisible();
});

test("sparkline renders an svg with bars", async ({ page, service }) => {
  await signInDirect(page, service, "admin@example.com");
  await page.goto("http://localhost:5173/admin/apps/analytics");
  await expect(page.getByTestId("analytics-sparkline")).toBeVisible();
  const bars = await page.getByTestId("analytics-sparkline").locator("rect").count();
  expect(bars).toBeGreaterThan(0);
});

// Pagination test last — it inserts 60 events which accumulate for subsequent tests.
test("pagination shows next page", async ({ page, service }) => {
  const big = Array.from({ length: 60 }, (_, i) => ({
    email: "admin@example.com",
    app_slug: "users",
    event_name: "bulk",
    payload: { i },
  }));
  await service.from("events").insert(big);

  await signInDirect(page, service, "admin@example.com");
  await page.goto("http://localhost:5173/admin/apps/analytics");
  await expect(page.getByTestId("analytics-pagination-info")).toContainText("Page 1");
  await page.getByTestId("analytics-pagination-next").click();
  await expect(page.getByTestId("analytics-pagination-info")).toContainText("Page 2");
});
