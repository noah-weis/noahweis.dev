import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { APPS } from "../../../apps/registry";
import type { AllowedEmail, UserAppPermission } from "../../../lib/types";
import s from "../../../styles/admin.module.css";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    setRowState((st) => ({ ...st, [email]: { ...st[email], ...patch } }));
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
    const toAdd = [...draft].filter((sl) => !existing.has(sl)).map((sl) => ({ email: row.email, app_slug: sl }));
    const toRemove = [...existing].filter((sl) => !draft.has(sl));
    if (toAdd.length)    await supabase.from("user_app_permissions").insert(toAdd);
    if (toRemove.length) await supabase.from("user_app_permissions").delete().eq("email", row.email).in("app_slug", toRemove);
    await reload();
  }

  return (
    <div data-testid="user-manager-root">
      <h1 className={s.pageTitle}>User Manager</h1>

      <form onSubmit={handleAdd} className={s.addForm}>
        <input data-testid="um-add-email" className={s.input} placeholder="email@example.com" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} />
        <input data-testid="um-add-label" className={s.input} placeholder="Label (optional)" value={addLabel} onChange={(e) => setAddLabel(e.target.value)} />
        <button data-testid="um-add-submit" className={s.button} type="submit" disabled={adding}>
          {adding ? "Adding…" : "Add user"}
        </button>
      </form>
      {addError && <div data-testid="um-add-error" className={s.errorMsg}>{addError}</div>}

      {loading ? (
        <div className={s.emptyState}>Loading…</div>
      ) : (
        <table className={s.table}>
          <thead>
            <tr>
              <th>Email</th>
              <th>Label</th>
              <th>Admin</th>
              <th>Enabled</th>
              <th>Last sign-in</th>
              <th>Apps</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const st = rowState[r.email];
              return (
                <tr key={r.email} data-testid={`um-row-${r.email}`}>
                  <td>{r.email}</td>
                  <td>
                    {st.editing ? (
                      <input
                        data-testid="um-edit-label-input"
                        className={s.input}
                        autoFocus
                        value={st.labelDraft}
                        onChange={(e) => patchRowState(r.email, { labelDraft: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { e.preventDefault(); commitLabel(r); }
                          if (e.key === "Escape") patchRowState(r.email, { editing: false, labelDraft: r.label ?? "" });
                        }}
                        onBlur={() => commitLabel(r)}
                      />
                    ) : (
                      <>
                        <span data-testid="um-cell-label" className={s.labelCell} onClick={() => patchRowState(r.email, { editing: true })}>
                          {r.label ?? "—"}
                        </span>
                        {" "}
                        <button data-testid="um-edit-label" className={s.linkButton} onClick={() => patchRowState(r.email, { editing: true })}>edit</button>
                      </>
                    )}
                  </td>
                  <td>{r.is_admin ? "yes" : "no"}</td>
                  <td>
                    <button data-testid="um-toggle-enabled" className={s.linkButton} onClick={() => toggleEnabled(r)} disabled={r.is_admin}>
                      {r.enabled ? "disable" : "enable"}
                    </button>
                  </td>
                  <td>{r.last_sign_in_at ? new Date(r.last_sign_in_at).toLocaleString() : <span className={s.muted}>never</span>}</td>
                  <td>
                    <button data-testid="um-perms-toggle" className={s.linkButton} onClick={() => patchRowState(r.email, { permsOpen: !st.permsOpen })}>
                      {st.permsDraft.size} app{st.permsDraft.size === 1 ? "" : "s"}
                    </button>
                    {st.permsOpen && (
                      <div className={s.popover}>
                        {APPS.map((a) => (
                          <label key={a.slug} className={s.popoverRow}>
                            <input
                              data-testid={`um-perms-checkbox-${a.slug}`}
                              type="checkbox"
                              className={s.checkbox}
                              checked={st.permsDraft.has(a.slug)}
                              onChange={(e) => {
                                const next = new Set(st.permsDraft);
                                if (e.target.checked) next.add(a.slug); else next.delete(a.slug);
                                patchRowState(r.email, { permsDraft: next });
                              }}
                            />
                            {a.name} <span className={s.popoverSlug}>({a.slug})</span>
                          </label>
                        ))}
                        <button data-testid="um-perms-save" className={s.button} style={{ marginTop: 8 }} onClick={() => savePerms(r)}>Save</button>
                      </div>
                    )}
                  </td>
                  <td>
                    {!r.is_admin && (
                      <button data-testid="um-remove" className={s.dangerButton} onClick={() => remove(r)}>remove</button>
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
