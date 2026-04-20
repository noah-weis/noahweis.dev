import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { APPS } from "../../../apps/registry";
import type { EventRow } from "../../../lib/types";

type Filters = {
  rangeDays: 1 | 7 | 30;
  appSlug: string;
  eventName: string;
  userEmail: string;
};

const PAGE_SIZE = 50;

const inputCss: React.CSSProperties = { padding: "6px 10px", background: "#0e0e10", border: "1px solid #3f3f46", borderRadius: 4, color: "#f5f5f7", fontSize: 13 };
const btnCss:   React.CSSProperties = { padding: "6px 12px", background: "#4f46e5", color: "white", border: 0, borderRadius: 4, cursor: "pointer", fontSize: 13 };
const linkBtn:  React.CSSProperties = { background: "transparent", border: 0, color: "#818cf8", cursor: "pointer", padding: 0, fontSize: 12 };
const statCss:  React.CSSProperties = { padding: 14, background: "#18181b", border: "1px solid #27272a", borderRadius: 8, minWidth: 140 };
const labelCss: React.CSSProperties = { fontSize: 12, color: "#a1a1aa", textTransform: "uppercase", letterSpacing: 0.5 };
const valueCss: React.CSSProperties = { fontSize: 24, fontWeight: 600, marginTop: 4 };
const tableCss: React.CSSProperties = { width: "100%", borderCollapse: "collapse", marginTop: 24 };
const thtdCss:  React.CSSProperties = { padding: "8px 10px", borderBottom: "1px solid #27272a", textAlign: "left", fontSize: 13, verticalAlign: "top" };

function dailyBuckets(events: EventRow[], days: number): { date: string; count: number }[] {
  const map = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    map.set(d.toISOString().slice(0, 10), 0);
  }
  for (const e of events) {
    const day = e.created_at.slice(0, 10);
    if (map.has(day)) map.set(day, (map.get(day) ?? 0) + 1);
  }
  return [...map.entries()].map(([date, count]) => ({ date, count }));
}

export function Analytics() {
  const [filters, setFilters] = useState<Filters>({ rangeDays: 7, appSlug: "", eventName: "", userEmail: "" });
  const [applied, setApplied] = useState<Filters>(filters);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

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
      setPage(1);
    });
  }, [applied]);

  const totalEvents   = events.length;
  const distinctUsers = new Set(events.map((e) => e.email).filter(Boolean)).size;
  const distinctApps  = new Set(events.map((e) => e.app_slug).filter(Boolean)).size;

  const buckets = useMemo(() => dailyBuckets(events, applied.rangeDays), [events, applied.rangeDays]);
  const maxBucket = Math.max(1, ...buckets.map((b) => b.count));

  const totalPages = Math.max(1, Math.ceil(events.length / PAGE_SIZE));
  const pageEvents = events.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function toggleExpand(id: number) {
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // payload comes from Supabase as Json (recursive union). For the UI we need
  // to know if it has any keys; narrow with a guard.
  const hasPayloadKeys = (p: unknown): boolean =>
    !!p && typeof p === "object" && !Array.isArray(p) && Object.keys(p as Record<string, unknown>).length > 0;

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
        <div style={statCss}><div style={labelCss}>Events</div><div data-testid="analytics-total-events" style={valueCss}>{loading ? "…" : totalEvents}</div></div>
        <div style={statCss}><div style={labelCss}>Distinct users</div><div data-testid="analytics-distinct-users" style={valueCss}>{loading ? "…" : distinctUsers}</div></div>
        <div style={statCss}><div style={labelCss}>Distinct apps</div><div data-testid="analytics-distinct-apps" style={valueCss}>{loading ? "…" : distinctApps}</div></div>
      </div>

      <div style={{ marginTop: 24 }}>
        <div style={labelCss}>Daily activity</div>
        <svg data-testid="analytics-sparkline" width="100%" height="80" viewBox={`0 0 ${buckets.length * 20} 80`} preserveAspectRatio="none">
          {buckets.map((b, i) => {
            const h = (b.count / maxBucket) * 70;
            return (
              <g key={b.date}>
                <rect x={i * 20 + 2} y={75 - h} width={16} height={h} fill="#4f46e5" />
                <title>{b.date}: {b.count}</title>
              </g>
            );
          })}
        </svg>
      </div>

      <table style={tableCss}>
        <thead>
          <tr>
            <th style={thtdCss}>Time</th>
            <th style={thtdCss}>User</th>
            <th style={thtdCss}>App</th>
            <th style={thtdCss}>Event</th>
            <th style={thtdCss}>Payload</th>
          </tr>
        </thead>
        <tbody>
          {pageEvents.map((e) => (
            <tr key={e.id} data-testid="analytics-event-row">
              <td style={thtdCss}>{new Date(e.created_at).toLocaleString()}</td>
              <td style={thtdCss}>{e.email ?? "—"}</td>
              <td style={thtdCss}>{e.app_slug ?? "—"}</td>
              <td style={thtdCss}>{e.event_name}</td>
              <td style={thtdCss}>
                {!hasPayloadKeys(e.payload) ? (
                  <span style={{ color: "#71717a" }}>—</span>
                ) : (
                  <>
                    <button data-testid="analytics-expand-payload" style={linkBtn} onClick={() => toggleExpand(e.id)}>
                      {expanded.has(e.id) ? "hide" : "show"}
                    </button>
                    {expanded.has(e.id) && (
                      <pre data-testid="analytics-payload-json" style={{ margin: "6px 0 0", fontSize: 12, color: "#a1a1aa" }}>{JSON.stringify(e.payload, null, 2)}</pre>
                    )}
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center" }}>
        <button data-testid="analytics-pagination-prev" style={btnCss} disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button>
        <span data-testid="analytics-pagination-info" style={{ color: "#a1a1aa", fontSize: 13 }}>Page {page} of {totalPages}</span>
        <button data-testid="analytics-pagination-next" style={btnCss} disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</button>
      </div>
    </div>
  );
}
