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

test("login: correct OTP signs in and redirects to dashboard", async ({ page, service }) => {
  // Generate the OTP server-side so we don't need an email inbox.
  // Stub the edge-function call so it doesn't overwrite the generated OTP.
  await page.route("**/functions/v1/request-otp", route => route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) }));
  const { data: link } = await service.auth.admin.generateLink({ type: "magiclink", email: "admin@example.com" });
  const otp = link!.properties.email_otp!;

  await page.goto("http://localhost:5173/admin");
  await page.getByTestId("login-email-input").fill("admin@example.com");
  await page.getByTestId("login-send-code").click();
  await page.getByTestId("login-code-input").fill(otp);
  await page.getByTestId("login-verify").click();
  await page.waitForURL("**/admin/dashboard");
  await expect(page.getByTestId("dashboard-root")).toBeVisible();
});

test("login: wrong OTP shows error and stays on code step", async ({ page }) => {
  await page.goto("http://localhost:5173/admin");
  await page.getByTestId("login-email-input").fill("admin@example.com");
  await page.getByTestId("login-send-code").click();
  await page.getByTestId("login-code-input").fill("000000");
  await page.getByTestId("login-verify").click();
  await expect(page.getByTestId("login-error")).toContainText("didn't work");
  await expect(page).toHaveURL(/\/admin$/);
});

test("login: signed-in user visiting /admin is bounced to /admin/dashboard", async ({ page, service }) => {
  // Stub the edge-function call so it doesn't overwrite the generated OTP.
  await page.route("**/functions/v1/request-otp", route => route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) }));
  const { data: link } = await service.auth.admin.generateLink({ type: "magiclink", email: "admin@example.com" });
  const otp = link!.properties.email_otp!;
  await page.goto("http://localhost:5173/admin");
  await page.getByTestId("login-email-input").fill("admin@example.com");
  await page.getByTestId("login-send-code").click();
  await page.getByTestId("login-code-input").fill(otp);
  await page.getByTestId("login-verify").click();
  await page.waitForURL("**/admin/dashboard");

  // Reload /admin — should be bounced back to /admin/dashboard.
  await page.goto("http://localhost:5173/admin");
  await page.waitForURL("**/admin/dashboard");
});

test("admin: signed-out user visiting /admin/dashboard is redirected to /admin", async ({ page }) => {
  await page.goto("http://localhost:5173/admin/dashboard");
  await page.waitForURL("**/admin");
  await expect(page.getByTestId("login-email-input")).toBeVisible();
});

test("admin: top bar shows current email and sign-out works", async ({ page, service }) => {
  await page.route("**/functions/v1/request-otp", (route) =>
    route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) })
  );
  const { data: link } = await service.auth.admin.generateLink({ type: "magiclink", email: "admin@example.com" });
  const otp = link!.properties.email_otp!;
  await page.goto("http://localhost:5173/admin");
  await page.getByTestId("login-email-input").fill("admin@example.com");
  await page.getByTestId("login-send-code").click();
  await page.getByTestId("login-code-input").fill(otp);
  await page.getByTestId("login-verify").click();
  await page.waitForURL("**/admin/dashboard");
  await expect(page.getByTestId("admin-topbar-email")).toHaveText("admin@example.com");

  await page.getByTestId("admin-topbar-signout").click();
  await page.waitForURL("**/admin");
});
