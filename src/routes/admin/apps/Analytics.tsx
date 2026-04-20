import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { APPS } from "../../../apps/registry";
import type { EventRow } from "../../../lib/types";

type Filters = {
  rangeDays: 1 | 7 | 30;
  appSlug: string;
  eventName: string;
  userEmail: string;
};

const inputCss: React.CSSProperties = { padding: "6px 10px", background: "#0e0e10", border: "1px solid #3f3f46", borderRadius: 4, color: "#f5f5f7", fontSize: 13 };
const btnCss:   React.CSSProperties = { padding: "6px 12px", background: "#4f46e5", color: "white", border: 0, borderRadius: 4, cursor: "pointer", fontSize: 13 };
const statCss:  React.CSSProperties = { padding: 14, background: "#18181b", border: "1px solid #27272a", borderRadius: 8, minWidth: 140 };
const labelCss: React.CSSProperties = { fontSize: 12, color: "#a1a1aa", textTransform: "uppercase", letterSpacing: 0.5 };
const valueCss: React.CSSProperties = { fontSize: 24, fontWeight: 600, marginTop: 4 };

export function Analytics() {
  const [filters, setFilters] = useState<Filters>({ rangeDays: 7, appSlug: "", eventName: "", userEmail: "" });
  const [applied, setApplied] = useState<Filters>(filters);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const since = new Date(Date.now() - applied.rangeDays * 24 * 60 * 60 * 1000).toISOString();
    let q = supabase.from("events").select("*").gte("created_at", since).order("created_at", { ascending: false }).limit(1000);
    if (applied.appSlug)   q = q.eq("app_slug", applied.appSlug);
    if (applied.userEmail) q = q.eq("email", applied.userEmail);
    if (applied.eventName) q = q.ilike("event_name", `%${applied.eventName}%`);
    setLoading(true);
    q.then(({ data }) => {
      setEvents((data as EventRow[]) ?? []);
      setLoading(false);
    });
  }, [applied]);

  const totalEvents   = events.length;
  const distinctUsers = new Set(events.map((e) => e.email).filter(Boolean)).size;
  const distinctApps  = new Set(events.map((e) => e.app_slug).filter(Boolean)).size;

  return (
    <div data-testid="analytics-root">
      <h1 style={{ marginTop: 0 }}>Analytics</h1>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <select data-testid="analytics-filter-range" style={inputCss} value={filters.rangeDays} onChange={(e) => setFilters({ ...filters, rangeDays: Number(e.target.value) as 1 | 7 | 30 })}>
          <option value={1}>Last 24h</option>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
        </select>
        <select data-testid="analytics-filter-app" style={inputCss} value={filters.appSlug} onChange={(e) => setFilters({ ...filters, appSlug: e.target.value })}>
          <option value="">All apps</option>
          {APPS.map((a) => <option key={a.slug} value={a.slug}>{a.name}</option>)}
        </select>
        <input data-testid="analytics-filter-event" style={inputCss} placeholder="Event name contains…" value={filters.eventName} onChange={(e) => setFilters({ ...filters, eventName: e.target.value })} />
        <input data-testid="analytics-filter-user" style={inputCss} placeholder="user@example.com" value={filters.userEmail} onChange={(e) => setFilters({ ...filters, userEmail: e.target.value })} />
        <button data-testid="analytics-filter-apply" style={btnCss} onClick={() => setApplied(filters)}>Apply</button>
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
        <div style={statCss}>
          <div style={labelCss}>Events</div>
          <div data-testid="analytics-total-events" style={valueCss}>{loading ? "…" : totalEvents}</div>
        </div>
        <div style={statCss}>
          <div style={labelCss}>Distinct users</div>
          <div data-testid="analytics-distinct-users" style={valueCss}>{loading ? "…" : distinctUsers}</div>
        </div>
        <div style={statCss}>
          <div style={labelCss}>Distinct apps</div>
          <div data-testid="analytics-distinct-apps" style={valueCss}>{loading ? "…" : distinctApps}</div>
        </div>
      </div>
    </div>
  );
}
