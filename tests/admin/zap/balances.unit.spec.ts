import { test, expect } from "@playwright/test";
import {
  computeBalances,
  suggestSettlements,
  type TripLedger,
} from "../../../src/routes/admin/apps/zap/balances";

test("empty ledger yields zero balances per member", () => {
  const ledger: TripLedger = { members: ["a@x.com", "b@x.com"], receipts: [], settlements: [] };
  const bal = computeBalances(ledger);
  expect(bal).toEqual({ "a@x.com": 0, "b@x.com": 0 });
});

test("flat split, payer is member: even case", () => {
  const ledger: TripLedger = {
    members: ["a@x.com", "b@x.com"],
    receipts: [
      {
        payer: "a@x.com",
        total_cents: 2000,
        split_mode: "flat",
        members_on_receipt: ["a@x.com", "b@x.com"],
      },
    ],
    settlements: [],
  };
  const bal = computeBalances(ledger);
  expect(bal["a@x.com"]).toBe(1000);
  expect(bal["b@x.com"]).toBe(-1000);
});

test("flat split, payer NOT on receipt", () => {
  // Someone paid but isn't consuming — they get fully reimbursed.
  const ledger: TripLedger = {
    members: ["a@x.com", "b@x.com", "c@x.com"],
    receipts: [
      {
        payer: "a@x.com",
        total_cents: 3000,
        split_mode: "flat",
        members_on_receipt: ["b@x.com", "c@x.com"],
      },
    ],
    settlements: [],
  };
  const bal = computeBalances(ledger);
  expect(bal["a@x.com"]).toBe(3000);
  expect(bal["b@x.com"]).toBe(-1500);
  expect(bal["c@x.com"]).toBe(-1500);
});

test("flat split with penny rounding: $10.00 split 3 ways is deterministic", () => {
  const ledger: TripLedger = {
    members: ["aaa@x.com", "bbb@x.com", "ccc@x.com"],
    receipts: [
      {
        payer: "aaa@x.com",
        total_cents: 1000,
        split_mode: "flat",
        members_on_receipt: ["aaa@x.com", "bbb@x.com", "ccc@x.com"],
      },
    ],
    settlements: [],
  };
  const bal = computeBalances(ledger);
  // 1000 / 3 = 333 remainder 1. Remainder goes to the email sorting first (aaa).
  // Payer aaa gets +1000 credit, owes 334 → net +666.
  expect(bal["aaa@x.com"]).toBe(1000 - 334);
  expect(bal["bbb@x.com"]).toBe(-333);
  expect(bal["ccc@x.com"]).toBe(-333);
  // Sum must equal zero.
  expect(Object.values(bal).reduce((a, b) => a + b, 0)).toBe(0);
});

test("itemized split with proportional remainder", () => {
  // $20 item for A only, $10 item for A+B, plus $3 tax remainder split across everyone.
  const ledger: TripLedger = {
    members: ["a@x.com", "b@x.com", "c@x.com"],
    receipts: [
      {
        payer: "a@x.com",
        total_cents: 3300,
        split_mode: "itemized",
        members_on_receipt: ["a@x.com", "b@x.com", "c@x.com"],
        items: [
          { amount_cents: 2000, members: ["a@x.com"] },
          { amount_cents: 1000, members: ["a@x.com", "b@x.com"] },
        ],
      },
    ],
    settlements: [],
  };
  // Charges: a = 2000 + 500 + 100 (remainder) = 2600. b = 500 + 100 = 600. c = 100.
  // Credit a = 3300. Net: a = 700, b = -600, c = -100.
  const bal = computeBalances(ledger);
  expect(bal["a@x.com"]).toBe(3300 - 2600);
  expect(bal["b@x.com"]).toBe(-600);
  expect(bal["c@x.com"]).toBe(-100);
  expect(Object.values(bal).reduce((a, b) => a + b, 0)).toBe(0);
});

test("settlements reduce outstanding balances", () => {
  const ledger: TripLedger = {
    members: ["a@x.com", "b@x.com"],
    receipts: [
      {
        payer: "a@x.com",
        total_cents: 2000,
        split_mode: "flat",
        members_on_receipt: ["a@x.com", "b@x.com"],
      },
    ],
    settlements: [{ from: "b@x.com", to: "a@x.com", amount_cents: 600 }],
  };
  const bal = computeBalances(ledger);
  expect(bal["a@x.com"]).toBe(1000 - 600);
  expect(bal["b@x.com"]).toBe(-1000 + 600);
});

test("suggestSettlements: zero balances produce no transfers", () => {
  expect(suggestSettlements({ "a@x.com": 0, "b@x.com": 0 })).toEqual([]);
});

test("suggestSettlements: minimal transfer count for 3 users", () => {
  // Alice is owed 1500, Bob owes 1000, Carol owes 500.
  // Optimal: Bob→Alice 1000, Carol→Alice 500 (2 transfers).
  const balances = { "alice@x.com": 1500, "bob@x.com": -1000, "carol@x.com": -500 };
  const transfers = suggestSettlements(balances);
  expect(transfers).toHaveLength(2);
  // Net transferred to each debtor/creditor reconciles:
  const net: Record<string, number> = {};
  for (const t of transfers) {
    net[t.from] = (net[t.from] ?? 0) - t.amount_cents;
    net[t.to]   = (net[t.to]   ?? 0) + t.amount_cents;
  }
  expect(net["alice@x.com"]).toBe(1500);
  expect(net["bob@x.com"]).toBe(-1000);
  expect(net["carol@x.com"]).toBe(-500);
});

test("suggestSettlements: minimizes transfers by matching largest first", () => {
  // A owes 100, B owes 100, C is owed 150, D is owed 50.
  // Greedy pairs: A→C 100, B→C 50, B→D 50. (3 transfers — bound is n-1 = 3.)
  const balances = { a: -100, b: -100, c: 150, d: 50 };
  const transfers = suggestSettlements(balances);
  expect(transfers.length).toBeLessThanOrEqual(3);
  const net: Record<string, number> = {};
  for (const t of transfers) {
    net[t.from] = (net[t.from] ?? 0) - t.amount_cents;
    net[t.to]   = (net[t.to]   ?? 0) + t.amount_cents;
  }
  expect(net.a).toBe(-100);
  expect(net.b).toBe(-100);
  expect(net.c).toBe(150);
  expect(net.d).toBe(50);
});
