// deno-lint-ignore-file no-explicit-any
// Calls Anthropic Claude Haiku vision to extract a structured menu from an image.
// Key stays server-side — the browser never sees it.

const MODEL = "claude-haiku-4-5-20251001";
const MAX_IMAGE_BYTES = 6 * 1024 * 1024; // ~6MB after base64 decode

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

const SYSTEM_PROMPT = `You extract structured menu data from a photo of a restaurant menu.

Return ONLY valid JSON matching this exact shape — no prose, no markdown fences:

{
  "restaurant_name": string | null,
  "currency": string | null,
  "source_language": string | null,
  "sections": [
    {
      "name_original": string,
      "name_english": string,
      "items": [
        {
          "name_original": string,
          "name_english": string,
          "description": string | null,
          "price": string | null,
          "search_term": string
        }
      ]
    }
  ]
}

Rules:
- name_original = the name exactly as written on the menu (preserve original script: 中文, 日本語, etc.)
- name_english = idiomatic English translation. If the original is already English, repeat it here.
- description = any subtitle or description text for that item (translated to English if needed); null if absent
- price = price as written, WITH its currency symbol if visible; null if no price
- search_term = 2-4 English words describing the dish visually (e.g. "kung pao chicken", "beef ramen noodles"). Used to fetch a stock photo — be descriptive, not cryptic.
- sections.name_english = translated section header (e.g. "Appetizers", "Noodles")
- Include EVERY item on the menu. Preserve order.
- If something is illegible, skip it rather than guess.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST")    return json({ ok: false, error: "method not allowed" }, 405);

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ ok: false, error: "server misconfigured: ANTHROPIC_API_KEY not set" }, 500);

  let body: any;
  try { body = await req.json(); } catch { return json({ ok: false, error: "invalid json" }, 400); }

  const imageB64 = typeof body?.image_base64 === "string" ? body.image_base64 : null;
  const mediaType = typeof body?.media_type === "string" ? body.media_type : "image/jpeg";
  if (!imageB64) return json({ ok: false, error: "missing image_base64" }, 400);

  // Base64 ≈ 4/3 of raw bytes. Quick size guard.
  if (imageB64.length * 3 / 4 > MAX_IMAGE_BYTES) {
    return json({ ok: false, error: "image too large; keep under ~6MB" }, 413);
  }

  const anthropicReq = {
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: imageB64 },
          },
          {
            type: "text",
            text: "Extract the menu as structured JSON per the schema. Return JSON only.",
          },
        ],
      },
    ],
  };

  let resp: Response;
  try {
    resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(anthropicReq),
    });
  } catch (e: any) {
    return json({ ok: false, error: `anthropic fetch failed: ${e?.message ?? String(e)}` }, 502);
  }

  if (!resp.ok) {
    const errText = await resp.text();
    return json({ ok: false, error: `anthropic ${resp.status}: ${errText}` }, 502);
  }

  const claudeBody = await resp.json();
  const textBlock = claudeBody?.content?.find((c: any) => c.type === "text");
  const raw: string = textBlock?.text ?? "";

  // Claude sometimes wraps in code fences despite the system prompt. Strip them.
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();

  let parsed: any;
  try { parsed = JSON.parse(cleaned); }
  catch {
    return json({ ok: false, error: "model returned non-JSON", raw: cleaned.slice(0, 500) }, 502);
  }

  return json({ ok: true, menu: parsed });
});
