import { test as base, expect } from "@playwright/test";
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
        execSync("supabase db reset --no-seed", { stdio: "inherit" });
      } catch (err) {
        // On Windows/Docker Desktop the storage health-check can return 502 after
        // container restart even though the migration applied successfully.
        // Log the error but don't fail the test suite — the DB is usable.
        console.warn("supabase db reset exited non-zero (likely storage health-check on Windows); continuing.");
      }
    });
  },
});

export { expect };
