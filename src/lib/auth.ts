import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { AllowedEmail } from "./types";

export function useSession(): { session: Session | null; loading: boolean } {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setLoading(false);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, loading };
}

export function useCurrentUserRow(session: Session | null): {
  row: AllowedEmail | null;
  loading: boolean;
} {
  const [row, setRow] = useState<AllowedEmail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) {
      setRow(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from("allowed_emails")
      .select("*")
      .eq("email", session.user.email!)
      .maybeSingle()
      .then(({ data }) => {
        setRow(data as AllowedEmail | null);
        setLoading(false);
      });
  }, [session?.user.id]);

  return { row, loading };
}

export async function signOut(): Promise<void> {
  await supabase.from("events").insert({
    email: (await supabase.auth.getSession()).data.session?.user.email ?? null,
    app_slug: null,
    event_name: "signed_out",
    payload: {},
  });
  await supabase.auth.signOut();
}
