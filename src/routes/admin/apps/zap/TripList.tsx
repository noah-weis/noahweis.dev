import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useSession } from "../../../../lib/auth";
import { createTrip, listTrips } from "./api";
import type { TripSummary } from "./types";
import { balanceLabel } from "./format";
import s from "./zap.module.css";

export function TripList() {
  const { session } = useSession();
  const email = session?.user.email ?? "";
  const [trips, setTrips] = useState<TripSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  async function reload() {
    if (!email) return;
    setError(null);
    try {
      const rows = await listTrips(email);
      setTrips(rows);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Couldn't load trips.");
      setTrips([]);
    }
  }
  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [email]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      await createTrip(name);
      setNewName(""); setShowNew(false);
      await reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't create trip.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className={s.root} data-testid="zap-trip-list">
      <div className={s.row} style={{ justifyContent: "space-between", marginBottom: 16 }}>
        <h1 className={s.h1}>Trips</h1>
        <button
          className={s.btn}
          onClick={() => setShowNew(true)}
          data-testid="zap-new-trip-button"
        >
          + New trip
        </button>
      </div>

      {error && <div className={s.error} data-testid="zap-error">{error}</div>}

      {trips === null ? (
        <div className={s.muted}>Loading…</div>
      ) : trips.length === 0 ? (
        <div className={s.muted} data-testid="zap-empty">
          No trips yet. Create one to split your first receipt.
        </div>
      ) : (
        <div className={s.grid}>
          {trips.map((t) => {
            const cls =
              t.your_balance_cents > 0 ? s.balancePositive :
              t.your_balance_cents < 0 ? s.balanceNegative : s.balanceZero;
            return (
              <Link
                key={t.id}
                to={t.id}
                className={s.card}
                data-testid={`zap-trip-card-${t.id}`}
              >
                <div className={s.cardTitle}>
                  {t.name}
                  {t.closed_at && <span className={s.closed}>Closed</span>}
                </div>
                <div className={s.cardMeta}>
                  {t.member_count} member{t.member_count === 1 ? "" : "s"}
                </div>
                <div className={`${s.cardBalance} ${cls}`}>{balanceLabel(t.your_balance_cents)}</div>
              </Link>
            );
          })}
        </div>
      )}

      {showNew && (
        <div className={s.dialog} onClick={() => setShowNew(false)}>
          <form
            className={s.dialogBody}
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleCreate}
            data-testid="zap-new-trip-dialog"
          >
            <h2 className={s.h2} style={{ marginTop: 0 }}>New trip</h2>
            <input
              className={s.input}
              autoFocus
              placeholder="Trip name (e.g. Tahoe 2026)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              data-testid="zap-new-trip-name"
            />
            <div className={s.row} style={{ marginTop: 12, justifyContent: "flex-end" }}>
              <button
                type="button"
                className={s.btnSecondary + " " + s.btn}
                onClick={() => { setShowNew(false); setNewName(""); }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={s.btn}
                disabled={creating || !newName.trim()}
                data-testid="zap-new-trip-submit"
              >
                {creating ? "Creating…" : "Create"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
