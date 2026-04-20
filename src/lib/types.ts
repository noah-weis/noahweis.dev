export type AllowedEmail = {
  email: string;
  label: string | null;
  is_admin: boolean;
  enabled: boolean;
  created_at: string;
  last_sign_in_at: string | null;
};

export type UserAppPermission = {
  email: string;
  app_slug: string;
};

export type EventRow = {
  id: number;
  email: string | null;
  app_slug: string | null;
  event_name: string;
  payload: Record<string, unknown>;
  created_at: string;
};

// Minimal Database type. Replaced after Task 2 runs `supabase gen types typescript`.
export type Database = {
  public: {
    Tables: {
      allowed_emails: { Row: AllowedEmail; Insert: Partial<AllowedEmail> & { email: string }; Update: Partial<AllowedEmail> };
      user_app_permissions: { Row: UserAppPermission; Insert: UserAppPermission; Update: Partial<UserAppPermission> };
      events: { Row: EventRow; Insert: Omit<EventRow, "id" | "created_at"> & Partial<Pick<EventRow, "created_at">>; Update: Partial<EventRow> };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
