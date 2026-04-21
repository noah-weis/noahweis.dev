import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useSession } from "../../../../lib/auth";
import {
  addMember, closeTrip, deleteTrip, getTrip, markSettlementPaid,
  removeMember, renameTrip,
} from "./api";
import { computeBalances, suggestSettlements } from "./balances";
import { formatMoney } from "./format";
import type { Trip } from "./types";
import s from "./zap.module.css";

export function TripDetail() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const { session } = useSession();
  const myEmail = session?.user.email ?? "";

  const [trip, setTrip] = useState<Trip | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [newMember, setNewMember] = useState("");
  const [adding, setAdding] = useState(false);

  async function reload() {
    if (!tripId) return;
    setError(null);
    try {
      const t = await getTrip(tripId);
      setTrip(t);
      setNameDraft(t?.name ?? "");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Couldn't load trip.");
      setTrip(null);
    }
  }
  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tripId]);

  const { balances, plan } = useMemo(() => {
    if (!trip) return { balances: {} as Record<string, number>, plan: [] as ReturnType<typeof suggestSettlements> };
    const b = computeBalances({
      members: trip.members,
      receipts: trip.receipts.map((r) => ({
        payer: r.payer_email,
        total_cents: r.total_cents,
        split_mode: r.split_mode as "flat" | "itemized",
        members_on_receipt: r.members,
        items: r.split_mode === "itemized"
          ? r.items.map((i) => ({ amount_cents: i.amount_cents, members: i.members }))
          : undefined,
      })),
      settlements: trip.settlements.map((st) => ({
        from: st.from_email, to: st.to_email, amount_cents: st.amount_cents,
      })),
    });
    return { balances: b, plan: suggestSettlements(b) };
  }, [trip]);

  const isClosed = !!trip?.closed_at;

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    if (!trip) return;
    const email = newMember.trim().toLowerCase();
    if (!email) return;
    setAdding(true);
    setError(null);
    try {
      await addMember(trip.id, email);
      setNewMember("");
      await reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't add member.");
    } finally {
      setAdding(false);
    }
  }

  async function handleRemoveMember(email: string) {
    if (!trip) return;
    if (!confirm(`Remove ${email} from this trip?`)) return;
    try {
      await removeMember(trip.id, email);
      await reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't remove member.");
    }
  }

  async function handleRenameCommit() {
    if (!trip) return;
    const next = nameDraft.trim();
    if (!next || next === trip.name) { setRenaming(false); return; }
    try {
      await renameTrip(trip.id, next);
      setRenaming(false);
      await reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't rename trip.");
    }
  }

  async function handleClose() {
    if (!trip) return;
    try {
      await closeTrip(trip.id, !isClosed);
      await reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't change trip state.");
    }
  }

  async function handleDelete() {
    if (!trip) return;
    if (!confirm(`Delete trip "${trip.name}"? This cannot be undone.`)) return;
    try {
      await deleteTrip(trip.id);
      navigate("/admin/apps/zap");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't delete trip.");
    }
  }

  async function handleMarkPaid(p: { from: string; to: string; amount_cents: number }) {
    if (!trip) return;
    try {
      await markSettlementPaid({ trip_id: trip.id, ...p });
      await reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't mark paid.");
    }
  }

  if (trip === undefined) return <div className={s.root}>Loading…</div>;
  if (trip === null) {
    return (
      <div className={s.root}>
        <Link to="/admin/apps/zap" className={s.btnGhost}>← Trips</Link>
        <div className={s.error}>Trip not found or you don't have access.</div>
      </div>
    );
  }

  return (
    <div className={s.root} data-testid="zap-trip-detail">
      <Link to="/admin/apps/zap" className={s.btnGhost}>← Trips</Link>

      <div className={s.row} style={{ justifyContent: "space-between", marginTop: 8 }}>
        {renaming ? (
          <input
            className={s.input}
            autoFocus
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={handleRenameCommit}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); handleRenameCommit(); }
              if (e.key === "Escape") { setRenaming(false); setNameDraft(trip.name); }
            }}
            data-testid="zap-trip-name-input"
            style={{ maxWidth: 360 }}
          />
        ) : (
          <h1 className={s.h1} onClick={() => !isClosed && setRenaming(true)} data-testid="zap-trip-name">
            {trip.name}
            {isClosed && <span className={s.closed}>Closed</span>}
          </h1>
        )}
      </div>

      {error && <div className={s.error} data-testid="zap-trip-error">{error}</div>}

      <h2 className={s.h2}>Members</h2>
      <div className={s.rowWrap}>
        {trip.members.map((m) => (
          <span key={m} className={s.chip} data-testid={`zap-member-${m}`}>
            {m}
            {!isClosed && m !== trip.created_by && (
              <button className={s.chipX} onClick={() => handleRemoveMember(m)} aria-label={`Remove ${m}`}>×</button>
            )}
          </span>
        ))}
      </div>
      {!isClosed && (
        <form onSubmit={handleAddMember} className={s.row} style={{ marginTop: 8 }}>
          <input
            className={s.input}
            type="email"
            placeholder="email@example.com"
            value={newMember}
            onChange={(e) => setNewMember(e.target.value)}
            data-testid="zap-add-member-input"
          />
          <button type="submit" className={s.btn} disabled={adding} data-testid="zap-add-member-submit">
            {adding ? "Adding…" : "Add"}
          </button>
        </form>
      )}

      <h2 className={s.h2}>Balances</h2>
      <div className={s.stack} data-testid="zap-balances">
        {trip.members.map((m) => {
          const b = balances[m] ?? 0;
          const cls = b > 0 ? s.balancePositive : b < 0 ? s.balanceNegative : s.balanceZero;
          return (
            <div key={m} className={s.row} data-testid={`zap-balance-${m}`}>
              <span style={{ flex: 1 }}>{m === myEmail ? `${m} (you)` : m}</span>
              <span className={cls}>
                {b === 0 ? "Settled" : b > 0 ? `+${formatMoney(b)}` : formatMoney(b)}
              </span>
            </div>
          );
        })}
      </div>

      <h2 className={s.h2}>Settlement plan</h2>
      {plan.length === 0 ? (
        <div className={s.muted} data-testid="zap-plan-empty">Everything's settled. 🎉</div>
      ) : (
        <div data-testid="zap-plan">
          {plan.map((p, i) => (
            <div key={i} className={s.settlementRow} data-testid={`zap-plan-row-${i}`}>
              <span>
                <strong>{p.from === myEmail ? "You" : p.from}</strong> pays{" "}
                <strong>{p.to === myEmail ? "you" : p.to}</strong>{" "}
                <strong>{formatMoney(p.amount_cents)}</strong>
              </span>
              {!isClosed && (
                <button
                  className={`${s.btn} ${s.btnSecondary}`}
                  onClick={() => handleMarkPaid(p)}
                  data-testid={`zap-mark-paid-${i}`}
                >
                  Mark paid
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {trip.settlements.length > 0 && (
        <>
          <h2 className={s.h2}>Settlement history</h2>
          <div className={s.stack} data-testid="zap-history">
            {trip.settlements.map((st) => (
              <div key={st.id} className={s.row}>
                <span style={{ flex: 1 }}>
                  {st.from_email} → {st.to_email}: {formatMoney(st.amount_cents)}
                </span>
                <span className={s.muted} style={{ fontSize: 12 }}>
                  {new Date(st.paid_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <h2 className={s.h2}>Receipts</h2>
      {trip.receipts.length === 0 ? (
        <div className={s.muted}>No receipts yet.</div>
      ) : (
        trip.receipts.map((r) => (
          <Link
            key={r.id}
            to={`receipt/${r.id}`}
            className={s.receiptRow}
            data-testid={`zap-receipt-${r.id}`}
          >
            {r.image_signed_url && (
              <img src={r.image_signed_url} alt="" className={s.thumb} />
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{r.label || "Untitled receipt"}</div>
              <div className={s.muted} style={{ fontSize: 13 }}>
                {r.receipt_date} · paid by {r.payer_email === myEmail ? "you" : r.payer_email}
                {" · "}
                {r.members.length} {r.members.length === 1 ? "person" : "people"}
              </div>
            </div>
            <div style={{ fontWeight: 600 }}>{formatMoney(r.total_cents)}</div>
          </Link>
        ))
      )}

      <div className={s.row} style={{ marginTop: 32, gap: 12, flexWrap: "wrap" }}>
        <button className={`${s.btn} ${s.btnSecondary}`} onClick={handleClose} data-testid="zap-close-trip">
          {isClosed ? "Reopen trip" : "Close trip"}
        </button>
        <button className={`${s.btn} ${s.btnDanger}`} onClick={handleDelete} data-testid="zap-delete-trip">
          Delete trip
        </button>
      </div>

      {!isClosed && (
        <Link to="receipt/new" className={s.fab} aria-label="Add receipt" data-testid="zap-receipt-fab">+</Link>
      )}
    </div>
  );
}
