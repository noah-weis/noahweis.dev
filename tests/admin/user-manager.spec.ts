import { test, expect, signInAs } from "../fixtures/supabase";

test.beforeAll(async ({ resetDb, service }) => {
  test.setTimeout(120_000);
  await Promise.all([
    resetDb(),
    service.from("allowed_emails").insert([
      { email: "admin@example.com", is_admin: true,  enabled: true, label: "Me" },
      { email: "user@example.com",  is_admin: false, enabled: true, label: "Test User" },
    ]),
  ]);
});

test("user manager lists existing rows", async ({ page, service }) => {
  await signInAs(page, service, "admin@example.com");
  await page.goto("http://localhost:5173/admin/apps/users");
  await expect(page.getByTestId("um-row-admin@example.com")).toBeVisible();
  await expect(page.getByTestId("um-row-user@example.com")).toBeVisible();
  await expect(page.getByTestId("um-row-admin@example.com").getByTestId("um-cell-label")).toHaveText("Me");
});

test("admin can add a new user", async ({ page, service }) => {
  await signInAs(page, service, "admin@example.com");
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
  await signInAs(page, service, "admin@example.com");
  await page.goto("http://localhost:5173/admin/apps/users");
  await page.getByTestId("um-add-email").fill("user@example.com");
  await page.getByTestId("um-add-submit").click();
  await expect(page.getByTestId("um-add-error")).toContainText("already");
});

test("admin can toggle enabled", async ({ page, service }) => {
  await signInAs(page, service, "admin@example.com");
  await page.goto("http://localhost:5173/admin/apps/users");
  await page.getByTestId("um-row-user@example.com").getByTestId("um-toggle-enabled").click();
  await page.waitForTimeout(300);
  const { data } = await service.from("allowed_emails").select("enabled").eq("email", "user@example.com").maybeSingle();
  expect(data?.enabled).toBe(false);
});

test("admin can edit a label inline", async ({ page, service }) => {
  await signInAs(page, service, "admin@example.com");
  await page.goto("http://localhost:5173/admin/apps/users");
  await page.getByTestId("um-row-user@example.com").getByTestId("um-edit-label").click();
  const input = page.getByTestId("um-row-user@example.com").getByTestId("um-edit-label-input");
  await input.fill("Renamed");
  await input.press("Enter");
  await expect(page.getByTestId("um-row-user@example.com").getByTestId("um-cell-label")).toHaveText("Renamed");
});

// Grant perm before remove — remove (below) cascades to delete permissions too.
test("admin can grant per-app permission to a non-admin", async ({ page, service }) => {
  await signInAs(page, service, "admin@example.com");
  await page.goto("http://localhost:5173/admin/apps/users");
  await page.getByTestId("um-row-user@example.com").getByTestId("um-perms-toggle").click();
  await page.getByTestId("um-perms-checkbox-users").check();
  await page.getByTestId("um-perms-save").click();
  await page.waitForTimeout(300);
  const { data } = await service.from("user_app_permissions").select("*").eq("email", "user@example.com");
  expect(data?.length).toBe(1);
  expect(data![0].app_slug).toBe("users");
});

// Remove last — it cascades and removes the permission granted above.
test("admin can remove a user (with confirm)", async ({ page, service }) => {
  await signInAs(page, service, "admin@example.com");
  await page.goto("http://localhost:5173/admin/apps/users");
  page.once("dialog", (d: any) => d.accept());
  await page.getByTestId("um-row-user@example.com").getByTestId("um-remove").click();
  await expect(page.getByTestId("um-row-user@example.com")).not.toBeVisible();
  const { data } = await service.from("allowed_emails").select("email").eq("email", "user@example.com").maybeSingle();
  expect(data).toBeNull();
});
