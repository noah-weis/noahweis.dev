import { test, expect } from "../fixtures/supabase";

test.beforeEach(async ({ resetDb, service }) => {
  test.setTimeout(120_000);
  await Promise.all([
    resetDb(),
    service.from("allowed_emails").insert([
      { email: "admin@example.com", is_admin: true,  enabled: true, label: "Me" },
      { email: "user@example.com",  is_admin: false, enabled: true, label: "Test User" },
    ]),
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

test("user manager lists existing rows", async ({ page, service }) => {
  await signInAsAdmin(page, service);
  await page.goto("http://localhost:5173/admin/apps/users");
  await expect(page.getByTestId("um-row-admin@example.com")).toBeVisible();
  await expect(page.getByTestId("um-row-user@example.com")).toBeVisible();
  await expect(page.getByTestId("um-row-admin@example.com").getByTestId("um-cell-label")).toHaveText("Me");
});

test("admin can add a new user", async ({ page, service }) => {
  await signInAsAdmin(page, service);
  await page.goto("http://localhost:5173/admin/apps/users");
  await page.getByTestId("um-add-email").fill("new@example.com");
  await page.getByTestId("um-add-label").fill("Newcomer");
  await page.getByTestId("um-add-submit").click();
  await expect(page.getByTestId("um-row-new@example.com")).toBeVisible();

  const { data } = await service.from("allowed_emails").select("*").eq("email", "new@example.com").maybeSingle();
  expect(data?.label).toBe("Newcomer");
  expect(data?.enabled).toBe(true);
  expect(data?.is_admin).toBe(false);
});

test("adding an existing email shows an error and doesn't duplicate", async ({ page, service }) => {
  await signInAsAdmin(page, service);
  await page.goto("http://localhost:5173/admin/apps/users");
  await page.getByTestId("um-add-email").fill("user@example.com");
  await page.getByTestId("um-add-submit").click();
  await expect(page.getByTestId("um-add-error")).toContainText("already");
});
