import { supabase } from "./supabase";

export async function logEvent(
  eventName: string,
  payload: Record<string, unknown> = {},
  appSlug?: string,
): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return; // silently no-op when signed out
    await supabase.from("events").insert({
      email: session.user.email,
      app_slug: appSlug ?? null,
      event_name: eventName,
      payload,
    });
  } catch {
    // Logging must never break a user action.
  }
}
