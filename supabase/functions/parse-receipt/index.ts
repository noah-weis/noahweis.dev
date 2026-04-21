// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

const SYSTEM_PROMPT = `You are a receipt-extraction service. You will be given a photograph of a paper receipt. Return ONLY a single JSON object, no prose, no markdown fences.

Schema:
{
  "total_cents":  <integer, grand total in cents>,
  "date":         <ISO date "YYYY-MM-DD" or null if illegible>,
  "label":        <short merchant / purpose label, 40 chars max, empty string if illegible>,
  "items":        [ { "description": <string>, "amount_cents": <integer cents> } ]
}

If the receipt is not itemized or items are illegible, return "items": [].
Do not guess tips or tax into items — only put things that are clearly line items.
Always emit valid JSON parseable by JSON.parse.`;

function validateAnthropicOutput(raw: unknown): {
  total_cents: number;
  date: string | null;
  label: string;
  items: { description: string; amount_cents: number }[];
} | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as any;
  if (typeof r.total_cents !== "number" || !Number.isFinite(r.total_cents) || r.total_cents < 0) return null;
  const label = typeof r.label === "string" ? r.label.slice(0, 80) : "";
  const date = (typeof r.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.date)) ? r.date : null;
  const items = Array.isArray(r.items)
    ? r.items
        .map((it: any) => {
          if (!it || typeof it !== "object") return null;
          const description = typeof it.description === "string" ? it.description.slice(0, 120) : "";
          const amount_cents = typeof it.amount_cents === "number" && Number.isFinite(it.amount_cents) && it.amount_cents >= 0
            ? Math.round(it.amount_cents)
            : null;
          if (amount_cents === null) return null;
          return { description, amount_cents };
        })
        .filter((it: any): it is { description: string; amount_cents: number } => it !== null)
    : [];
  return { total_cents: Math.round(r.total_cents), date, label, items };
}

// Exported for unit-testing. The handler function itself takes an injected
// `fetch` so Anthropic can be mocked.
export async function handle(
  req: Request,
  opts: { anthropicFetch?: typeof fetch } = {},
): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST")    return json({ ok: false, error: "method not allowed" }, 405);

  const auth = req.headers.get("authorization") ?? "";
  if (!auth.toLowerCase().startsWith("bearer ")) {
    return json({ ok: false, error: "missing bearer token" }, 401);
  }
  const jwt = auth.slice(7).trim();

  let body: any;
  try { body = await req.json(); } catch { return json({ ok: false, error: "invalid json" }, 400); }

  const storagePath = typeof body?.storagePath === "string" ? body.storagePath : null;
  if (!storagePath) return json({ ok: false, error: "missing storagePath" }, 400);

  const segments = storagePath.split("/");
  if (segments.length < 2) return json({ ok: false, error: "invalid storagePath" }, 400);
  const tripId = segments[0];
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tripId)) {
    return json({ ok: false, error: "invalid trip id" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Verify membership with the caller's JWT — RLS does the work.
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  });
  const { data: tripRow, error: tripErr } = await userClient
    .from("zap_trips").select("id").eq("id", tripId).maybeSingle();
  if (tripErr || !tripRow) return json({ ok: false, error: "not a trip member" }, 403);

  // Service-role client downloads the image.
  const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: blob, error: dlErr } = await service.storage
    .from("zap-receipts").download(storagePath);
  if (dlErr || !blob) return json({ ok: false, error: "image not found" }, 404);

  const buffer = new Uint8Array(await blob.arrayBuffer());
  const mediaType = blob.type && blob.type.startsWith("image/") ? blob.type : "image/jpeg";
  // Base64 encode in chunks to avoid call-stack issues on large images.
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < buffer.length; i += chunkSize) {
    binary += String.fromCharCode(...buffer.subarray(i, i + chunkSize));
  }
  const base64 = btoa(binary);

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ ok: false, error: "server misconfigured" }, 500);

  const doFetch = opts.anthropicFetch ?? fetch;
  let resp: Response;
  try {
    resp = await doFetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
              { type: "text", text: "Extract the receipt fields and return only JSON." },
            ],
          },
        ],
      }),
    });
  } catch (_err) {
    return json({ ok: false, error: "anthropic unreachable" }, 502);
  }

  if (!resp.ok) {
    return json({ ok: false, error: `anthropic ${resp.status}` }, 502);
  }

  let payload: any;
  try { payload = await resp.json(); } catch { return json({ ok: false, error: "bad anthropic response" }, 502); }
  const text = payload?.content?.[0]?.text;
  if (typeof text !== "string") return json({ ok: false, error: "empty anthropic response" }, 502);

  let parsed: any;
  try { parsed = JSON.parse(text); } catch { return json({ ok: false, error: "anthropic returned non-json" }, 502); }
  const validated = validateAnthropicOutput(parsed);
  if (!validated) return json({ ok: false, error: "anthropic returned unexpected shape" }, 502);

  return json({ ok: true, ...validated });
}

Deno.serve(handle);
