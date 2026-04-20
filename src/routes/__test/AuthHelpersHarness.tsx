import { useState } from "react";
import { useSession, useCurrentUserRow } from "../../lib/auth";
import { supabase } from "../../lib/supabase";

export function AuthHelpersHarness() {
  const { session } = useSession();
  const { row } = useCurrentUserRow(session);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");

  async function signIn() {
    await supabase.auth.verifyOtp({ email, token: otp, type: "email" });
  }

  return (
    <div>
      <div data-testid="session-state">{session ? session.user.email : "null"}</div>
      <div data-testid="row-state">{row ? JSON.stringify(row) : "null"}</div>
      <input data-testid="email-input" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input data-testid="otp-input" value={otp} onChange={(e) => setOtp(e.target.value)} />
      <button data-testid="sign-in" onClick={signIn}>Sign in</button>
    </div>
  );
}
