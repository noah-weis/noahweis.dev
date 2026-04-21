import { supabase } from "../../../../lib/supabase";
import { computeBalances } from "./balances";
import type {
  NewReceiptPayload,
  ParsedReceipt,
  Receipt,
  Trip,
  TripSummary,
  ZapReceiptItemRow,
  ZapReceiptRow,
  ZapSettlementRow,
  ZapTripRow,
} from "./types";

export async function listTrips(myEmail: string): Promise<TripSummary[]> {
  // Fetch all trips I'm a member of.
  const { data: memberRows, error: memErr } = await supabase
    .from("zap_trip_members")
    .select("trip_id, email")
    .eq("email", myEmail);
  if (memErr) throw memErr;
  const tripIds = (memberRows ?? []).map((r) => r.trip_id);
  if (tripIds.length === 0) return [];

  const { data: trips, error: tripErr } = await supabase
    .from("zap_trips").select("*").in("id", tripIds).order("created_at", { ascending: false });
  if (tripErr) throw tripErr;

  const { data: allMembers } = await supabase
    .from("zap_trip_members").select("trip_id, email").in("trip_id", tripIds);

  // Receipts + settlements for balance calc across all trips in one go.
  const [receiptsRes, itemsRes, itemMembersRes, receiptMembersRes, settlementsRes] = await Promise.all([
    supabase.from("zap_receipts").select("*").in("trip_id", tripIds),
    supabase.from("zap_receipt_items").select("*"),
    supabase.from("zap_receipt_item_members").select("*"),
    supabase.from("zap_receipt_members").select("*"),
    supabase.from("zap_settlements").select("*").in("trip_id", tripIds),
  ]);

  const receipts: ZapReceiptRow[] = receiptsRes.data ?? [];
  const items: ZapReceiptItemRow[] = itemsRes.data ?? [];
  const itemMembers = itemMembersRes.data ?? [];
  const receiptMembers = receiptMembersRes.data ?? [];
  const settlements: ZapSettlementRow[] = settlementsRes.data ?? [];

  const out: TripSummary[] = [];
  for (const t of trips ?? []) {
    const members = (allMembers ?? []).filter((m) => m.trip_id === t.id).map((m) => m.email);
    const tripReceipts = receipts.filter((r) => r.trip_id === t.id);
    const tripSettlements = settlements.filter((s) => s.trip_id === t.id);
    const ledgerReceipts = tripReceipts.map((r) => toLedgerReceipt(r, items, itemMembers, receiptMembers));
    const balances = computeBalances({
      members,
      receipts: ledgerReceipts,
      settlements: tripSettlements.map((s) => ({ from: s.from_email, to: s.to_email, amount_cents: s.amount_cents })),
    });
    out.push({
      ...t,
      member_count: members.length,
      your_balance_cents: balances[myEmail] ?? 0,
    });
  }
  return out;
}

function toLedgerReceipt(
  r: ZapReceiptRow,
  allItems: ZapReceiptItemRow[],
  allItemMembers: { item_id: string; email: string }[],
  allReceiptMembers: { receipt_id: string; email: string }[],
) {
  const receiptItems = allItems.filter((i) => i.receipt_id === r.id).sort((a, b) => a.position - b.position);
  const members_on_receipt = allReceiptMembers.filter((m) => m.receipt_id === r.id).map((m) => m.email);
  const items = receiptItems.map((i) => ({
    amount_cents: i.amount_cents,
    members: allItemMembers.filter((m) => m.item_id === i.id).map((m) => m.email),
  }));
  return {
    payer: r.payer_email,
    total_cents: r.total_cents,
    split_mode: r.split_mode as "flat" | "itemized",
    members_on_receipt,
    items: r.split_mode === "itemized" ? items : undefined,
  };
}

export async function createTrip(name: string): Promise<ZapTripRow> {
  const { data: session } = await supabase.auth.getSession();
  const email = session.session?.user.email;
  if (!email) throw new Error("not signed in");
  const { data, error } = await supabase
    .from("zap_trips").insert({ name, created_by: email }).select().single();
  if (error) throw error;
  return data;
}

export async function renameTrip(tripId: string, name: string): Promise<void> {
  const { error } = await supabase.from("zap_trips").update({ name }).eq("id", tripId);
  if (error) throw error;
}

export async function closeTrip(tripId: string, closed: boolean): Promise<void> {
  const { error } = await supabase
    .from("zap_trips").update({ closed_at: closed ? new Date().toISOString() : null }).eq("id", tripId);
  if (error) throw error;
}

export async function deleteTrip(tripId: string): Promise<void> {
  const { error } = await supabase.from("zap_trips").delete().eq("id", tripId);
  if (error) throw error;
}

export async function addMember(tripId: string, email: string): Promise<void> {
  const e = email.trim().toLowerCase();
  const { error } = await supabase.from("zap_trip_members").insert({ trip_id: tripId, email: e });
  if (error) {
    // 23503 = FK violation (email not in allowed_emails).
    // 42501 = RLS denial — hit when the email exists but is_enabled_allowed_email
    //         returns false, OR when you lack trip membership. We treat both
    //         as "not approved" at this UI step (an existing-non-member can't
    //         legitimately get here because the route guard enforces access).
    const code = (error as { code?: string }).code;
    if (code === "23503" || code === "23514" || code === "42501") {
      throw new Error("That email isn't set up to use the site.");
    }
    throw error;
  }
}

export async function removeMember(tripId: string, email: string): Promise<void> {
  const { error } = await supabase
    .from("zap_trip_members").delete().eq("trip_id", tripId).eq("email", email);
  if (error) throw error;
}

export async function getTrip(tripId: string): Promise<Trip | null> {
  const { data: trip, error: tripErr } = await supabase
    .from("zap_trips").select("*").eq("id", tripId).maybeSingle();
  if (tripErr) throw tripErr;
  if (!trip) return null;

  const [membersRes, receiptsRes, itemsRes, itemMembersRes, receiptMembersRes, settlementsRes] = await Promise.all([
    supabase.from("zap_trip_members").select("email").eq("trip_id", tripId),
    supabase.from("zap_receipts").select("*").eq("trip_id", tripId).order("receipt_date", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("zap_receipt_items").select("*"),
    supabase.from("zap_receipt_item_members").select("*"),
    supabase.from("zap_receipt_members").select("*"),
    supabase.from("zap_settlements").select("*").eq("trip_id", tripId).order("paid_at", { ascending: false }),
  ]);

  const receiptRows = receiptsRes.data ?? [];
  const items = itemsRes.data ?? [];
  const itemMembers = itemMembersRes.data ?? [];
  const receiptMembers = receiptMembersRes.data ?? [];

  const receipts: Receipt[] = await Promise.all(
    receiptRows.map(async (r) => {
      const rItems = items
        .filter((i) => i.receipt_id === r.id)
        .sort((a, b) => a.position - b.position)
        .map((i) => ({ ...i, members: itemMembers.filter((m) => m.item_id === i.id).map((m) => m.email) }));
      const rMembers = receiptMembers.filter((m) => m.receipt_id === r.id).map((m) => m.email);
      const { data: signed } = await supabase.storage.from("zap-receipts").createSignedUrl(r.storage_path, 60 * 60);
      return {
        ...r,
        members: rMembers,
        items: rItems,
        image_signed_url: signed?.signedUrl ?? null,
      };
    }),
  );

  return {
    ...trip,
    members: (membersRes.data ?? []).map((m) => m.email),
    receipts,
    settlements: settlementsRes.data ?? [],
  };
}

export async function uploadReceiptImage(tripId: string, file: File): Promise<string> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const id = crypto.randomUUID();
  const path = `${tripId}/${id}.${ext}`;
  const { error } = await supabase.storage.from("zap-receipts").upload(path, file, {
    contentType: file.type || "image/jpeg",
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function parseReceipt(storagePath: string): Promise<ParsedReceipt> {
  const { data, error } = await supabase.functions.invoke("parse-receipt", {
    body: { storagePath },
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.error ?? "parse failed");
  return {
    total_cents: data.total_cents,
    date: data.date,
    label: data.label,
    items: data.items ?? [],
  };
}

export async function saveReceipt(p: NewReceiptPayload): Promise<string> {
  const { data: session } = await supabase.auth.getSession();
  const uploader = session.session?.user.email;
  if (!uploader) throw new Error("not signed in");

  const { data: rcpt, error } = await supabase.from("zap_receipts").insert({
    trip_id: p.trip_id,
    uploaded_by: uploader,
    payer_email: p.payer_email,
    storage_path: p.storage_path,
    label: p.label,
    receipt_date: p.receipt_date,
    total_cents: p.total_cents,
    split_mode: p.split_mode,
  }).select().single();
  if (error) throw error;

  // members
  if (p.members.length > 0) {
    const { error: mErr } = await supabase.from("zap_receipt_members").insert(
      p.members.map((email) => ({ receipt_id: rcpt.id, email })),
    );
    if (mErr) throw mErr;
  }

  // items + their members
  if (p.split_mode === "itemized" && p.items.length > 0) {
    for (let i = 0; i < p.items.length; i++) {
      const it = p.items[i];
      const { data: itemRow, error: itemErr } = await supabase.from("zap_receipt_items").insert({
        receipt_id: rcpt.id,
        description: it.description,
        amount_cents: it.amount_cents,
        position: i,
      }).select().single();
      if (itemErr) throw itemErr;
      if (it.members.length > 0) {
        const { error: imErr } = await supabase.from("zap_receipt_item_members").insert(
          it.members.map((email) => ({ item_id: itemRow.id, email })),
        );
        if (imErr) throw imErr;
      }
    }
  }

  return rcpt.id;
}

export async function updateReceipt(id: string, p: NewReceiptPayload): Promise<void> {
  // Simplest approach: update scalar fields, wipe all child rows, re-insert.
  const { error } = await supabase.from("zap_receipts").update({
    payer_email: p.payer_email,
    label: p.label,
    receipt_date: p.receipt_date,
    total_cents: p.total_cents,
    split_mode: p.split_mode,
  }).eq("id", id);
  if (error) throw error;

  await supabase.from("zap_receipt_members").delete().eq("receipt_id", id);
  await supabase.from("zap_receipt_items").delete().eq("receipt_id", id);
  // item_members cascade from items.

  if (p.members.length > 0) {
    await supabase.from("zap_receipt_members").insert(
      p.members.map((email) => ({ receipt_id: id, email })),
    );
  }
  if (p.split_mode === "itemized" && p.items.length > 0) {
    for (let i = 0; i < p.items.length; i++) {
      const it = p.items[i];
      const { data: itemRow, error: itemErr } = await supabase.from("zap_receipt_items").insert({
        receipt_id: id,
        description: it.description,
        amount_cents: it.amount_cents,
        position: i,
      }).select().single();
      if (itemErr) throw itemErr;
      if (it.members.length > 0) {
        await supabase.from("zap_receipt_item_members").insert(
          it.members.map((email) => ({ item_id: itemRow.id, email })),
        );
      }
    }
  }
}

export async function deleteReceipt(id: string): Promise<void> {
  const { error } = await supabase.from("zap_receipts").delete().eq("id", id);
  if (error) throw error;
}

export async function markSettlementPaid(args: {
  trip_id: string; from: string; to: string; amount_cents: number;
}): Promise<void> {
  const { error } = await supabase.from("zap_settlements").insert({
    trip_id: args.trip_id,
    from_email: args.from,
    to_email: args.to,
    amount_cents: args.amount_cents,
  });
  if (error) throw error;
}
