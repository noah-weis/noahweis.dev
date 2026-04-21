import { test as base, expect, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";

const URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? "";

if (!SERVICE_KEY || !ANON_KEY) {
  throw new Error(
    "Set SUPABASE_SERVICE_ROLE_KEY and SUPABASE_ANON_KEY env vars before running tests. " +
    "Both are printed by `supabase start`.",
  );
}

// Sign a user in via the dev-only /__test/auth-helpers harness, which calls
// verifyOtp directly. Navigating to the magic-link action_link doesn't work
// because src/lib/supabase.ts sets `detectSessionInUrl: false`.
export async function signInAs(page: Page, service: SupabaseClient, email: string): Promise<void> {
  const { data: link } = await service.auth.admin.generateLink({ type: "magiclink", email });
  const otp = link!.properties.email_otp!;
  await page.goto("http://localhost:5173/__test/auth-helpers");
  await page.getByTestId("email-input").fill(email);
  await page.getByTestId("otp-input").fill(otp);
  await page.getByTestId("sign-in").click();
  await page.waitForFunction(
    (expected) => document.querySelector('[data-testid="session-state"]')?.textContent === expected,
    email,
  );
  await page.goto("http://localhost:5173/admin/dashboard");
  await page.waitForSelector('[data-testid="dashboard-root"]', { timeout: 10_000 });
}

export type SupaFixtures = {
  service: SupabaseClient;
  anon: SupabaseClient;
  resetDb: () => void;
};

export const test = base.extend<SupaFixtures>({
  service: async ({}, use) => {
    await use(createClient(URL, SERVICE_KEY, { auth: { persistSession: false } }));
  },
  anon: async ({}, use) => {
    await use(createClient(URL, ANON_KEY, { auth: { persistSession: false } }));
  },
  resetDb: async ({}, use) => {
    use(() => {
      try {
        execSync("supabase db reset --no-seed", { stdio: ["ignore", "inherit", "pipe"] });
      } catch (err: unknown) {
        const stderr = (err as { stderr?: Buffer }).stderr?.toString() ?? "";
        // Known transient Docker errors that don't indicate a migration failure:
        //   "502" — storage health-check (Windows Docker Desktop, Supabase CLI v2.90)
        //   "error running container" — container restart race (Windows Docker Desktop)
        //   "already in progress" — concurrent reset collision (Linux CI, parallel workers)
        //   "unexpected EOF" — DB socket closed mid-reset (Linux CI, parallel workers)
        //   "context deadline exceeded" — Storage service slow to come back up
        //     after db reset (migrations already applied successfully)
        if (
          stderr.includes("502") ||
          stderr.includes("error running container") ||
          stderr.includes("already in progress") ||
          stderr.includes("unexpected EOF") ||
          stderr.includes("context deadline exceeded")
        ) {
          console.warn("[resetDb] Ignoring known Docker transient error:", stderr.trim());
          return;
        }
        throw err; // Real failure — let Playwright abort the suite.
      }
    });
  },
});

export { expect };
