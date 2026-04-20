import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSession, useCurrentUserRow } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { APPS } from "./registry";
import { canAccessApp } from "../lib/permissions";
import type { UserAppPermission } from "../lib/types";

export function RequireApp() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { session, loading: sessionLoading } = useSession();
  const { row, loading: rowLoading } = useCurrentUserRow(session);
  const [perms, setPerms] = useState<UserAppPermission[] | null>(null);

  useEffect(() => {
    if (!session) return;
    supabase
      .from("user_app_permissions")
      .select("*")
      .eq("email", session.user.email!)
      .then(({ data }) => setPerms((data as UserAppPermission[]) ?? []));
  }, [session?.user.id]);

  const app = APPS.find((a) => a.slug === slug);

  useEffect(() => {
    if (sessionLoading || rowLoading || perms === null) return;
    if (!app)                                navigate("/admin/dashboard", { replace: true });
    else if (!canAccessApp(row, perms, app)) navigate("/admin/dashboard", { replace: true });
  }, [sessionLoading, rowLoading, perms, app, row, navigate]);

  if (sessionLoading || rowLoading || perms === null) return <div>Loading…</div>;
  if (!app) return null;
  if (!canAccessApp(row, perms, app)) return null;

  const C = app.component;
  return <C />;
}
