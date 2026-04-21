import { useEffect, useRef, useState } from "react";
import s from "./MenuLens.module.css";

type Item = {
  name_original: string;
  name_english: string;
  description: string | null;
  price: string | null;
  search_term: string;
};

type Section = {
  name_original: string;
  name_english: string;
  items: Item[];
};

type Menu = {
  restaurant_name: string | null;
  currency: string | null;
  source_language: string | null;
  sections: Section[];
};

type Status = "idle" | "reading" | "parsing" | "done" | "error";

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-menu`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

function photoUrl(searchTerm: string): string {
  const q = encodeURIComponent(`food,${searchTerm}`);
  return `https://loremflickr.com/400/400/${q}?lock=${hashString(searchTerm)}`;
}

// Stable per-term lock so images don't reshuffle every render.
function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h) % 10000;
}

function fileToBase64(file: File): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("failed to read file"));
    reader.onload = () => {
      const result = reader.result as string;
      // result looks like: data:image/jpeg;base64,XXXX
      const match = /^data:(.+);base64,(.*)$/.exec(result);
      if (!match) return reject(new Error("unexpected file reader output"));
      resolve({ mediaType: match[1], base64: match[2] });
    };
    reader.readAsDataURL(file);
  });
}

export function MenuLens() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  // Text renders immediately; images only start fetching once we've painted at least one frame.
  const [showImages, setShowImages] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!menu) { setShowImages(false); return; }
    // Two RAFs guarantees layout + paint happened before we commit to loading images.
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setShowImages(true));
    });
    return () => { cancelAnimationFrame(raf1); if (raf2) cancelAnimationFrame(raf2); };
  }, [menu]);

  useEffect(() => {
    // Revoke blob URL when replaced or unmounted to avoid memory leaks.
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  async function handleFile(file: File) {
    setError(null);
    setMenu(null);
    setStatus("reading");

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));

    let payload: { base64: string; mediaType: string };
    try {
      payload = await fileToBase64(file);
    } catch (e: any) {
      setStatus("error");
      setError(e?.message ?? "couldn't read image");
      return;
    }

    setStatus("parsing");
    try {
      const resp = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: ANON_KEY,
          Authorization: `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify({ image_base64: payload.base64, media_type: payload.mediaType }),
      });
      const data = await resp.json();
      if (!resp.ok || !data?.ok) {
        setStatus("error");
        setError(data?.error ?? `server error (${resp.status})`);
        return;
      }
      setMenu(data.menu as Menu);
      setStatus("done");
    } catch (e: any) {
      setStatus("error");
      setError(e?.message ?? "network error");
    }
  }

  function reset() {
    setMenu(null);
    setError(null);
    setStatus("idle");
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const busy = status === "reading" || status === "parsing";

  return (
    <div className={s.page} data-testid="menu-lens-root">
      <div className={s.container}>
        <h1 className={s.heading}>Menu Lens</h1>
        <p className={s.intro}>
          Snap a photo of a menu — in any language — and get a clean, translated,
          Grubhub-style rundown with a picture of every dish.
        </p>

        <div className={s.controls}>
          <input
            ref={fileInputRef}
            data-testid="menu-lens-file-input"
            className={s.hiddenInput}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <button
            data-testid="menu-lens-pick"
            className={s.buttonPrimary}
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
          >
            {busy ? "Working…" : menu ? "Scan another" : "Scan a menu"}
          </button>
          {menu && (
            <button
              data-testid="menu-lens-reset"
              className={s.button}
              onClick={reset}
              disabled={busy}
            >
              Clear
            </button>
          )}
          {previewUrl && !busy && (
            <img src={previewUrl} alt="menu preview" className={s.preview} />
          )}
        </div>

        {status === "reading" && <p className={s.status}>Reading image…</p>}
        {status === "parsing" && <p className={s.status} data-testid="menu-lens-parsing">Translating &amp; extracting items…</p>}
        {status === "error" && error && (
          <p className={s.error} data-testid="menu-lens-error">⚠ {error}</p>
        )}

        {menu && <MenuRender menu={menu} showImages={showImages} />}
      </div>
    </div>
  );
}

function MenuRender({ menu, showImages }: { menu: Menu; showImages: boolean }) {
  return (
    <div data-testid="menu-lens-results">
      {menu.restaurant_name && (
        <h2 className={s.restaurantName}>{menu.restaurant_name}</h2>
      )}
      {(menu.source_language || menu.currency) && (
        <p className={s.restaurantMeta}>
          {menu.source_language && <span>Source: {menu.source_language}</span>}
          {menu.source_language && menu.currency && <span> · </span>}
          {menu.currency && <span>Prices in {menu.currency}</span>}
        </p>
      )}
      {menu.sections.map((section, sIdx) => (
        <section key={sIdx} data-testid="menu-lens-section">
          <h3 className={s.subheading}>
            {section.name_english}
            {section.name_original && section.name_original !== section.name_english && (
              <span style={{ opacity: 0.6, fontWeight: 400, fontSize: "0.6em", marginLeft: "0.75rem" }}>
                {section.name_original}
              </span>
            )}
          </h3>
          <div className={s.items}>
            {section.items.map((item, iIdx) => (
              <ItemCard key={iIdx} item={item} showImage={showImages} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ItemCard({ item, showImage }: { item: Item; showImage: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const showTranslation =
    item.name_original && item.name_english && item.name_original !== item.name_english;

  return (
    <article className={s.item} data-testid="menu-lens-item">
      <div className={s.itemText}>
        <div className={s.itemName}>{item.name_original}</div>
        {showTranslation && <div className={s.itemTranslation}>{item.name_english}</div>}
        {item.description && <div className={s.itemDescription}>{item.description}</div>}
        {item.price && <div className={s.itemPrice}>{item.price}</div>}
      </div>
      <div className={s.itemImageFrame}>
        {showImage && !failed && (
          <img
            className={`${s.itemImage} ${loaded ? s.itemImageLoaded : ""}`}
            src={photoUrl(item.search_term || item.name_english)}
            alt={item.name_english}
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
          />
        )}
        {(!showImage || !loaded) && (
          <div className={s.imagePlaceholder}>
            {failed ? "no photo" : ""}
          </div>
        )}
      </div>
    </article>
  );
}
