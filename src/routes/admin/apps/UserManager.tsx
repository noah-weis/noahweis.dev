import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import type { AllowedEmail } from "../../../lib/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const tableCss: React.CSSProperties = { width: "100%", borderCollapse: "collapse", marginTop: 24 };
const thtdCss:  React.CSSProperties = { padding: "10px 12px", borderBottom: "1px solid #27272a", textAlign: "left", fontSize: 14 };
const inputCss: React.CSSProperties = { padding: "8px 10px", background: "#0e0e10", border: "1px solid #3f3f46", borderRadius: 4, color: "#f5f5f7", fontSize: 14 };
const btnCss:   React.CSSProperties = { padding: "8px 14px", background: "#4f46e5", color: "white", border: 0, borderRadius: 4, cursor: "pointer", fontSize: 14 };

export function UserManager() {
  const [rows, setRows] = useState<AllowedEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [addEmail, setAddEmail] = useState("");
  const [addLabel, setAddLabel] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  async function reload() {
    setLoading(true);
    const { data } = await supabase.from("allowed_emails").select("*").order("created_at", { ascending: true });
    setRows((data as AllowedEmail[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { reload(); }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    const email = addEmail.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) { setAddError("Enter a valid email."); return; }
    setAdding(true);
    const { error } = await supabase.from("allowed_emails").insert({
      email,
      label: addLabel.trim() || null,
      is_admin: false,
      enabled: true,
    });
    setAdding(false);
    if (error) {
      setAddError(error.code === "23505" ? "That email is already on the list." : error.message);
      return;
    }
    setAddEmail("");
    setAddLabel("");
    await reload();
  }

  return (
    <div data-testid="user-manager-root">
      <h1 style={{ marginTop: 0 }}>User Manager</h1>

      <form onSubmit={handleAdd} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <input data-testid="um-add-email" style={inputCss} placeholder="email@example.com" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} />
        <input data-testid="um-add-label" style={inputCss} placeholder="Label (optional)" value={addLabel} onChange={(e) => setAddLabel(e.target.value)} />
        <button data-testid="um-add-submit" style={btnCss} type="submit" disabled={adding}>
          {adding ? "Adding…" : "Add user"}
        </button>
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
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.email} data-testid={`um-row-${r.email}`}>
                <td style={thtdCss}>{r.email}</td>
                <td style={thtdCss} data-testid="um-cell-label">{r.label ?? "—"}</td>
                <td style={thtdCss}>{r.is_admin ? "yes" : "no"}</td>
                <td style={thtdCss}>{r.enabled ? "yes" : "no"}</td>
                <td style={thtdCss}>{r.last_sign_in_at ? new Date(r.last_sign_in_at).toLocaleString() : "never"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
