export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      allowed_emails: {
        Row: {
          created_at: string
          email: string
          enabled: boolean
          is_admin: boolean
          label: string | null
          last_sign_in_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          enabled?: boolean
          is_admin?: boolean
          label?: string | null
          last_sign_in_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          enabled?: boolean
          is_admin?: boolean
          label?: string | null
          last_sign_in_at?: string | null
        }
        Relationships: []
      }
      events: {
        Row: {
          app_slug: string | null
          created_at: string
          email: string | null
          event_name: string
          id: number
          payload: Json
        }
        Insert: {
          app_slug?: string | null
          created_at?: string
          email?: string | null
          event_name: string
          id?: number
          payload?: Json
        }
        Update: {
          app_slug?: string | null
          created_at?: string
          email?: string | null
          event_name?: string
          id?: number
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "events_email_fkey"
            columns: ["email"]
            isOneToOne: false
            referencedRelation: "allowed_emails"
            referencedColumns: ["email"]
          },
        ]
      }
      user_app_permissions: {
        Row: {
          app_slug: string
          email: string
        }
        Insert: {
          app_slug: string
          email: string
        }
        Update: {
          app_slug?: string
          email?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_app_permissions_email_fkey"
            columns: ["email"]
            isOneToOne: false
            referencedRelation: "allowed_emails"
            referencedColumns: ["email"]
          },
        ]
      }
      zap_receipt_item_members: {
        Row: {
          email: string
          item_id: string
        }
        Insert: {
          email: string
          item_id: string
        }
        Update: {
          email?: string
          item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zap_receipt_item_members_email_fkey"
            columns: ["email"]
            isOneToOne: false
            referencedRelation: "allowed_emails"
            referencedColumns: ["email"]
          },
          {
            foreignKeyName: "zap_receipt_item_members_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "zap_receipt_items"
            referencedColumns: ["id"]
          },
        ]
      }
      zap_receipt_items: {
        Row: {
          amount_cents: number
          description: string
          id: string
          position: number
          receipt_id: string
        }
        Insert: {
          amount_cents: number
          description?: string
          id?: string
          position: number
          receipt_id: string
        }
        Update: {
          amount_cents?: number
          description?: string
          id?: string
          position?: number
          receipt_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zap_receipt_items_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "zap_receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      zap_receipt_members: {
        Row: {
          email: string
          receipt_id: string
        }
        Insert: {
          email: string
          receipt_id: string
        }
        Update: {
          email?: string
          receipt_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zap_receipt_members_email_fkey"
            columns: ["email"]
            isOneToOne: false
            referencedRelation: "allowed_emails"
            referencedColumns: ["email"]
          },
          {
            foreignKeyName: "zap_receipt_members_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "zap_receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      zap_receipts: {
        Row: {
          created_at: string
          id: string
          label: string
          payer_email: string
          receipt_date: string
          split_mode: string
          storage_path: string
          total_cents: number
          trip_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string
          payer_email: string
          receipt_date?: string
          split_mode: string
          storage_path: string
          total_cents: number
          trip_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          payer_email?: string
          receipt_date?: string
          split_mode?: string
          storage_path?: string
          total_cents?: number
          trip_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "zap_receipts_payer_email_fkey"
            columns: ["payer_email"]
            isOneToOne: false
            referencedRelation: "allowed_emails"
            referencedColumns: ["email"]
          },
          {
            foreignKeyName: "zap_receipts_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "zap_trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zap_receipts_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "allowed_emails"
            referencedColumns: ["email"]
          },
        ]
      }
      zap_settlements: {
        Row: {
          amount_cents: number
          created_at: string
          from_email: string
          id: string
          paid_at: string
          to_email: string
          trip_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          from_email: string
          id?: string
          paid_at?: string
          to_email: string
          trip_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          from_email?: string
          id?: string
          paid_at?: string
          to_email?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zap_settlements_from_email_fkey"
            columns: ["from_email"]
            isOneToOne: false
            referencedRelation: "allowed_emails"
            referencedColumns: ["email"]
          },
          {
            foreignKeyName: "zap_settlements_to_email_fkey"
            columns: ["to_email"]
            isOneToOne: false
            referencedRelation: "allowed_emails"
            referencedColumns: ["email"]
          },
          {
            foreignKeyName: "zap_settlements_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "zap_trips"
            referencedColumns: ["id"]
          },
        ]
      }
      zap_trip_members: {
        Row: {
          email: string
          joined_at: string
          trip_id: string
        }
        Insert: {
          email: string
          joined_at?: string
          trip_id: string
        }
        Update: {
          email?: string
          joined_at?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zap_trip_members_email_fkey"
            columns: ["email"]
            isOneToOne: false
            referencedRelation: "allowed_emails"
            referencedColumns: ["email"]
          },
          {
            foreignKeyName: "zap_trip_members_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "zap_trips"
            referencedColumns: ["id"]
          },
        ]
      }
      zap_trips: {
        Row: {
          closed_at: string | null
          created_at: string
          created_by: string
          id: string
          name: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          created_by: string
          id?: string
          name: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          created_by?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "zap_trips_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "allowed_emails"
            referencedColumns: ["email"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auth_email: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      is_enabled_allowed_email: { Args: { p_email: string }; Returns: boolean }
      is_zap_trip_member: { Args: { p_trip_id: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

