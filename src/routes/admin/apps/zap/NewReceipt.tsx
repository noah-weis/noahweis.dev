import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useSession } from "../../../../lib/auth";
import {
  getTrip, parseReceipt, saveReceipt, uploadReceiptImage,
} from "./api";
import { ReceiptForm } from "./ReceiptForm";
import type { ParsedReceipt, Trip } from "./types";
import s from "./zap.module.css";

export function NewReceipt() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const { session } = useSession();
  const myEmail = session?.user.email ?? "";

  const [trip, setTrip] = useState<Trip | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [storagePath, setStoragePath] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedReceipt | null>(null);
  const [uploading, setUploading] = useState(false);
  const [parseNote, setParseNote] = useState<string | null>(null);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!tripId) return;
    getTrip(tripId).then(setTrip).catch((e) => {
      setLoadError(e instanceof Error ? e.message : "Couldn't load trip.");
      setTrip(null);
    });
  }, [tripId]);

  async function handleFile(file: File) {
    if (!tripId) return;
    setUploading(true);
    setParseNote(null);
    setThumbUrl(URL.createObjectURL(file));
    try {
      const path = await uploadReceiptImage(tripId, file);
      // Resolve `parsed` BEFORE we flip storagePath, because flipping
      // storagePath mounts the ReceiptForm and useState captures its initial
      // values from `parsed` exactly once — a later setParsed wouldn't update
      // the form fields.
      let p: ParsedReceipt;
      try {
        p = await parseReceipt(path);
      } catch {
        setParseNote("Couldn't read the receipt automatically. Fill in the fields manually.");
        p = { total_cents: 0, date: new Date().toISOString().slice(0, 10), label: "", items: [] };
      }
      setParsed(p);
      setStoragePath(path);
    } catch (e: unknown) {
      setParseNote(e instanceof Error ? e.message : "Couldn't upload image.");
    } finally {
      setUploading(false);
    }
  }

  if (trip === undefined) return <div className={s.root}>Loading…</div>;
  if (trip === null) {
    return (
      <div className={s.root}>
        <Link to="/admin/apps/zap" className={s.btnGhost}>← Back</Link>
        <div className={s.error}>{loadError ?? "Trip not found."}</div>
      </div>
    );
  }

  return (
    <div className={s.root} data-testid="zap-new-receipt">
      <Link to={`/admin/apps/zap/${trip.id}`} className={s.btnGhost}>← {trip.name}</Link>
      <h1 className={s.h1}>Add receipt</h1>

      {!storagePath ? (
        <div className={s.card}>
          <div className={s.muted} style={{ marginBottom: 12 }}>
            Snap or upload a photo of the receipt. Claude will read the total for you.
          </div>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            data-testid="zap-receipt-file"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          {uploading && <div className={s.muted} style={{ marginTop: 8 }}>Reading receipt…</div>}
          {parseNote && <div className={s.error}>{parseNote}</div>}
          <div style={{ marginTop: 12 }}>
            <button
              className={`${s.btn} ${s.btnSecondary}`}
              onClick={() => {
                // Allow manual-only path without an image.
                setStoragePath(`${trip.id}/manual-${crypto.randomUUID()}.placeholder`);
                setParsed({ total_cents: 0, date: new Date().toISOString().slice(0, 10), label: "", items: [] });
              }}
              data-testid="zap-skip-image"
            >
              Skip image and enter manually
            </button>
          </div>
        </div>
      ) : (
        <>
          {thumbUrl && <img src={thumbUrl} alt="" className={s.thumb} style={{ width: 120, height: 120, marginBottom: 12 }} />}
          {parseNote && <div className={s.error}>{parseNote}</div>}
          <ReceiptForm
            tripId={trip.id}
            tripMembers={trip.members}
            currentUserEmail={myEmail}
            parsed={parsed}
            initial={{ storage_path: storagePath }}
            submitLabel="Save receipt"
            onSubmit={async (payload) => {
              await saveReceipt(payload);
              navigate(`/admin/apps/zap/${trip.id}`);
            }}
            onCancel={() => navigate(`/admin/apps/zap/${trip.id}`)}
          />
        </>
      )}
    </div>
  );
}
