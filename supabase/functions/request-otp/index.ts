// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST")    return json({ ok: false, error: "method not allowed" }, 405);

  let body: any;
  try { body = await req.json(); } catch { return json({ ok: false, error: "invalid json" }, 400); }

  const rawEmail = typeof body?.email === "string" ? body.email.trim().toLowerCase() : null;
  if (!rawEmail)              return json({ ok: false, error: "missing email" }, 400);
  if (!EMAIL_RE.test(rawEmail)) return json({ ok: false, error: "invalid email" }, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data: row } = await supabase
    .from("allowed_emails")
    .select("email, enabled")
    .eq("email", rawEmail)
    .maybeSingle();

  if (!row || !row.enabled) {
    await supabase.from("events").insert({
      email: null,
      app_slug: null,
      event_name: "allowlist_blocked",
      payload: { attempted_email: rawEmail },
    });
    return json({ ok: true });
  }

  // Trigger OTP send. shouldCreateUser:true is required because Supabase auth.users
  // is independent of our allowed_emails table — first-time sign-in creates the auth user.
  await supabase.auth.signInWithOtp({
    email: rawEmail,
    options: { shouldCreateUser: true },
  });

  return json({ ok: true });
});
