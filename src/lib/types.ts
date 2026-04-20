import type { Database as Generated } from "./types.generated";

export type Database = Generated;

export type AllowedEmail = Database["public"]["Tables"]["allowed_emails"]["Row"];
export type UserAppPermission = Database["public"]["Tables"]["user_app_permissions"]["Row"];
export type EventRow = Database["public"]["Tables"]["events"]["Row"];
