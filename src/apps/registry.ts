import type { ComponentType } from "react";
import { UserManager } from "../routes/admin/apps/UserManager";
import { Analytics }   from "../routes/admin/apps/Analytics";
import { MenuLens }    from "../routes/admin/apps/MenuLens";
import { Zap }         from "../routes/admin/apps/zap";

export type AccessMode = "admin" | "allowlist" | "grant";

export type AppDef = {
  slug: string;
  name: string;
  description: string;
  accessMode: AccessMode;
  component: ComponentType;
};

export const APPS: AppDef[] = [
  {
    slug: "users",
    name: "User Manager",
    description: "Grant or revoke access for collaborators.",
    accessMode: "admin",
    component: UserManager,
  },
  {
    slug: "analytics",
    name: "Analytics",
    description: "Sign-ins and per-app event activity.",
    accessMode: "admin",
    component: Analytics,
  },
  {
    slug: "menu-lens",
    name: "Menu Lens",
    description: "Snap a menu photo — get translated, Grubhub-style items with photos.",
    accessMode: "grant",
    component: MenuLens,
  },
  {
    slug: "zap",
    name: "ZAP",
    description: "Split trip expenses with friends.",
    accessMode: "allowlist",
    component: Zap,
  },
];
