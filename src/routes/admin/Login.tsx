import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/auth";
import s from "../../styles/login.module.css";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function Login() {
  const navigate = useNavigate();
  const { session, loading } = useSession();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate("/admin/dashboard", { replace: true });
  }, [loading, session, navigate]);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim().toLowerCase();
    if (!EMAIL_RE.test(trimmed)) {
      setError("Enter a valid email.");
      return;
    }
    setBusy(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/request-otp`;
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ email: trimmed }),
      });
      if (!r.ok) {
        setError("Couldn't send code. Try again.");
        return;
      }
      setEmail(trimmed);
      setStep("code");
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { data, error: vErr } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: "email",
      });
      if (vErr || !data.session) {
        setError("That code didn't work. Try again or restart.");
        return;
      }
      // Write the signed_in event. The trigger will bump last_sign_in_at on allowed_emails.
      await supabase.from("events").insert({
        email,
        app_slug: null,
        event_name: "signed_in",
        payload: {},
      });
      navigate("/admin/dashboard", { replace: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={s.shell}>
      <div className={s.card}>
        {step === "email" ? (
          <form onSubmit={sendCode}>
            <h1 className={s.title}>noahweis.dev admin</h1>
            <p className={s.subtitle}>Enter your email to receive a 6-digit code.</p>
            <input
              data-testid="login-email-input"
              className={s.input}
              type="text"
              inputMode="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
            <button data-testid="login-send-code" className={s.button} type="submit" disabled={busy}>
              {busy ? "Sending…" : "Send code"}
            </button>
            {error && <div data-testid="login-error" className={s.error}>{error}</div>}
          </form>
        ) : (
          <form onSubmit={verify}>
            <h1 className={s.title}>Check your email</h1>
            <p data-testid="login-status" className={s.subtitle}>
              Sent a code to <strong>{email}</strong>.
            </p>
            <input
              data-testid="login-code-input"
              className={`${s.input} ${s.codeInput}`}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="------"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              autoFocus
            />
            <button data-testid="login-verify" className={s.button} type="submit" disabled={busy || code.length !== 6}>
              {busy ? "Verifying…" : "Verify"}
            </button>
            {error && <div data-testid="login-error" className={s.error}>{error}</div>}
          </form>
        )}
      </div>
    </div>
  );
}
