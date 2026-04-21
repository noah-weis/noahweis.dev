import { useEffect, useState } from "react";
import { useSession, useCurrentUserRow } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { APPS } from "../../apps/registry";
import { AppCard } from "../../apps/AppCard";
import { canAccessApp } from "../../lib/permissions";
import type { UserAppPermission } from "../../lib/types";
import s from "../../styles/admin.module.css";

export function Dashboard() {
  const { session } = useSession();
  const { row } = useCurrentUserRow(session);
  const [perms, setPerms] = useState<UserAppPermission[]>([]);

  useEffect(() => {
    if (!session) return;
    supabase
      .from("user_app_permissions")
      .select("*")
      .eq("email", session.user.email!)
      .then(({ data }) => setPerms((data as UserAppPermission[]) ?? []));
  }, [session?.user.id]);

  const visible = APPS.filter((a) => canAccessApp(row, perms, a));

  return (
    <div data-testid="dashboard-root">
      <h1 className={s.pageTitle}>Dashboard</h1>
      {visible.length === 0 ? (
        <div data-testid="dashboard-empty" className={s.emptyState}>
          You don't have access to any apps yet. Ask the admin to grant you permissions.
        </div>
      ) : (
        <div className={s.cardGrid}>
          {visible.map((app) => <AppCard key={app.slug} app={app} />)}
        </div>
      )}
    </div>
  );
}
