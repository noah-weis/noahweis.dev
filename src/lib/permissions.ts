import type { AllowedEmail, UserAppPermission } from "./types";
import type { AppDef } from "../apps/registry";

export function canAccessApp(
  user: AllowedEmail | null,
  perms: UserAppPermission[],
  app: AppDef,
): boolean {
  if (!user || !user.enabled) return false;
  switch (app.accessMode) {
    case "admin":
      return user.is_admin;
    case "allowlist":
      return true;
    case "grant":
      return user.is_admin || perms.some((p) => p.app_slug === app.slug);
  }
}
