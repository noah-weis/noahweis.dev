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

async function signIn(page: any, service: any, email: string) {
  const { data: link } = await service.auth.admin.generateLink({ type: "magiclink", email });
  const otp = link!.properties.email_otp!;
  await page.route("**/functions/v1/request-otp", (route: any) =>
    route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) })
  );
  await page.goto("http://localhost:5173/admin");
  await page.getByTestId("login-email-input").fill(email);
  await page.getByTestId("login-send-code").click();
  await page.getByTestId("login-code-input").fill(otp);
  await page.getByTestId("login-verify").click();
  await page.waitForURL("**/admin/dashboard");
}

test("admin sees both built-in apps as cards", async ({ page, service }) => {
  await signIn(page, service, "admin@example.com");
  await expect(page.getByTestId("app-card-users")).toBeVisible();
  await expect(page.getByTestId("app-card-analytics")).toBeVisible();
});

test("non-admin with no permissions sees no cards and an empty state message", async ({ page, service }) => {
  await signIn(page, service, "user@example.com");
  await expect(page.getByTestId("dashboard-empty")).toBeVisible();
  await expect(page.getByTestId("app-card-users")).not.toBeVisible();
  await expect(page.getByTestId("app-card-analytics")).not.toBeVisible();
});
