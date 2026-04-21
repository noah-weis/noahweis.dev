import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useSession } from "../../../../lib/auth";
import { deleteReceipt, getTrip, updateReceipt } from "./api";
import { ReceiptForm } from "./ReceiptForm";
import type { NewReceiptPayload, Trip } from "./types";
import s from "./zap.module.css";

export function EditReceipt() {
  const { tripId, receiptId } = useParams<{ tripId: string; receiptId: string }>();
  const navigate = useNavigate();
  const { session } = useSession();
  const myEmail = session?.user.email ?? "";

  const [trip, setTrip] = useState<Trip | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tripId) return;
    getTrip(tripId).then(setTrip).catch((e) => {
      setError(e instanceof Error ? e.message : "Couldn't load trip.");
      setTrip(null);
    });
  }, [tripId]);

  if (trip === undefined) return <div className={s.root}>Loading…</div>;
  if (trip === null) {
    return (
      <div className={s.root}>
        <Link to="/admin/apps/zap" className={s.btnGhost}>← Back</Link>
        <div className={s.error}>{error ?? "Trip not found."}</div>
      </div>
    );
  }

  const receipt = trip.receipts.find((r) => r.id === receiptId);
  if (!receipt) {
    return (
      <div className={s.root}>
        <Link to={`/admin/apps/zap/${trip.id}`} className={s.btnGhost}>← {trip.name}</Link>
        <div className={s.error}>Receipt not found.</div>
      </div>
    );
  }

  const initial: Partial<NewReceiptPayload> & { storage_path: string } = {
    storage_path: receipt.storage_path,
    payer_email: receipt.payer_email,
    label: receipt.label,
    receipt_date: receipt.receipt_date,
    total_cents: receipt.total_cents,
    split_mode: receipt.split_mode as "flat" | "itemized",
    members: receipt.members,
    items: receipt.items.map((i) => ({
      description: i.description,
      amount_cents: i.amount_cents,
      members: i.members,
    })),
  };

  return (
    <div className={s.root} data-testid="zap-edit-receipt">
      <Link to={`/admin/apps/zap/${trip.id}`} className={s.btnGhost}>← {trip.name}</Link>
      <h1 className={s.h1}>Edit receipt</h1>

      {receipt.image_signed_url && (
        <img
          src={receipt.image_signed_url}
          alt=""
          className={s.thumb}
          style={{ width: 120, height: 120, marginBottom: 12 }}
        />
      )}

      <ReceiptForm
        tripId={trip.id}
        tripMembers={trip.members}
        currentUserEmail={myEmail}
        initial={initial}
        submitLabel="Save changes"
        onSubmit={async (payload) => {
          await updateReceipt(receipt.id, payload);
          navigate(`/admin/apps/zap/${trip.id}`);
        }}
        onDelete={async () => {
          await deleteReceipt(receipt.id);
          navigate(`/admin/apps/zap/${trip.id}`);
        }}
        onCancel={() => navigate(`/admin/apps/zap/${trip.id}`)}
      />
    </div>
  );
}
