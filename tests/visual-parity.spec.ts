import { test, expect } from "@playwright/test";

const BASE = "http://localhost:5173";

test("home: scroll arrow appears after 2.5s and hides on scroll", async ({ page }) => {
  await page.goto(`${BASE}/`);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForLoadState("load");
  const arrow = page.locator("[data-testid='scroll-arrow']");
  await expect(arrow).toHaveCSS("opacity", "0");
  // Arrow sets visible=true at 2500ms, then CSS transition fades opacity 0 → 0.7 over 500ms.
  await expect
    .poll(
      () => arrow.evaluate((el) => parseFloat(getComputedStyle(el).opacity)),
      { timeout: 5000, intervals: [100, 200, 500] },
    )
    .toBeGreaterThan(0.5);
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(600);
  await expect(arrow).toHaveCSS("opacity", "0");
});

test("home: clicking email copies to clipboard", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(`${BASE}/`);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForLoadState("load");
  await page.locator("[data-testid='copy-email']").click();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toBe("njdweis@gmail.com");
});

test("cal: has noindex meta tag and iframe", async ({ page }) => {
  await page.goto(`${BASE}/cal`);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForLoadState("load");
  const meta = page.locator('meta[name="robots"]');
  await expect(meta).toHaveAttribute("content", /noindex/);
  await expect(page.locator("iframe")).toBeVisible();
});
