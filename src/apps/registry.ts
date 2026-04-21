import type { ComponentType } from "react";
import { UserManager } from "../routes/admin/apps/UserManager";
import { Analytics }   from "../routes/admin/apps/Analytics";
import { MenuLens }    from "../routes/admin/apps/MenuLens";

export type AppDef = {
  slug: string;
  name: string;
  description: string;
  adminOnly: boolean;
  component: ComponentType;
};

export const APPS: AppDef[] = [
  {
    slug: "users",
    name: "User Manager",
    description: "Grant or revoke access for collaborators.",
    adminOnly: true,
    component: UserManager,
  },
  {
    slug: "analytics",
    name: "Analytics",
    description: "Sign-ins and per-app event activity.",
    adminOnly: true,
    component: Analytics,
  },
  {
    slug: "menu-lens",
    name: "Menu Lens",
    description: "Snap a menu photo — get translated, Grubhub-style items with photos.",
    adminOnly: false,
    component: MenuLens,
  },
];
