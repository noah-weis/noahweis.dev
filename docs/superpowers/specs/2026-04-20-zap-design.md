# ZAP — Design

**Date:** 2026-04-20
**Status:** Approved (fast-track; design + plan authored together, implementation immediate)
**Scope:** A trip-based reimbursement app for the noahweis.dev admin dashboard.

## Goal

Let a small group of friends track shared expenses on a trip, parse receipt
images via Claude Haiku vision, compute balances, and suggest a minimal
settlement plan. Settlements are recordable (mark-as-paid).

## Non-goals (v1)

- Multi-currency. USD only, stored in integer cents.
- Notifications (email, push).
- Recurring trips, templates, saved groups.
- Per-member weighted splits beyond "flat among selected" or "per-item".
- Hard delete of a trip after settlements exist. (Soft close only.)
- Any tip/tax automation beyond proportional remainder distribution.

## Architecture

```
Mobile browser
   |
   |-- Supabase Storage  (private bucket `zap-receipts/`)
   |     `-- signed URL via supabase-js
   |
   |-- Postgres          (RLS-protected trips, receipts, settlements)
   |
   `-- Edge Function: parse-receipt
         `-- reads image from Storage
         `-- calls Anthropic (claude-haiku-4-5) with image
         `-- returns { total_cents, date, label, items[] }
```

The Edge Function holds the only copy of the Anthropic API key as a Supabase
project secret. The browser never sees it.

## Access model

ZAP is available to every user with `allowed_emails.enabled = true`. No per-user
grant in `user_app_permissions` is required.

To model this cleanly, the app registry gains an `accessMode`:

```ts
export type AppDef = {
  slug: string;
  name: string;
  description: string;
  accessMode: "admin" | "allowlist" | "grant";
  component: ComponentType;
};
```

- `admin`     — only users with `is_admin = true`. (Existing User Manager, Analytics.)
- `allowlist` — any enabled allowlisted user. (ZAP.)
- `grant`     — requires a row in `user_app_permissions`. (No existing apps use this yet but it's preserved for the future.)

`canAccessApp` is updated to branch on `accessMode`. Existing apps keep their
behavior (their `adminOnly: true` migrates to `accessMode: "admin"`).

## Data model

All new tables are prefixed `zap_` to keep them visually separated from shared
infrastructure tables.

```sql
create extension if not exists "uuid-ossp";

create table zap_trips (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null check (length(name) between 1 and 80),
  created_by  text not null references allowed_emails(email),
  created_at  timestamptz not null default now(),
  closed_at   timestamptz
);

create table zap_trip_members (
  trip_id     uuid not null references zap_trips(id) on delete cascade,
  email       text not null references allowed_emails(email),
  joined_at   timestamptz not null default now(),
  primary key (trip_id, email)
);

create table zap_receipts (
  id            uuid primary key default uuid_generate_v4(),
  trip_id       uuid not null references zap_trips(id) on delete cascade,
  uploaded_by   text not null references allowed_emails(email),
  payer_email   text not null references allowed_emails(email),
  storage_path  text not null,          -- path in `zap-receipts` bucket
  label         text not null default '',
  receipt_date  date not null default current_date,
  total_cents   integer not null check (total_cents >= 0),
  split_mode    text not null check (split_mode in ('flat', 'itemized')),
  created_at    timestamptz not null default now()
);

-- For split_mode = 'flat': which trip members share the receipt total equally.
-- For split_mode = 'itemized': which trip members share the *remainder*
-- (total - sum(items)) equally, i.e. tax/tip/miscellaneous.
create table zap_receipt_members (
  receipt_id  uuid not null references zap_receipts(id) on delete cascade,
  email       text not null references allowed_emails(email),
  primary key (receipt_id, email)
);

create table zap_receipt_items (
  id            uuid primary key default uuid_generate_v4(),
  receipt_id    uuid not null references zap_receipts(id) on delete cascade,
  description   text not null default '',
  amount_cents  integer not null check (amount_cents >= 0),
  position      integer not null
);

create table zap_receipt_item_members (
  item_id  uuid not null references zap_receipt_items(id) on delete cascade,
  email    text not null references allowed_emails(email),
  primary key (item_id, email)
);

create table zap_settlements (
  id          uuid primary key default uuid_generate_v4(),
  trip_id     uuid not null references zap_trips(id) on delete cascade,
  from_email  text not null references allowed_emails(email),
  to_email    text not null references allowed_emails(email),
  amount_cents integer not null check (amount_cents > 0),
  created_at  timestamptz not null default now(),
  paid_at     timestamptz not null default now()  -- v1: settlement = paid, no "pending" state
);

create index zap_trip_members_email_idx on zap_trip_members (email);
create index zap_receipts_trip_idx on zap_receipts (trip_id);
create index zap_receipt_items_receipt_idx on zap_receipt_items (receipt_id);
create index zap_settlements_trip_idx on zap_settlements (trip_id);
```

### RLS policies

Helper SQL function `is_zap_trip_member(trip_id uuid) returns boolean` (security
definer) checks whether `auth_email()` is a row in `zap_trip_members` for that
trip.

Per table:

- `zap_trips`:
  - SELECT/UPDATE/DELETE allowed if `is_zap_trip_member(id)`.
  - INSERT allowed for any authenticated user (and the inserting user is
    automatically added to `zap_trip_members` via a trigger so they
    immediately qualify for subsequent queries).
- `zap_trip_members`:
  - SELECT/INSERT/DELETE allowed if `is_zap_trip_member(trip_id)`.
  - INSERT `with check` additionally requires that the new `email` is in
    `allowed_emails` and `enabled = true`.
- `zap_receipts`, `zap_receipt_members`, `zap_receipt_items`,
  `zap_receipt_item_members`, `zap_settlements`:
  - All operations require `is_zap_trip_member(trip_id)`. For child tables,
    the check traverses through the parent `zap_receipts` row.

### Trigger: auto-add creator

```sql
create or replace function zap_add_creator_as_member() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into zap_trip_members (trip_id, email) values (new.id, new.created_by);
  return new;
end;
$$;

create trigger zap_trips_add_creator
  after insert on zap_trips
  for each row execute function zap_add_creator_as_member();
```

This avoids a chicken-and-egg problem where RLS on `zap_trip_members` would
otherwise block the first insert.

## Storage

A private Supabase Storage bucket `zap-receipts`:

- Path convention: `{trip_id}/{receipt_id}.{ext}`.
- RLS: only trip members may read objects whose first path segment is a trip
  they belong to. Insert allowed with the same constraint.
- Client accesses images via `supabase.storage.from('zap-receipts').createSignedUrl(path, 60)`.

## Edge Function: `parse-receipt`

Input:

```json
{ "storagePath": "trip-uuid/receipt-uuid.jpg" }
```

Output:

```json
{
  "ok": true,
  "total_cents": 4523,
  "date": "2026-04-19",
  "label": "The Taco Place",
  "items": [
    { "description": "Carnitas combo", "amount_cents": 1899 },
    { "description": "Margarita",       "amount_cents": 1200 }
  ]
}
```

Implementation:

1. Verify caller is authenticated (JWT in header) and is a member of the trip
   implied by the first path segment. (Serverside guard duplicating RLS.)
2. Download image from `zap-receipts` storage using service role.
3. Base64-encode and send to Anthropic `POST /v1/messages` with
   `model: "claude-haiku-4-5"`, an image block, and a system prompt
   instructing the model to return *only* strict JSON.
4. Parse, validate the shape (numeric totals, ISO date, items array), return.
5. Errors return `{ ok: false, error: "<message>" }` with HTTP 4xx/5xx as
   appropriate. On parse failure or Anthropic error, the client falls back to
   a blank form the user fills in manually.

Secrets:
- `ANTHROPIC_API_KEY` (project secret).

## Balance + settlement algorithms (pure TS)

`src/routes/admin/apps/zap/balances.ts` (unit-testable, no Supabase):

```ts
export type TripLedger = {
  members: string[];                         // emails
  receipts: LedgerReceipt[];
  settlements: { from: string; to: string; amount_cents: number }[];
};

export type LedgerReceipt = {
  payer: string;
  total_cents: number;
  split_mode: "flat" | "itemized";
  members_on_receipt: string[];              // for flat, and for remainder in itemized
  items?: { amount_cents: number; members: string[] }[];
};

// Positive => owed to user. Negative => user owes.
export function computeBalances(ledger: TripLedger): Record<string, number>;

// Greedy min-cashflow. Deterministic tie-break by email.
export function suggestSettlements(
  balances: Record<string, number>
): { from: string; to: string; amount_cents: number }[];
```

Balance math per receipt:
- `flat`: each of `members_on_receipt` owes `floor(total / n)`; the penny
  remainder is assigned to `members_on_receipt` sorted by email (first N get
  +1 cent) so totals reconcile exactly. Payer is credited `total_cents`.
- `itemized`: each item distributes its `amount_cents` evenly across its
  `members`; penny remainder rule applies per item. Remainder
  (`total - sum(items)`) is distributed flat across `members_on_receipt`.
  Payer is credited `total_cents`.

Settlement suggestion:
- Round balances to cents.
- While any user has positive balance > 0:
  - pick largest creditor C, largest debtor D (ties by email ascending)
  - amount = min(C.balance, |D.balance|)
  - emit (D.email → C.email, amount)
  - C.balance -= amount, D.balance += amount
- Returns at most `n-1` suggestions for `n` users.

## React structure

```
src/routes/admin/apps/zap/
  index.tsx              -- re-export + sub-route tree
  TripList.tsx           -- /admin/apps/zap
  TripDetail.tsx         -- /admin/apps/zap/:tripId
  NewReceipt.tsx         -- /admin/apps/zap/:tripId/receipt/new
  EditReceipt.tsx        -- /admin/apps/zap/:tripId/receipt/:receiptId
  balances.ts            -- pure logic (imported by TripDetail)
  api.ts                 -- thin supabase-js wrappers + parseReceipt() call
  types.ts               -- derived types
  zap.module.css         -- green theme, mobile-first styles
```

App.tsx change: `/admin/apps/:slug` becomes `/admin/apps/:slug/*` so ZAP can own
its own sub-routes. `RequireApp` renders the component and lets it handle
nested routing via `<Routes>` under that prefix.

### Trip list screen

- Big "New trip" button at top.
- List of cards, one per trip the user is a member of:
  - Trip name
  - Member count
  - Your balance ("You are owed $X" / "You owe $X" / "All settled")
  - "Closed" badge if `closed_at is not null`
- Tap a card → Trip detail.

### Trip detail screen

Sections:
1. **Header** — trip name (editable inline), close/reopen button, delete trip (confirm).
2. **Members** — chips with emails. "+ Add member" opens an email input; validated against allowlist via server round-trip.
3. **Balances** — each member's net cents. Color-coded.
4. **Settlement plan** — ordered list of (from → to, amount) suggestions. Each row has "Mark paid" which records a `zap_settlements` row and refreshes.
5. **Settlement history** — past `zap_settlements` rows.
6. **Receipts** — reverse-chronological list. Each row shows label, date, total, payer, count of splitters, receipt thumbnail (signed URL). Tap to edit.
7. **+ Receipt** floating action button.

### New / edit receipt screen

Three-phase UI:

1. **Image input** (new only): `<input type="file" accept="image/*" capture="environment">`. Preview thumbnail.
2. **Parse** (new only): spinner while `parse-receipt` runs. On error, continue with a blank form.
3. **Form**:
   - Label text input.
   - Date picker (defaults to today or parsed date).
   - Payer dropdown (defaults to current user, all trip members available).
   - Total cents input.
   - "Who's on this?" checkbox list of trip members (all checked by default).
   - "Itemize?" toggle.
     - Off: flat split. Form ends here.
     - On: line-item list (editable description + amount + per-item member checkboxes). The remainder (total - sum(items)) is displayed and distributed flat among "who's on this?".
   - Save / Cancel / Delete (edit only).

## Theme

Uses the site's green palette from `src/styles/globals.css`:

- bg: `#1c351c`
- text: `#eaf5fc`
- accent/link: `#84c2e2`
- secondary accent: `#c6d89a`
- card surface: a slightly lighter green (`#254426`)

All ZAP styles live in `zap.module.css`. The admin shell's topbar is moving to
green via a separate effort; ZAP doesn't depend on that work landing first.

## Error handling

| Case | Handling |
| ---- | -------- |
| Image upload fails | Show inline error; allow retry. Receipt record is not created until parse succeeds (or user skips parse). |
| Parse fails / Anthropic unreachable | Toast "Couldn't read the receipt — fill it in manually" and show empty form. |
| Add member to trip with email not on allowlist | Inline error "That email isn't set up to use the site." |
| Mark-as-paid race (two users mark same suggestion) | Idempotent: a settlement row is just a ledger entry. The duplicate simply cancels the next suggestion. No hard error. |
| RLS denial | Generic toast "Something went wrong." |

## Testing

Playwright specs under `tests/admin/zap/`:

1. **access.spec.ts** — allowlisted non-admin sees ZAP card; user-manager / analytics still admin-only (regression).
2. **trips.spec.ts** — create trip, add member, member can see trip on second login.
3. **receipt.spec.ts** — upload receipt with mocked `parse-receipt` endpoint (Playwright route intercept), save, verify balance display.
4. **settlement.spec.ts** — two-receipt scenario with three users, verify optimal settlement suggestions are minimal; mark one paid, verify history and remaining plan.
5. **balances.unit.spec.ts** — pure-function tests for `computeBalances` + `suggestSettlements` including penny-rounding edge cases.

Anthropic is never called during tests; the Edge Function is bypassed with a
Playwright route handler returning canned parse results.

## Deployment

1. Apply migration `0003_zap.sql` (Storage bucket + tables + RLS).
2. Create Storage bucket `zap-receipts` (private).
3. Deploy Edge Function `parse-receipt`, set `ANTHROPIC_API_KEY` secret.
4. Register ZAP in the app registry (no dashboard code changes needed).
5. Standard Vite build → rsync to Dreamhost.

## Open assumptions flagged for review

- USD-only. No currency selector. If a trip needs multi-currency later, the
  schema will need a `currency` column on both `zap_receipts` and
  `zap_settlements`.
- No edit-history for receipts. Editing a receipt overwrites prior values;
  past balance views will change retroactively. Acceptable for a friends app.
- `paid_at` is set immediately on `zap_settlements` insert. No pending state.
