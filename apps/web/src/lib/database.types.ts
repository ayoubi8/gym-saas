// database.types.ts — generated from Phase 1A schema (docs/DATA-MODEL.md)
// Regenerate: supabase gen types typescript --local > apps/web/src/lib/database.types.ts
// DO NOT EDIT manually — run the command above after any schema change.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          gym_id: string | null
          id: number
          new_value: Json | null
          old_value: Json | null
          reason: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          gym_id?: string | null
          id?: never
          new_value?: Json | null
          old_value?: Json | null
          reason?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          gym_id?: string | null
          id?: never
          new_value?: Json | null
          old_value?: Json | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          }
        ]
      }
      extensions: {
        Row: {
          created_at: string
          created_by: string | null
          days_added: number
          gym_id: string
          id: string
          note: string | null
          reason: Database["public"]["Enums"]["extension_reason"]
          subscription_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          days_added: number
          gym_id: string
          id?: string
          note?: string | null
          reason: Database["public"]["Enums"]["extension_reason"]
          subscription_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          days_added?: number
          gym_id?: string
          id?: string
          note?: string | null
          reason?: Database["public"]["Enums"]["extension_reason"]
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "extensions_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extensions_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          }
        ]
      }
      gym_settings: {
        Row: {
          enabled_channels: Database["public"]["Enums"]["channel"][]
          gym_id: string
          onboarding_completed: boolean
          reminder_days_before: number
          reminder_on_expiry_day: boolean
          reminders_enabled: boolean
          updated_at: string
        }
        Insert: {
          enabled_channels?: Database["public"]["Enums"]["channel"][]
          gym_id: string
          onboarding_completed?: boolean
          reminder_days_before?: number
          reminder_on_expiry_day?: boolean
          reminders_enabled?: boolean
          updated_at?: string
        }
        Update: {
          enabled_channels?: Database["public"]["Enums"]["channel"][]
          gym_id?: string
          onboarding_completed?: boolean
          reminder_days_before?: number
          reminder_on_expiry_day?: boolean
          reminders_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_settings_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: true
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          }
        ]
      }
      gyms: {
        Row: {
          city: string | null
          created_at: string
          created_by: string | null
          default_language: Database["public"]["Enums"]["lang"]
          id: string
          name: string
          status: Database["public"]["Enums"]["gym_status"]
          suspended_at: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          created_by?: string | null
          default_language?: Database["public"]["Enums"]["lang"]
          id?: string
          name: string
          status?: Database["public"]["Enums"]["gym_status"]
          suspended_at?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          city?: string | null
          created_at?: string
          created_by?: string | null
          default_language?: Database["public"]["Enums"]["lang"]
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["gym_status"]
          suspended_at?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      import_batches: {
        Row: {
          created_at: string
          created_by: string | null
          duplicate_policy: Database["public"]["Enums"]["duplicate_policy"] | null
          duplicate_rows: number | null
          error_rows: number | null
          failed_count: number | null
          failed_rows_path: string | null
          filename: string
          gym_id: string
          id: string
          imported_count: number | null
          mapping: Json | null
          skipped_count: number | null
          status: Database["public"]["Enums"]["import_status"]
          storage_path: string | null
          total_rows: number | null
          valid_rows: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          duplicate_policy?: Database["public"]["Enums"]["duplicate_policy"] | null
          duplicate_rows?: number | null
          error_rows?: number | null
          failed_count?: number | null
          failed_rows_path?: string | null
          filename: string
          gym_id: string
          id?: string
          imported_count?: number | null
          mapping?: Json | null
          skipped_count?: number | null
          status?: Database["public"]["Enums"]["import_status"]
          storage_path?: string | null
          total_rows?: number | null
          valid_rows?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          duplicate_policy?: Database["public"]["Enums"]["duplicate_policy"] | null
          duplicate_rows?: number | null
          error_rows?: number | null
          failed_count?: number | null
          failed_rows_path?: string | null
          filename?: string
          gym_id?: string
          id?: string
          imported_count?: number | null
          mapping?: Json | null
          skipped_count?: number | null
          status?: Database["public"]["Enums"]["import_status"]
          storage_path?: string | null
          total_rows?: number | null
          valid_rows?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "import_batches_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          }
        ]
      }
      import_rows: {
        Row: {
          batch_id: string
          gym_id: string
          id: string
          normalized: Json | null
          raw: Json
          reason: string | null
          row_no: number
          status: Database["public"]["Enums"]["import_row_status"]
        }
        Insert: {
          batch_id: string
          gym_id: string
          id?: string
          normalized?: Json | null
          raw: Json
          reason?: string | null
          row_no: number
          status?: Database["public"]["Enums"]["import_row_status"]
        }
        Update: {
          batch_id?: string
          gym_id?: string
          id?: string
          normalized?: Json | null
          raw?: Json
          reason?: string | null
          row_no?: number
          status?: Database["public"]["Enums"]["import_row_status"]
        }
        Relationships: [
          {
            foreignKeyName: "import_rows_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_rows_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          }
        ]
      }
      members: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          full_name: string
          gym_id: string
          id: string
          language: Database["public"]["Enums"]["lang"] | null
          phone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          full_name: string
          gym_id: string
          id?: string
          language?: Database["public"]["Enums"]["lang"] | null
          phone: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          full_name?: string
          gym_id?: string
          id?: string
          language?: Database["public"]["Enums"]["lang"] | null
          phone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "members_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          }
        ]
      }
      payments: {
        Row: {
          amount_dzd: number
          created_at: string
          created_by: string | null
          edited_at: string | null
          flagged_duplicate: boolean
          gym_id: string
          id: string
          member_id: string
          method: Database["public"]["Enums"]["payment_method"]
          note: string | null
          paid_on: string
          receipt_no: number | null
          subscription_id: string
          updated_at: string
        }
        Insert: {
          amount_dzd: number
          created_at?: string
          created_by?: string | null
          edited_at?: string | null
          flagged_duplicate?: boolean
          gym_id: string
          id?: string
          member_id: string
          method?: Database["public"]["Enums"]["payment_method"]
          note?: string | null
          paid_on?: string
          receipt_no?: number | null
          subscription_id: string
          updated_at?: string
        }
        Update: {
          amount_dzd?: number
          created_at?: string
          created_by?: string | null
          edited_at?: string | null
          flagged_duplicate?: boolean
          gym_id?: string
          id?: string
          member_id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          note?: string | null
          paid_on?: string
          receipt_no?: number | null
          subscription_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          }
        ]
      }
      pauses: {
        Row: {
          created_at: string
          created_by: string | null
          days_added: number | null
          gym_id: string
          id: string
          note: string | null
          planned_end_date: string | null
          reason: Database["public"]["Enums"]["pause_reason"]
          resumed_by: string | null
          resumed_on: string | null
          start_date: string
          subscription_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          days_added?: number | null
          gym_id: string
          id?: string
          note?: string | null
          planned_end_date?: string | null
          reason: Database["public"]["Enums"]["pause_reason"]
          resumed_by?: string | null
          resumed_on?: string | null
          start_date: string
          subscription_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          days_added?: number | null
          gym_id?: string
          id?: string
          note?: string | null
          planned_end_date?: string | null
          reason?: Database["public"]["Enums"]["pause_reason"]
          resumed_by?: string | null
          resumed_on?: string | null
          start_date?: string
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pauses_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pauses_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          }
        ]
      }
      plans: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          duration_months: number | null
          gym_id: string
          id: string
          name: string
          price_dzd: number
          session_count: number | null
          type: Database["public"]["Enums"]["plan_type"]
          updated_at: string
          validity_days: number | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          duration_months?: number | null
          gym_id: string
          id?: string
          name: string
          price_dzd: number
          session_count?: number | null
          type: Database["public"]["Enums"]["plan_type"]
          updated_at?: string
          validity_days?: number | null
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          duration_months?: number | null
          gym_id?: string
          id?: string
          name?: string
          price_dzd?: number
          session_count?: number | null
          type?: Database["public"]["Enums"]["plan_type"]
          updated_at?: string
          validity_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "plans_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          }
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          gym_id: string | null
          id: string
          language: Database["public"]["Enums"]["lang"]
          last_seen_at: string | null
          phone: string | null
          role: Database["public"]["Enums"]["role_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          gym_id?: string | null
          id: string
          language?: Database["public"]["Enums"]["lang"]
          last_seen_at?: string | null
          phone?: string | null
          role: Database["public"]["Enums"]["role_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          gym_id?: string | null
          id?: string
          language?: Database["public"]["Enums"]["lang"]
          last_seen_at?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["role_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          }
        ]
      }
      receipt_counters: {
        Row: {
          gym_id: string
          last_no: number
        }
        Insert: {
          gym_id: string
          last_no?: number
        }
        Update: {
          gym_id?: string
          last_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "receipt_counters_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: true
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          }
        ]
      }
      reminder_templates: {
        Row: {
          body: string
          created_at: string
          gym_id: string
          id: string
          kind: Database["public"]["Enums"]["reminder_kind"]
          language: Database["public"]["Enums"]["lang"]
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          gym_id: string
          id?: string
          kind: Database["public"]["Enums"]["reminder_kind"]
          language: Database["public"]["Enums"]["lang"]
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          gym_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["reminder_kind"]
          language?: Database["public"]["Enums"]["lang"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminder_templates_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          }
        ]
      }
      reminders: {
        Row: {
          body_rendered: string
          channel: Database["public"]["Enums"]["channel"]
          created_at: string
          created_by: string | null
          error: string | null
          gym_id: string
          id: string
          kind: Database["public"]["Enums"]["reminder_kind"]
          language: Database["public"]["Enums"]["lang"]
          member_id: string
          scheduled_for: string
          sent_at: string | null
          status: Database["public"]["Enums"]["reminder_status"]
          subscription_id: string | null
        }
        Insert: {
          body_rendered: string
          channel: Database["public"]["Enums"]["channel"]
          created_at?: string
          created_by?: string | null
          error?: string | null
          gym_id: string
          id?: string
          kind: Database["public"]["Enums"]["reminder_kind"]
          language: Database["public"]["Enums"]["lang"]
          member_id: string
          scheduled_for: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["reminder_status"]
          subscription_id?: string | null
        }
        Update: {
          body_rendered?: string
          channel?: Database["public"]["Enums"]["channel"]
          created_at?: string
          created_by?: string | null
          error?: string | null
          gym_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["reminder_kind"]
          language?: Database["public"]["Enums"]["lang"]
          member_id?: string
          scheduled_for?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["reminder_status"]
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reminders_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          }
        ]
      }
      session_logs: {
        Row: {
          created_at: string
          created_by: string | null
          delta: number
          gym_id: string
          id: string
          member_id: string
          note: string | null
          subscription_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          delta: number
          gym_id: string
          id?: string
          member_id: string
          note?: string | null
          subscription_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          delta?: number
          gym_id?: string
          id?: string
          member_id?: string
          note?: string | null
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_logs_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_logs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_logs_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          }
        ]
      }
      subscriptions: {
        Row: {
          cancelled_at: string | null
          created_at: string
          created_by: string | null
          end_date: string | null
          gym_id: string
          id: string
          member_id: string
          plan_id: string | null
          plan_name_snapshot: string
          plan_type_snapshot: Database["public"]["Enums"]["plan_type"]
          price_dzd: number
          renewed_from_id: string | null
          sessions_remaining: number | null
          sessions_total: number | null
          start_date: string
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          gym_id: string
          id?: string
          member_id: string
          plan_id?: string | null
          plan_name_snapshot: string
          plan_type_snapshot: Database["public"]["Enums"]["plan_type"]
          price_dzd: number
          renewed_from_id?: string | null
          sessions_remaining?: number | null
          sessions_total?: number | null
          start_date: string
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          gym_id?: string
          id?: string
          member_id?: string
          plan_id?: string | null
          plan_name_snapshot?: string
          plan_type_snapshot?: Database["public"]["Enums"]["plan_type"]
          price_dzd?: number
          renewed_from_id?: string | null
          sessions_remaining?: number | null
          sessions_total?: number | null
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_renewed_from_id_fkey"
            columns: ["renewed_from_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          }
        ]
      }
      sync_log: {
        Row: {
          created_at: string
          device_id: string | null
          error: string | null
          gym_id: string | null
          id: string
          ops_count: number | null
          outcome: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          error?: string | null
          gym_id?: string | null
          id?: string
          ops_count?: number | null
          outcome: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          device_id?: string | null
          error?: string | null
          gym_id?: string | null
          id?: string
          ops_count?: number | null
          outcome?: string
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      member_balance: {
        Row: {
          gym_id: string | null
          member_id: string | null
          total_owing: number | null
        }
        Relationships: []
      }
      member_current_subscription: {
        Row: {
          cancelled_at: string | null
          created_at: string | null
          created_by: string | null
          end_date: string | null
          gym_id: string | null
          id: string | null
          member_id: string | null
          plan_id: string | null
          plan_name_snapshot: string | null
          plan_type_snapshot: Database["public"]["Enums"]["plan_type"] | null
          price_dzd: number | null
          renewed_from_id: string | null
          sessions_remaining: number | null
          sessions_total: number | null
          start_date: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      member_status: {
        Row: {
          end_date: string | null
          gym_id: string | null
          has_subscription: boolean | null
          is_frozen: boolean | null
          member_id: string | null
          plan_type_snapshot: Database["public"]["Enums"]["plan_type"] | null
          sessions_remaining: number | null
          status: string | null
          subscription_id: string | null
        }
        Relationships: []
      }
      subscription_balance: {
        Row: {
          gym_id: string | null
          member_id: string | null
          paid: number | null
          price_dzd: number | null
          remaining: number | null
          subscription_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      create_import_batch: {
        Args: {
          p_id: string
          p_gym_id: string
          p_filename: string
          p_storage_path?: string
        }
        Returns: Database["public"]["Tables"]["import_batches"]["Row"]
      }
      create_member: {
        Args: {
          p_id: string
          p_gym_id: string
          p_full_name: string
          p_phone: string
          p_language?: Database["public"]["Enums"]["lang"]
        }
        Returns: Database["public"]["Tables"]["members"]["Row"]
      }
      current_gym_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      dashboard_summary: {
        Args: { p_gym_id: string }
        Returns: Json
      }
      deduct_session: {
        Args: {
          p_id: string
          p_gym_id: string
          p_subscription_id: string
          p_note?: string
        }
        Returns: Database["public"]["Tables"]["subscriptions"]["Row"]
      }
      delete_payment: {
        Args: { p_id: string; p_reason: string }
        Returns: undefined
      }
      derive_end_date: {
        Args: {
          p_type: Database["public"]["Enums"]["plan_type"]
          p_start: string
          p_duration_months: number
          p_validity_days: number
        }
        Returns: string
      }
      edit_payment: {
        Args: {
          p_id: string
          p_amount_dzd: number
          p_paid_on: string
          p_method: Database["public"]["Enums"]["payment_method"]
          p_note: string
          p_reason: string
        }
        Returns: Database["public"]["Tables"]["payments"]["Row"]
      }
      extend_subscription: {
        Args: {
          p_id: string
          p_gym_id: string
          p_subscription_id: string
          p_days: number
          p_reason: Database["public"]["Enums"]["extension_reason"]
          p_note?: string
        }
        Returns: Database["public"]["Tables"]["subscriptions"]["Row"]
      }
      gym_is_active: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      import_commit: {
        Args: {
          p_batch_id: string
          p_policy: Database["public"]["Enums"]["duplicate_policy"]
        }
        Returns: undefined
      }
      import_validate: {
        Args: { p_batch_id: string }
        Returns: undefined
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      log_manual_reminder: {
        Args: {
          p_id: string
          p_gym_id: string
          p_member_id: string
          p_subscription_id: string
          p_channel: Database["public"]["Enums"]["channel"]
          p_language: Database["public"]["Enums"]["lang"]
          p_body_rendered: string
          p_scheduled_for: string
        }
        Returns: Database["public"]["Tables"]["reminders"]["Row"]
      }
      pause_subscription: {
        Args: {
          p_id: string
          p_subscription_id: string
          p_gym_id: string
          p_start_date: string
          p_reason: Database["public"]["Enums"]["pause_reason"]
          p_note?: string
          p_planned_end?: string
        }
        Returns: Database["public"]["Tables"]["pauses"]["Row"]
      }
      record_payment: {
        Args: {
          p_id: string
          p_subscription_id: string
          p_amount_dzd: number
          p_paid_on?: string
          p_method?: Database["public"]["Enums"]["payment_method"]
          p_note?: string
        }
        Returns: Database["public"]["Tables"]["payments"]["Row"]
      }
      reminders_due: {
        Args: { p_gym_id: string; p_date: string }
        Returns: Array<{
          member_id: string
          subscription_id: string
          end_date: string
          full_name: string
          phone: string
          language: Database["public"]["Enums"]["lang"]
          kind: Database["public"]["Enums"]["reminder_kind"]
        }>
      }
      renew_subscription: {
        Args: {
          p_id: string
          p_gym_id: string
          p_member_id: string
          p_plan_id: string
          p_first_payment?: Json
        }
        Returns: Database["public"]["Tables"]["subscriptions"]["Row"]
      }
      resume_subscription: {
        Args: { p_pause_id: string; p_resumed_on: string }
        Returns: Database["public"]["Tables"]["subscriptions"]["Row"]
      }
      save_import_mapping: {
        Args: { p_batch_id: string; p_mapping: Json }
        Returns: undefined
      }
      set_plan_active: {
        Args: { p_id: string; p_active: boolean }
        Returns: undefined
      }
      update_gym_settings: {
        Args: {
          p_gym_id: string
          p_reminders_enabled: boolean
          p_reminder_days_before: number
          p_reminder_on_expiry_day: boolean
          p_enabled_channels: Database["public"]["Enums"]["channel"][]
          p_onboarding_completed?: boolean
        }
        Returns: Database["public"]["Tables"]["gym_settings"]["Row"]
      }
      update_member: {
        Args: {
          p_id: string
          p_full_name: string
          p_phone: string
          p_language?: Database["public"]["Enums"]["lang"]
        }
        Returns: Database["public"]["Tables"]["members"]["Row"]
      }
      upsert_plan: {
        Args: {
          p_id: string
          p_gym_id: string
          p_name: string
          p_type: Database["public"]["Enums"]["plan_type"]
          p_price_dzd: number
          p_duration_months?: number
          p_session_count?: number
          p_validity_days?: number
        }
        Returns: Database["public"]["Tables"]["plans"]["Row"]
      }
      upsert_reminder_template: {
        Args: {
          p_id: string
          p_gym_id: string
          p_language: Database["public"]["Enums"]["lang"]
          p_kind: Database["public"]["Enums"]["reminder_kind"]
          p_body: string
        }
        Returns: Database["public"]["Tables"]["reminder_templates"]["Row"]
      }
      assign_subscription: {
        Args: {
          p_id: string
          p_gym_id: string
          p_member_id: string
          p_plan_id: string
          p_start_date: string
          p_first_payment?: Json
        }
        Returns: Database["public"]["Tables"]["subscriptions"]["Row"]
      }
    }
    Enums: {
      channel: "whatsapp" | "sms" | "viber"
      duplicate_policy: "skip" | "update"
      extension_reason: "compensation" | "promotion" | "other"
      gym_status: "active" | "suspended"
      import_row_status: "valid" | "error" | "duplicate" | "imported" | "skipped" | "failed"
      import_status: "uploaded" | "mapped" | "previewed" | "committed" | "failed"
      lang: "ar" | "fr"
      pause_reason: "travel" | "injury" | "ramadan" | "other"
      payment_method: "cash" | "bank_transfer" | "ccp"
      plan_type: "monthly" | "quarterly" | "semiannual" | "annual" | "per_session" | "class_pack"
      reminder_kind: "before_expiry" | "expiry_day" | "manual"
      reminder_status: "pending" | "sent" | "delivered" | "failed"
      role_type: "admin" | "owner"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Convenience type aliases used throughout the frontend
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"]
export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T]
export type Functions<T extends keyof Database["public"]["Functions"]> =
  Database["public"]["Functions"][T]

// Shorthand row types
export type Gym            = Tables<"gyms">
export type Profile        = Tables<"profiles">
export type GymSettings    = Tables<"gym_settings">
export type Member         = Tables<"members">
export type Plan           = Tables<"plans">
export type Subscription   = Tables<"subscriptions">
export type Pause          = Tables<"pauses">
export type Extension      = Tables<"extensions">
export type Payment        = Tables<"payments">
export type Reminder       = Tables<"reminders">
export type ReminderTemplate = Tables<"reminder_templates">
export type AuditLog       = Tables<"audit_log">
export type ImportBatch    = Tables<"import_batches">
export type ImportRow      = Tables<"import_rows">
export type SyncLog        = Tables<"sync_log">
export type SessionLog     = Tables<"session_logs">

// Status type (derived, never stored)
export type MemberStatus = "active" | "frozen" | "expired"
