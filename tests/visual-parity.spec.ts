import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const LEGACY = "http://localhost:4173";
const NEW = "http://localhost:5173";

const routes = [
  { name: "home", legacy: "/index.html", next: "/" },
  { name: "cal", legacy: "/cal.html", next: "/cal" },
];

const artifactsDir = path.join(process.cwd(), "tests", "artifacts");

test.beforeAll(() => {
  fs.mkdirSync(artifactsDir, { recursive: true });
});

for (const route of routes) {
  test(`${route.name}: screenshots legacy + new`, async ({ page }, testInfo) => {
    const viewport = testInfo.project.name;

    await page.goto(`${LEGACY}${route.legacy}`);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForLoadState("load");
    await page.waitForTimeout(3500);
    const legacyShot = await page.screenshot({ fullPage: true });
    fs.writeFileSync(
      path.join(artifactsDir, `${route.name}-${viewport}-legacy.png`),
      legacyShot,
    );

    await page.goto(`${NEW}${route.next}`);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForLoadState("load");
    await page.waitForTimeout(3500);
    const newShot = await page.screenshot({ fullPage: true });
    fs.writeFileSync(
      path.join(artifactsDir, `${route.name}-${viewport}-new.png`),
      newShot,
    );

    expect(legacyShot.byteLength).toBeGreaterThan(1000);
    expect(newShot.byteLength).toBeGreaterThan(1000);
  });
}

test("home: scroll arrow appears after 2.5s and hides on scroll", async ({ page }) => {
  await page.goto(`${NEW}/`);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForLoadState("load");
  const arrow = page.locator("[data-testid='scroll-arrow']");
  await expect(arrow).toHaveCSS("opacity", "0");
  await page.waitForTimeout(2700);
  const opacity = await arrow.evaluate((el) => getComputedStyle(el).opacity);
  expect(parseFloat(opacity)).toBeGreaterThan(0.5);
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(600);
  await expect(arrow).toHaveCSS("opacity", "0");
});

test("home: clicking email copies to clipboard", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(`${NEW}/`);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForLoadState("load");
  await page.locator("[data-testid='copy-email']").click();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toBe("njdweis@gmail.com");
});

test("cal: has noindex meta tag and iframe", async ({ page }) => {
  await page.goto(`${NEW}/cal`);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForLoadState("load");
  const meta = page.locator('meta[name="robots"]');
  await expect(meta).toHaveAttribute("content", /noindex/);
  await expect(page.locator("iframe")).toBeVisible();
});
