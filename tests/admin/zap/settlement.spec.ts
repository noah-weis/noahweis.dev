import { test, expect, signInAs } from "../../fixtures/supabase";

test.beforeAll(async ({ resetDb, service }) => {
  test.setTimeout(120_000);
  await Promise.all([
    resetDb(),
    service.from("allowed_emails").insert([
      { email: "alice@example.com", is_admin: false, enabled: true },
      { email: "bob@example.com",   is_admin: false, enabled: true },
      { email: "carol@example.com", is_admin: false, enabled: true },
    ]),
  ]);
});

// Seed a trip with known receipts server-side so the test is deterministic
// and doesn't depend on the upload+parse flow.
async function seedTrip(service: any) {
  const { data: trip } = await service
    .from("zap_trips")
    .insert({ name: "Settlement test", created_by: "alice@example.com" })
    .select()
    .single();
  const tripId = trip.id;
  await service.from("zap_trip_members").insert([
    { trip_id: tripId, email: "bob@example.com" },
    { trip_id: tripId, email: "carol@example.com" },
  ]);
  // Receipt 1: Alice paid $30, split flat 3 ways → Bob -10, Carol -10, Alice +20.
  const { data: r1 } = await service.from("zap_receipts").insert({
    trip_id: tripId,
    uploaded_by: "alice@example.com",
    payer_email: "alice@example.com",
    storage_path: `${tripId}/seed1.placeholder`,
    label: "Dinner",
    receipt_date: "2026-04-10",
    total_cents: 3000,
    split_mode: "flat",
  }).select().single();
  await service.from("zap_receipt_members").insert([
    { receipt_id: r1.id, email: "alice@example.com" },
    { receipt_id: r1.id, email: "bob@example.com" },
    { receipt_id: r1.id, email: "carol@example.com" },
  ]);
  // Receipt 2: Bob paid $15, split flat 3 ways → Alice -5, Carol -5, Bob +10.
  const { data: r2 } = await service.from("zap_receipts").insert({
    trip_id: tripId,
    uploaded_by: "bob@example.com",
    payer_email: "bob@example.com",
    storage_path: `${tripId}/seed2.placeholder`,
    label: "Coffee",
    receipt_date: "2026-04-11",
    total_cents: 1500,
    split_mode: "flat",
  }).select().single();
  await service.from("zap_receipt_members").insert([
    { receipt_id: r2.id, email: "alice@example.com" },
    { receipt_id: r2.id, email: "bob@example.com" },
    { receipt_id: r2.id, email: "carol@example.com" },
  ]);
  // Net balances: alice +15, bob 0, carol -15. Single suggestion: carol→alice $15.
  return tripId;
}

test("settlement plan is minimal; marking one paid zeros out balances", async ({ page, service }) => {
  const tripId = await seedTrip(service);
  await signInAs(page, service, "alice@example.com");
  await page.goto(`http://localhost:5173/admin/apps/zap/${tripId}`);

  // Balances shown.
  await expect(page.getByTestId("zap-balance-alice@example.com")).toContainText("+$15.00");
  await expect(page.getByTestId("zap-balance-carol@example.com")).toContainText("-$15.00");
  await expect(page.getByTestId("zap-balance-bob@example.com")).toContainText("Settled");

  // Exactly one suggestion: carol → alice $15.
  const planRows = page.locator('[data-testid^="zap-plan-row-"]');
  await expect(planRows).toHaveCount(1);
  await expect(planRows.first()).toContainText("carol@example.com");
  await expect(planRows.first()).toContainText("$15.00");

  // Mark paid.
  await page.getByTestId("zap-mark-paid-0").click();

  await expect(page.getByTestId("zap-plan-empty")).toBeVisible();
  await expect(page.getByTestId("zap-balance-alice@example.com")).toContainText("Settled");
  await expect(page.getByTestId("zap-balance-carol@example.com")).toContainText("Settled");
  await expect(page.getByTestId("zap-history")).toBeVisible();
});
