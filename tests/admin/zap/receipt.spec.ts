import path from "node:path";
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

// 1x1 red PNG — tiny, valid, and enough for the <input type="file"> and
// storage upload. The parse-receipt call is intercepted below, so the
// actual image bytes are never sent to Anthropic.
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNg+P//PwAF/gL+Sv9J4wAAAABJRU5ErkJggg==",
  "base64",
);

test("upload a receipt: parse-receipt mock pre-fills the form, save, balance shown", async ({ page, service }) => {
  await signInAs(page, service, "alice@example.com");

  // Mock the Edge Function to return a deterministic parse.
  await page.route("**/functions/v1/parse-receipt", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        total_cents: 3000,
        date: "2026-04-15",
        label: "Test Taqueria",
        items: [],
      }),
    });
  });

  // Create a trip with Alice + Bob.
  await page.goto("http://localhost:5173/admin/apps/zap");
  await page.getByTestId("zap-new-trip-button").click();
  await page.getByTestId("zap-new-trip-name").fill("Receipt test");
  await page.getByTestId("zap-new-trip-submit").click();
  await page.locator('[data-testid^="zap-trip-card-"]').first().click();
  await page.getByTestId("zap-add-member-input").fill("bob@example.com");
  await page.getByTestId("zap-add-member-submit").click();
  await expect(page.getByTestId("zap-member-bob@example.com")).toBeVisible();

  // Open the new-receipt flow.
  await page.getByTestId("zap-receipt-fab").click();
  await page.waitForSelector('[data-testid="zap-receipt-file"]');

  // Upload the PNG.
  await page.getByTestId("zap-receipt-file").setInputFiles({
    name: "receipt.png",
    mimeType: "image/png",
    buffer: TINY_PNG,
  });

  // Form appears pre-filled from the mocked parse.
  await expect(page.getByTestId("zap-receipt-label")).toHaveValue("Test Taqueria");
  await expect(page.getByTestId("zap-receipt-total")).toHaveValue("30.00");

  // Save — both members are on the receipt by default, Alice is the payer.
  await page.getByTestId("zap-receipt-submit").click();

  // Back on the trip detail — balances reflect the $30 flat split ($15/each).
  await page.waitForSelector('[data-testid="zap-balances"]');
  await expect(page.getByTestId("zap-balance-alice@example.com")).toContainText("+$15.00");
  await expect(page.getByTestId("zap-balance-bob@example.com")).toContainText("-$15.00");
});

test("parse failure falls back to manual form", async ({ page, service }) => {
  await signInAs(page, service, "alice@example.com");

  await page.route("**/functions/v1/parse-receipt", (route) => {
    route.fulfill({
      status: 502,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, error: "anthropic unreachable" }),
    });
  });

  await page.goto("http://localhost:5173/admin/apps/zap");
  await page.getByTestId("zap-new-trip-button").click();
  await page.getByTestId("zap-new-trip-name").fill("Manual fallback");
  await page.getByTestId("zap-new-trip-submit").click();
  await page.locator('[data-testid^="zap-trip-card-"]').first().click();
  await page.getByTestId("zap-receipt-fab").click();

  await page.getByTestId("zap-receipt-file").setInputFiles({
    name: "receipt.png",
    mimeType: "image/png",
    buffer: TINY_PNG,
  });

  // Form still appears so user can fill in manually.
  await expect(page.getByTestId("zap-receipt-form")).toBeVisible();
  await expect(page.getByTestId("zap-receipt-total")).toHaveValue("0.00");
});
