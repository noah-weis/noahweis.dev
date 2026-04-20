import { test, expect } from "../fixtures/supabase";

test.beforeEach(async ({ resetDb, service }) => {
  test.setTimeout(120_000);
  await Promise.all([
    resetDb(),
    service.from("allowed_emails").insert([
      { email: "admin@example.com", is_admin: true,  enabled: true },
      { email: "user@example.com",  is_admin: false, enabled: true },
    ]),
  ]);
});

test("login: email step shows then advances to code step on submit", async ({ page }) => {
  await page.goto("http://localhost:5173/admin");
  await expect(page.getByTestId("login-email-input")).toBeVisible();
  await page.getByTestId("login-email-input").fill("admin@example.com");
  await page.getByTestId("login-send-code").click();
  await expect(page.getByTestId("login-code-input")).toBeVisible();
  await expect(page.getByTestId("login-status")).toContainText("admin@example.com");
});

test("login: invalid email shape shows inline error and stays on email step", async ({ page }) => {
  await page.goto("http://localhost:5173/admin");
  await page.getByTestId("login-email-input").fill("not-an-email");
  await page.getByTestId("login-send-code").click();
  await expect(page.getByTestId("login-error")).toContainText("valid email");
  await expect(page.getByTestId("login-code-input")).not.toBeVisible();
});
