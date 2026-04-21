// Pure balance + settlement math for ZAP. Integer cents only.
//
// All inputs and outputs use integer cents so we can never accumulate
// floating-point drift. Penny remainders (when a dollar amount doesn't divide
// evenly among N people) are assigned deterministically to the members whose
// emails sort first — this keeps `computeBalances` a pure function of its
// input regardless of iteration order elsewhere.

export type LedgerItem = {
  amount_cents: number;
  members: string[]; // emails on this specific item
};

export type LedgerReceipt = {
  payer: string;
  total_cents: number;
  split_mode: "flat" | "itemized";
  members_on_receipt: string[];
  items?: LedgerItem[]; // present iff split_mode === "itemized"
};

export type LedgerSettlement = {
  from: string;
  to: string;
  amount_cents: number;
};

export type TripLedger = {
  members: string[];
  receipts: LedgerReceipt[];
  settlements: LedgerSettlement[];
};

// Split `amount_cents` evenly across `members`, with penny remainder assigned
// to the lexicographically earliest members. Returns a per-email charge map.
function splitEvenly(amount_cents: number, members: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  if (members.length === 0 || amount_cents === 0) return out;
  const sorted = [...members].sort();
  const base = Math.floor(amount_cents / sorted.length);
  const remainder = amount_cents - base * sorted.length;
  for (let i = 0; i < sorted.length; i++) {
    out[sorted[i]] = base + (i < remainder ? 1 : 0);
  }
  return out;
}

function addCharge(acc: Record<string, number>, email: string, cents: number) {
  acc[email] = (acc[email] ?? 0) + cents;
}

// Returns, for each user, their net balance in cents. Positive => others owe
// them (they're a creditor). Negative => they owe (debtor).
export function computeBalances(ledger: TripLedger): Record<string, number> {
  const bal: Record<string, number> = {};
  for (const m of ledger.members) bal[m] = 0;

  for (const r of ledger.receipts) {
    // Credit the payer for the full total.
    addCharge(bal, r.payer, r.total_cents);

    if (r.split_mode === "flat") {
      const charges = splitEvenly(r.total_cents, r.members_on_receipt);
      for (const [email, amt] of Object.entries(charges)) {
        addCharge(bal, email, -amt);
      }
    } else {
      const items = r.items ?? [];
      let itemSum = 0;
      for (const item of items) {
        itemSum += item.amount_cents;
        const charges = splitEvenly(item.amount_cents, item.members);
        for (const [email, amt] of Object.entries(charges)) {
          addCharge(bal, email, -amt);
        }
      }
      const remainder = r.total_cents - itemSum;
      if (remainder !== 0 && r.members_on_receipt.length > 0) {
        // Remainder may be negative if items overflow the total (shouldn't
        // happen given UI validation, but we handle it symmetrically).
        const charges = splitEvenly(Math.abs(remainder), r.members_on_receipt);
        const sign = remainder >= 0 ? -1 : 1;
        for (const [email, amt] of Object.entries(charges)) {
          addCharge(bal, email, sign * amt);
        }
      }
    }
  }

  for (const s of ledger.settlements) {
    // Paying settles debt: from_email's (negative) balance moves toward 0,
    // to_email's (positive) balance moves toward 0.
    addCharge(bal, s.from, s.amount_cents);
    addCharge(bal, s.to, -s.amount_cents);
  }

  return bal;
}

type Party = { email: string; cents: number };

// Greedy min-cashflow. Ties broken by email ascending. Returns a list of
// payments that together zero out all balances. For N distinct nonzero
// balances the output has at most N-1 entries.
export function suggestSettlements(balances: Record<string, number>): LedgerSettlement[] {
  const creditors: Party[] = [];
  const debtors: Party[] = [];
  for (const [email, cents] of Object.entries(balances)) {
    if (cents > 0) creditors.push({ email, cents });
    else if (cents < 0) debtors.push({ email, cents: -cents });
  }
  creditors.sort((a, b) => (b.cents - a.cents) || a.email.localeCompare(b.email));
  debtors.sort((a, b) => (b.cents - a.cents) || a.email.localeCompare(b.email));

  const out: LedgerSettlement[] = [];
  let i = 0;
  let j = 0;
  while (i < creditors.length && j < debtors.length) {
    const c = creditors[i];
    const d = debtors[j];
    const amount = Math.min(c.cents, d.cents);
    if (amount > 0) out.push({ from: d.email, to: c.email, amount_cents: amount });
    c.cents -= amount;
    d.cents -= amount;
    if (c.cents === 0) i++;
    if (d.cents === 0) j++;
  }
  return out;
}
