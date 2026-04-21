import type { Database } from "../../../../lib/types";

export type ZapTripRow            = Database["public"]["Tables"]["zap_trips"]["Row"];
export type ZapTripMemberRow      = Database["public"]["Tables"]["zap_trip_members"]["Row"];
export type ZapReceiptRow         = Database["public"]["Tables"]["zap_receipts"]["Row"];
export type ZapReceiptMemberRow   = Database["public"]["Tables"]["zap_receipt_members"]["Row"];
export type ZapReceiptItemRow     = Database["public"]["Tables"]["zap_receipt_items"]["Row"];
export type ZapReceiptItemMemberRow = Database["public"]["Tables"]["zap_receipt_item_members"]["Row"];
export type ZapSettlementRow      = Database["public"]["Tables"]["zap_settlements"]["Row"];

export type Receipt = ZapReceiptRow & {
  members: string[]; // emails on flat split / overall members for itemized remainder
  items: (ZapReceiptItemRow & { members: string[] })[];
  image_signed_url: string | null;
};

export type Trip = ZapTripRow & {
  members: string[];
  receipts: Receipt[];
  settlements: ZapSettlementRow[];
};

export type TripSummary = ZapTripRow & {
  member_count: number;
  your_balance_cents: number;
};

export type ParsedReceipt = {
  total_cents: number;
  date: string | null;
  label: string;
  items: { description: string; amount_cents: number }[];
};

export type NewReceiptPayload = {
  trip_id: string;
  payer_email: string;
  storage_path: string;
  label: string;
  receipt_date: string; // YYYY-MM-DD
  total_cents: number;
  split_mode: "flat" | "itemized";
  members: string[];
  items: { description: string; amount_cents: number; members: string[] }[];
};
