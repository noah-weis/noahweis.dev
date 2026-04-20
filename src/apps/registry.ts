import type { ComponentType } from "react";
import { UserManager } from "../routes/admin/apps/UserManager";
import { Analytics }   from "../routes/admin/apps/Analytics";

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
];
