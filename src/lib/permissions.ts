import type { AllowedEmail, UserAppPermission } from "./types";
import type { AppDef } from "../apps/registry";

export function canAccessApp(
  user: AllowedEmail | null,
  perms: UserAppPermission[],
  app: AppDef,
): boolean {
  if (!user || !user.enabled) return false;
  if (user.is_admin) return true;
  if (app.adminOnly) return false;
  return perms.some((p) => p.app_slug === app.slug);
}
