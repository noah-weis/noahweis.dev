import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { APPS } from "../../../apps/registry";
import type { AllowedEmail, UserAppPermission } from "../../../lib/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const tableCss: React.CSSProperties = { width: "100%", borderCollapse: "collapse", marginTop: 24 };
const thtdCss:  React.CSSProperties = { padding: "10px 12px", borderBottom: "1px solid #27272a", textAlign: "left", fontSize: 14, verticalAlign: "top" };
const inputCss: React.CSSProperties = { padding: "8px 10px", background: "#0e0e10", border: "1px solid #3f3f46", borderRadius: 4, color: "#f5f5f7", fontSize: 14 };
const btnCss:   React.CSSProperties = { padding: "8px 14px", background: "#4f46e5", color: "white", border: 0, borderRadius: 4, cursor: "pointer", fontSize: 14 };
const linkBtn:  React.CSSProperties = { background: "transparent", border: 0, color: "#818cf8", cursor: "pointer", padding: 0, fontSize: 13 };
const dangerBtn: React.CSSProperties = { ...linkBtn, color: "#f87171" };
const popoverCss: React.CSSProperties = { background: "#27272a", border: "1px solid #3f3f46", borderRadius: 6, padding: 12, marginTop: 8 };

type RowState = {
  editing: boolean;
  labelDraft: string;
  permsOpen: boolean;
  permsDraft: Set<string>;
};

const emptyRowState = (label: string | null, perms: string[]): RowState => ({
  editing: false,
  labelDraft: label ?? "",
  permsOpen: false,
  permsDraft: new Set(perms),
});

export function UserManager() {
  const [rows, setRows] = useState<AllowedEmail[]>([]);
  const [perms, setPerms] = useState<UserAppPermission[]>([]);
  const [rowState, setRowState] = useState<Record<string, RowState>>({});
  const [loading, setLoading] = useState(true);
  const [addEmail, setAddEmail] = useState("");
  const [addLabel, setAddLabel] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  async function reload() {
    setLoading(true);
    const [{ data: rowData }, { data: permData }] = await Promise.all([
      supabase.from("allowed_emails").select("*").order("created_at", { ascending: true }),
      supabase.from("user_app_permissions").select("*"),
    ]);
    const r = (rowData as AllowedEmail[]) ?? [];
    const p = (permData as UserAppPermission[]) ?? [];
    setRows(r);
    setPerms(p);
    const next: Record<string, RowState> = {};
    for (const row of r) {
      next[row.email] = emptyRowState(row.label, p.filter((x) => x.email === row.email).map((x) => x.app_slug));
    }
    setRowState(next);
    setLoading(false);
  }

  useEffect(() => { reload(); }, []);

  function patchRowState(email: string, patch: Partial<RowState>) {
    setRowState((s) => ({ ...s, [email]: { ...s[email], ...patch } }));
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    const email = addEmail.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) { setAddError("Enter a valid email."); return; }
    setAdding(true);
    const { error } = await supabase.from("allowed_emails").insert({
      email, label: addLabel.trim() || null, is_admin: false, enabled: true,
    });
    setAdding(false);
    if (error) {
      setAddError(error.code === "23505" ? "That email is already on the list." : error.message);
      return;
    }
    setAddEmail(""); setAddLabel("");
    await reload();
  }

  async function toggleEnabled(row: AllowedEmail) {
    await supabase.from("allowed_emails").update({ enabled: !row.enabled }).eq("email", row.email);
    await reload();
  }

  async function commitLabel(row: AllowedEmail) {
    const draft = rowState[row.email].labelDraft.trim() || null;
    await supabase.from("allowed_emails").update({ label: draft }).eq("email", row.email);
    await reload();
  }

  async function remove(row: AllowedEmail) {
    if (!confirm(`Remove ${row.email}?`)) return;
    await supabase.from("allowed_emails").delete().eq("email", row.email);
    await reload();
  }

  async function savePerms(row: AllowedEmail) {
    const draft = rowState[row.email].permsDraft;
    const existing = new Set(perms.filter((p) => p.email === row.email).map((p) => p.app_slug));
    const toAdd = [...draft].filter((s) => !existing.has(s)).map((s) => ({ email: row.email, app_slug: s }));
    const toRemove = [...existing].filter((s) => !draft.has(s));
    if (toAdd.length)    await supabase.from("user_app_permissions").insert(toAdd);
    if (toRemove.length) await supabase.from("user_app_permissions").delete().eq("email", row.email).in("app_slug", toRemove);
    await reload();
  }

  return (
    <div data-testid="user-manager-root">
      <h1 style={{ marginTop: 0 }}>User Manager</h1>

      <form onSubmit={handleAdd} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <input data-testid="um-add-email" style={inputCss} placeholder="email@example.com" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} />
        <input data-testid="um-add-label" style={inputCss} placeholder="Label (optional)" value={addLabel} onChange={(e) => setAddLabel(e.target.value)} />
        <button data-testid="um-add-submit" style={btnCss} type="submit" disabled={adding}>{adding ? "Adding…" : "Add user"}</button>
      </form>
      {addError && <div data-testid="um-add-error" style={{ color: "#f87171", marginTop: 8 }}>{addError}</div>}

      {loading ? (
        <div style={{ marginTop: 24, color: "#a1a1aa" }}>Loading…</div>
      ) : (
        <table style={tableCss}>
          <thead>
            <tr>
              <th style={thtdCss}>Email</th>
              <th style={thtdCss}>Label</th>
              <th style={thtdCss}>Admin</th>
              <th style={thtdCss}>Enabled</th>
              <th style={thtdCss}>Last sign-in</th>
              <th style={thtdCss}>Apps</th>
              <th style={thtdCss}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const st = rowState[r.email];
              return (
                <tr key={r.email} data-testid={`um-row-${r.email}`}>
                  <td style={thtdCss}>{r.email}</td>
                  <td style={thtdCss}>
                    {st.editing ? (
                      <input
                        data-testid="um-edit-label-input"
                        style={inputCss}
                        autoFocus
                        value={st.labelDraft}
                        onChange={(e) => patchRowState(r.email, { labelDraft: e.target.value })}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitLabel(r); } if (e.key === "Escape") patchRowState(r.email, { editing: false, labelDraft: r.label ?? "" }); }}
                        onBlur={() => commitLabel(r)}
                      />
                    ) : (
                      <>
                        <span data-testid="um-cell-label" onClick={() => patchRowState(r.email, { editing: true })} style={{ cursor: "pointer" }}>
                          {r.label ?? "—"}
                        </span>
                        {" "}
                        <button data-testid="um-edit-label" style={linkBtn} onClick={() => patchRowState(r.email, { editing: true })}>edit</button>
                      </>
                    )}
                  </td>
                  <td style={thtdCss}>{r.is_admin ? "yes" : "no"}</td>
                  <td style={thtdCss}>
                    <button data-testid="um-toggle-enabled" style={linkBtn} onClick={() => toggleEnabled(r)} disabled={r.is_admin}>
                      {r.enabled ? "disable" : "enable"}
                    </button>
                  </td>
                  <td style={thtdCss}>{r.last_sign_in_at ? new Date(r.last_sign_in_at).toLocaleString() : "never"}</td>
                  <td style={thtdCss}>
                    <button data-testid="um-perms-toggle" style={linkBtn} onClick={() => patchRowState(r.email, { permsOpen: !st.permsOpen })}>
                      {st.permsDraft.size} app{st.permsDraft.size === 1 ? "" : "s"}
                    </button>
                    {st.permsOpen && (
                      <div style={popoverCss}>
                        {APPS.map((a) => (
                          <label key={a.slug} style={{ display: "block", padding: "4px 0" }}>
                            <input
                              data-testid={`um-perms-checkbox-${a.slug}`}
                              type="checkbox"
                              checked={st.permsDraft.has(a.slug)}
                              onChange={(e) => {
                                const next = new Set(st.permsDraft);
                                if (e.target.checked) next.add(a.slug); else next.delete(a.slug);
                                patchRowState(r.email, { permsDraft: next });
                              }}
                            /> {a.name} <span style={{ color: "#71717a" }}>({a.slug})</span>
                          </label>
                        ))}
                        <button data-testid="um-perms-save" style={{ ...btnCss, marginTop: 8 }} onClick={() => savePerms(r)}>Save</button>
                      </div>
                    )}
                  </td>
                  <td style={thtdCss}>
                    {!r.is_admin && (
                      <button data-testid="um-remove" style={dangerBtn} onClick={() => remove(r)}>remove</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
