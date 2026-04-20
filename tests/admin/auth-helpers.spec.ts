import { test, expect } from "../fixtures/supabase";

test.beforeAll(async ({ resetDb, service }) => {
  test.setTimeout(120_000);
  await Promise.all([
    resetDb(),
    service.from("allowed_emails").insert({ email: "user@example.com", is_admin: false, enabled: true }),
  ]);
});

test("signed-out useSession returns null", async ({ page }) => {
  await page.goto("http://localhost:5173/__test/auth-helpers");
  await expect(page.getByTestId("session-state")).toHaveText("null");
});

test("after OTP sign-in, useSession returns a session and useCurrentUserRow returns the row", async ({ page, service }) => {
  const { data: link } = await service.auth.admin.generateLink({ type: "magiclink", email: "user@example.com" });
  const otp = link!.properties.email_otp;
  await page.goto("http://localhost:5173/__test/auth-helpers");
  await page.getByTestId("email-input").fill("user@example.com");
  await page.getByTestId("otp-input").fill(otp!);
  await page.getByTestId("sign-in").click();
  await expect(page.getByTestId("session-state")).toContainText("user@example.com");
  await expect(page.getByTestId("row-state")).toContainText('"is_admin":false');
});
