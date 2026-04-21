import { useMemo, useState } from "react";
import type { NewReceiptPayload, ParsedReceipt } from "./types";
import { formatMoney } from "./format";
import s from "./zap.module.css";

type Props = {
  tripId: string;
  tripMembers: string[];
  currentUserEmail: string;
  initial?: Partial<NewReceiptPayload> & { storage_path: string };
  parsed?: ParsedReceipt | null; // optional initial pre-fill (new receipt only)
  submitLabel: string;
  onSubmit: (payload: NewReceiptPayload) => Promise<void>;
  onDelete?: () => Promise<void>;
  onCancel: () => void;
};

type ItemDraft = {
  description: string;
  amountInput: string;   // what the user types, e.g. "12.50"
  members: Set<string>;
};

function dollarsToCents(s: string): number | null {
  const trimmed = s.trim().replace(/[,$]/g, "");
  if (!trimmed) return 0;
  if (!/^-?\d+(\.\d{0,2})?$/.test(trimmed)) return null;
  const num = Number.parseFloat(trimmed);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.round(num * 100);
}

function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function ReceiptForm({
  tripId, tripMembers, currentUserEmail,
  initial, parsed, submitLabel, onSubmit, onDelete, onCancel,
}: Props) {
  const initialLabel = initial?.label ?? parsed?.label ?? "";
  const initialDate  = initial?.receipt_date ?? parsed?.date ?? new Date().toISOString().slice(0, 10);
  const initialTotal = initial?.total_cents ?? parsed?.total_cents ?? 0;
  const initialPayer = initial?.payer_email ?? currentUserEmail;
  const initialMode: "flat" | "itemized" = initial?.split_mode ?? "flat";
  const initialMembers = initial?.members ?? tripMembers;

  const [label, setLabel] = useState(initialLabel);
  const [date, setDate] = useState(initialDate);
  const [totalInput, setTotalInput] = useState(centsToDollars(initialTotal));
  const [payer, setPayer] = useState(initialPayer);
  const [splitMode, setSplitMode] = useState<"flat" | "itemized">(initialMode);
  const [members, setMembers] = useState<Set<string>>(new Set(initialMembers));
  const seedItems: ItemDraft[] =
    initial?.items?.map((it) => ({
      description: it.description,
      amountInput: centsToDollars(it.amount_cents),
      members: new Set(it.members.length > 0 ? it.members : tripMembers),
    })) ??
    parsed?.items.map((it) => ({
      description: it.description,
      amountInput: centsToDollars(it.amount_cents),
      members: new Set(tripMembers),
    })) ??
    [];
  const [items, setItems] = useState<ItemDraft[]>(seedItems);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalCents = dollarsToCents(totalInput);
  const itemsCents = useMemo(
    () => items.reduce((sum, i) => sum + (dollarsToCents(i.amountInput) ?? 0), 0),
    [items],
  );
  const remainder = (totalCents ?? 0) - itemsCents;

  function toggleMember(email: string) {
    setMembers((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email); else next.add(email);
      return next;
    });
  }

  function toggleItemMember(i: number, email: string) {
    setItems((prev) => {
      const next = prev.slice();
      const item = { ...next[i], members: new Set(next[i].members) };
      if (item.members.has(email)) item.members.delete(email); else item.members.add(email);
      next[i] = item;
      return next;
    });
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      { description: "", amountInput: "", members: new Set(tripMembers) },
    ]);
  }

  function removeItem(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateItem(i: number, patch: Partial<ItemDraft>) {
    setItems((prev) => {
      const next = prev.slice();
      next[i] = { ...next[i], ...patch };
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!label.trim() && !parsed && !initial) {
      setError("Give the receipt a label.");
      return;
    }
    if (totalCents === null || totalCents <= 0) {
      setError("Enter a valid total.");
      return;
    }
    if (members.size === 0) {
      setError("At least one member must be on the receipt.");
      return;
    }
    if (!tripMembers.includes(payer)) {
      setError("Payer must be a trip member.");
      return;
    }
    if (splitMode === "itemized") {
      for (const it of items) {
        if (dollarsToCents(it.amountInput) === null) {
          setError("Each item needs a valid amount.");
          return;
        }
        if (it.members.size === 0) {
          setError("Each item must have at least one member.");
          return;
        }
      }
      if (itemsCents > totalCents) {
        setError("Items add up to more than the total.");
        return;
      }
    }

    const payload: NewReceiptPayload = {
      trip_id: tripId,
      payer_email: payer,
      storage_path: initial?.storage_path ?? "",
      label: label.trim(),
      receipt_date: date,
      total_cents: totalCents,
      split_mode: splitMode,
      members: Array.from(members),
      items: splitMode === "itemized"
        ? items.map((it) => ({
            description: it.description.trim(),
            amount_cents: dollarsToCents(it.amountInput) ?? 0,
            members: Array.from(it.members),
          }))
        : [],
    };

    setSaving(true);
    try {
      await onSubmit(payload);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    if (!confirm("Delete this receipt?")) return;
    setDeleting(true);
    try { await onDelete(); } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't delete.");
    } finally { setDeleting(false); }
  }

  return (
    <form onSubmit={handleSubmit} className={s.stack} data-testid="zap-receipt-form">
      <div>
        <div className={s.muted} style={{ fontSize: 13, marginBottom: 4 }}>Label</div>
        <input
          className={s.input}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="What was this receipt for?"
          data-testid="zap-receipt-label"
        />
      </div>

      <div>
        <div className={s.muted} style={{ fontSize: 13, marginBottom: 4 }}>Date</div>
        <input
          className={s.input}
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          data-testid="zap-receipt-date"
        />
      </div>

      <div>
        <div className={s.muted} style={{ fontSize: 13, marginBottom: 4 }}>Total</div>
        <input
          className={s.input}
          type="text"
          inputMode="decimal"
          value={totalInput}
          onChange={(e) => setTotalInput(e.target.value)}
          placeholder="0.00"
          data-testid="zap-receipt-total"
        />
      </div>

      <div>
        <div className={s.muted} style={{ fontSize: 13, marginBottom: 4 }}>Paid by</div>
        <select
          className={s.select}
          value={payer}
          onChange={(e) => setPayer(e.target.value)}
          data-testid="zap-receipt-payer"
        >
          {tripMembers.map((m) => (
            <option key={m} value={m}>{m === currentUserEmail ? `${m} (you)` : m}</option>
          ))}
        </select>
      </div>

      <div>
        <div className={s.muted} style={{ fontSize: 13, marginBottom: 4 }}>Who's on this?</div>
        {tripMembers.map((m) => (
          <label key={m} className={s.checkRow} data-testid={`zap-member-check-${m}`}>
            <input
              type="checkbox"
              checked={members.has(m)}
              onChange={() => toggleMember(m)}
            />
            <span>{m === currentUserEmail ? `${m} (you)` : m}</span>
          </label>
        ))}
      </div>

      <label className={s.row}>
        <input
          type="checkbox"
          checked={splitMode === "itemized"}
          onChange={(e) => setSplitMode(e.target.checked ? "itemized" : "flat")}
          data-testid="zap-itemize-toggle"
        />
        <span>Itemize (assign items to specific members)</span>
      </label>

      {splitMode === "itemized" && (
        <div className={s.stack} data-testid="zap-items">
          {items.map((it, i) => (
            <div key={i} className={s.card} style={{ marginBottom: 0 }}>
              <div className={s.row}>
                <input
                  className={s.input}
                  placeholder="Item"
                  value={it.description}
                  onChange={(e) => updateItem(i, { description: e.target.value })}
                  data-testid={`zap-item-desc-${i}`}
                />
                <input
                  className={s.input}
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={it.amountInput}
                  onChange={(e) => updateItem(i, { amountInput: e.target.value })}
                  style={{ maxWidth: 110 }}
                  data-testid={`zap-item-amt-${i}`}
                />
                <button
                  type="button"
                  className={s.btnGhost}
                  onClick={() => removeItem(i)}
                  aria-label="Remove item"
                >×</button>
              </div>
              <div className={s.rowWrap} style={{ marginTop: 8 }}>
                {tripMembers.filter((m) => members.has(m)).map((m) => (
                  <label key={m} className={s.chip}>
                    <input
                      type="checkbox"
                      checked={it.members.has(m)}
                      onChange={() => toggleItemMember(i, m)}
                      data-testid={`zap-item-member-${i}-${m}`}
                    />
                    {m}
                  </label>
                ))}
              </div>
            </div>
          ))}
          <button type="button" className={`${s.btn} ${s.btnSecondary}`} onClick={addItem}>
            + Add item
          </button>
          <div className={s.muted} data-testid="zap-remainder">
            Items: {formatMoney(itemsCents)} · Remainder (tax/tip): {formatMoney(remainder)}
            {remainder < 0 && <span className={s.error}> (items exceed total)</span>}
          </div>
        </div>
      )}

      {error && <div className={s.error} data-testid="zap-form-error">{error}</div>}

      <div className={s.row} style={{ gap: 12, marginTop: 12 }}>
        <button type="submit" className={s.btn} disabled={saving} data-testid="zap-receipt-submit">
          {saving ? "Saving…" : submitLabel}
        </button>
        <button type="button" className={`${s.btn} ${s.btnSecondary}`} onClick={onCancel}>
          Cancel
        </button>
        {onDelete && (
          <button
            type="button"
            className={`${s.btn} ${s.btnDanger}`}
            disabled={deleting}
            onClick={handleDelete}
            data-testid="zap-receipt-delete"
            style={{ marginLeft: "auto" }}
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        )}
      </div>
    </form>
  );
}
