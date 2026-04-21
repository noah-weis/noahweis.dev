import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { APPS } from "../../../apps/registry";
import type { EventRow } from "../../../lib/types";
import s from "../../../styles/admin.module.css";

type Filters = {
  rangeDays: 1 | 7 | 30;
  appSlug: string;
  eventName: string;
  userEmail: string;
};

const PAGE_SIZE = 50;

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
    setExpanded((ex) => {
      const next = new Set(ex);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const hasPayloadKeys = (p: unknown): boolean =>
    !!p && typeof p === "object" && !Array.isArray(p) && Object.keys(p as Record<string, unknown>).length > 0;

  return (
    <div data-testid="analytics-root">
      <h1 className={s.pageTitle}>Analytics</h1>

      <div className={s.toolbar}>
        <select data-testid="analytics-filter-range" className={s.select} value={filters.rangeDays} onChange={(e) => setFilters({ ...filters, rangeDays: Number(e.target.value) as 1 | 7 | 30 })}>
          <option value={1}>Last 24h</option>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
        </select>
        <select data-testid="analytics-filter-app" className={s.select} value={filters.appSlug} onChange={(e) => setFilters({ ...filters, appSlug: e.target.value })}>
          <option value="">All apps</option>
          {APPS.map((a) => <option key={a.slug} value={a.slug}>{a.name}</option>)}
        </select>
        <input data-testid="analytics-filter-event" className={s.input} placeholder="Event name contains…" value={filters.eventName} onChange={(e) => setFilters({ ...filters, eventName: e.target.value })} />
        <input data-testid="analytics-filter-user" className={s.input} placeholder="user@example.com" value={filters.userEmail} onChange={(e) => setFilters({ ...filters, userEmail: e.target.value })} />
        <button data-testid="analytics-filter-apply" className={s.button} onClick={() => setApplied(filters)}>Apply</button>
      </div>

      <div className={s.statRow}>
        <div className={s.stat}>
          <div className={s.statLabel}>Events</div>
          <div data-testid="analytics-total-events" className={s.statValue}>{loading ? "…" : totalEvents}</div>
        </div>
        <div className={s.stat}>
          <div className={s.statLabel}>Distinct users</div>
          <div data-testid="analytics-distinct-users" className={s.statValue}>{loading ? "…" : distinctUsers}</div>
        </div>
        <div className={s.stat}>
          <div className={s.statLabel}>Distinct apps</div>
          <div data-testid="analytics-distinct-apps" className={s.statValue}>{loading ? "…" : distinctApps}</div>
        </div>
      </div>

      <div className={s.sparklineWrap}>
        <div className={s.sparklineLabel}>Daily activity</div>
        <svg data-testid="analytics-sparkline" width="100%" height="80" viewBox={`0 0 ${buckets.length * 20} 80`} preserveAspectRatio="none">
          {buckets.map((b, i) => {
            const h = (b.count / maxBucket) * 70;
            return (
              <g key={b.date}>
                <rect x={i * 20 + 2} y={75 - h} width={16} height={h} fill="var(--red-color, #c6d89a)" />
                <title>{b.date}: {b.count}</title>
              </g>
            );
          })}
        </svg>
      </div>

      <table className={s.table}>
        <thead>
          <tr>
            <th>Time</th>
            <th>User</th>
            <th>App</th>
            <th>Event</th>
            <th>Payload</th>
          </tr>
        </thead>
        <tbody>
          {pageEvents.map((e) => (
            <tr key={e.id} data-testid="analytics-event-row">
              <td>{new Date(e.created_at).toLocaleString()}</td>
              <td>{e.email ?? <span className={s.muted}>—</span>}</td>
              <td>{e.app_slug ?? <span className={s.muted}>—</span>}</td>
              <td>{e.event_name}</td>
              <td>
                {!hasPayloadKeys(e.payload) ? (
                  <span className={s.muted}>—</span>
                ) : (
                  <>
                    <button data-testid="analytics-expand-payload" className={s.linkButton} onClick={() => toggleExpand(e.id)}>
                      {expanded.has(e.id) ? "hide" : "show"}
                    </button>
                    {expanded.has(e.id) && (
                      <pre data-testid="analytics-payload-json" className={s.payloadJson}>{JSON.stringify(e.payload, null, 2)}</pre>
                    )}
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className={s.paginationRow}>
        <button data-testid="analytics-pagination-prev" className={s.button} disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button>
        <span data-testid="analytics-pagination-info" className={s.paginationInfo}>Page {page} of {totalPages}</span>
        <button data-testid="analytics-pagination-next" className={s.button} disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</button>
      </div>
    </div>
  );
}
