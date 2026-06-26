export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_analyses: {
        Row: {
          ai_output: Json | null
          analysis_id: string
          coaching_notes: string | null
          created_at: string
          entry_score: number | null
          model_name: string | null
          model_provider: string | null
          prompt_snapshot: string | null
          prompt_version_id: string | null
          stage: Database["public"]["Enums"]["analysis_stage"]
          trade_id: string
          verdict: Database["public"]["Enums"]["verdict_type"] | null
        }
        Insert: {
          ai_output?: Json | null
          analysis_id?: string
          coaching_notes?: string | null
          created_at?: string
          entry_score?: number | null
          model_name?: string | null
          model_provider?: string | null
          prompt_snapshot?: string | null
          prompt_version_id?: string | null
          stage: Database["public"]["Enums"]["analysis_stage"]
          trade_id: string
          verdict?: Database["public"]["Enums"]["verdict_type"] | null
        }
        Update: {
          ai_output?: Json | null
          analysis_id?: string
          coaching_notes?: string | null
          created_at?: string
          entry_score?: number | null
          model_name?: string | null
          model_provider?: string | null
          prompt_snapshot?: string | null
          prompt_version_id?: string | null
          stage?: Database["public"]["Enums"]["analysis_stage"]
          trade_id?: string
          verdict?: Database["public"]["Enums"]["verdict_type"] | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_analyses_prompt_version_id_fkey"
            columns: ["prompt_version_id"]
            isOneToOne: false
            referencedRelation: "prompt_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_analyses_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["trade_id"]
          },
        ]
      }
      job_queue: {
        Row: {
          attempts: number
          created_at: string
          id: string
          last_error: string | null
          max_attempts: number
          payload: Json
          stage: Database["public"]["Enums"]["processing_step"]
          status: Database["public"]["Enums"]["job_status"]
          trade_id: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          payload?: Json
          stage: Database["public"]["Enums"]["processing_step"]
          status?: Database["public"]["Enums"]["job_status"]
          trade_id: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          payload?: Json
          stage?: Database["public"]["Enums"]["processing_step"]
          status?: Database["public"]["Enums"]["job_status"]
          trade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_queue_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["trade_id"]
          },
        ]
      }
      profile_settings: {
        Row: {
          created_at: string
          custom_prompts: Json
          settings_id: string
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          custom_prompts?: Json
          settings_id?: string
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          custom_prompts?: Json
          settings_id?: string
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      prompt_registry: {
        Row: {
          actual_prompt_text: string
          created_at: string
          id: string
          prompt_type: Database["public"]["Enums"]["prompt_type"]
          version_label: string
        }
        Insert: {
          actual_prompt_text: string
          created_at?: string
          id?: string
          prompt_type: Database["public"]["Enums"]["prompt_type"]
          version_label: string
        }
        Update: {
          actual_prompt_text?: string
          created_at?: string
          id?: string
          prompt_type?: Database["public"]["Enums"]["prompt_type"]
          version_label?: string
        }
        Relationships: []
      }
      reflections: {
        Row: {
          content: string
          created_at: string
          id: string
          is_lesson: boolean
          trade_id: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_lesson?: boolean
          trade_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_lesson?: boolean
          trade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reflections_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["trade_id"]
          },
        ]
      }
      results: {
        Row: {
          close_date: string | null
          closing_price: number | null
          created_at: string
          id: string
          outcome: Database["public"]["Enums"]["outcome_type"]
          result_notes: string | null
          trade_id: string
        }
        Insert: {
          close_date?: string | null
          closing_price?: number | null
          created_at?: string
          id?: string
          outcome: Database["public"]["Enums"]["outcome_type"]
          result_notes?: string | null
          trade_id: string
        }
        Update: {
          close_date?: string | null
          closing_price?: number | null
          created_at?: string
          id?: string
          outcome?: Database["public"]["Enums"]["outcome_type"]
          result_notes?: string | null
          trade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "results_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["trade_id"]
          },
        ]
      }
      screenshots: {
        Row: {
          ai_identified_context: Json | null
          created_at: string
          is_primary: boolean
          screenshot_id: string
          trade_id: string
          url: string
          user_label: string | null
        }
        Insert: {
          ai_identified_context?: Json | null
          created_at?: string
          is_primary?: boolean
          screenshot_id?: string
          trade_id: string
          url: string
          user_label?: string | null
        }
        Update: {
          ai_identified_context?: Json | null
          created_at?: string
          is_primary?: boolean
          screenshot_id?: string
          trade_id?: string
          url?: string
          user_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "screenshots_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["trade_id"]
          },
        ]
      }
      strategy_profiles: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          prompt_config: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          prompt_config?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          prompt_config?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trades: {
        Row: {
          account_size: number | null
          created_at: string
          current_strategy_profile_id: string | null
          direction: string
          entry_price: number | null
          notes: string | null
          pair: string
          processing_error: string | null
          processing_step: Database["public"]["Enums"]["processing_step"]
          risk_pct: number | null
          session: string | null
          stop_loss: number | null
          take_profit: number | null
          trade_id: string
          trade_status: Database["public"]["Enums"]["trade_status"]
          updated_at: string
          user_id: string
          user_override: string | null
        }
        Insert: {
          account_size?: number | null
          created_at?: string
          current_strategy_profile_id?: string | null
          direction: string
          entry_price?: number | null
          notes?: string | null
          pair: string
          processing_error?: string | null
          processing_step?: Database["public"]["Enums"]["processing_step"]
          risk_pct?: number | null
          session?: string | null
          stop_loss?: number | null
          take_profit?: number | null
          trade_id?: string
          trade_status?: Database["public"]["Enums"]["trade_status"]
          updated_at?: string
          user_id: string
          user_override?: string | null
        }
        Update: {
          account_size?: number | null
          created_at?: string
          current_strategy_profile_id?: string | null
          direction?: string
          entry_price?: number | null
          notes?: string | null
          pair?: string
          processing_error?: string | null
          processing_step?: Database["public"]["Enums"]["processing_step"]
          risk_pct?: number | null
          session?: string | null
          stop_loss?: number | null
          take_profit?: number | null
          trade_id?: string
          trade_status?: Database["public"]["Enums"]["trade_status"]
          updated_at?: string
          user_id?: string
          user_override?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trades_current_strategy_profile_id_fkey"
            columns: ["current_strategy_profile_id"]
            isOneToOne: false
            referencedRelation: "strategy_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_logs: {
        Row: {
          analysis_type: Database["public"]["Enums"]["analysis_type"]
          id: string
          timestamp: string
          user_id: string
        }
        Insert: {
          analysis_type: Database["public"]["Enums"]["analysis_type"]
          id?: string
          timestamp?: string
          user_id: string
        }
        Update: {
          analysis_type?: Database["public"]["Enums"]["analysis_type"]
          id?: string
          timestamp?: string
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string
          email: string | null
          subscription_tier: Database["public"]["Enums"]["subscription_tier"]
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          subscription_tier?: Database["public"]["Enums"]["subscription_tier"]
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          subscription_tier?: Database["public"]["Enums"]["subscription_tier"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      owns_trade: { Args: { _trade_id: string }; Returns: boolean }
    }
    Enums: {
      analysis_stage: "BLIND" | "COMPARATIVE" | "VERDICT"
      analysis_type: "PRE" | "POST"
      job_status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED"
      outcome_type: "WIN" | "LOSS" | "BREAKEVEN" | "CANCELLED"
      processing_step:
        | "PENDING"
        | "BLIND"
        | "STRATEGY"
        | "VALIDATION"
        | "LEARNING"
        | "VERDICT"
        | "EDUCATION"
        | "COACH"
        | "COMPLETED"
        | "FAILED"
      prompt_type: "PRE" | "POST" | "VERDICT" | "COACHING"
      subscription_tier: "FREE" | "PRO" | "ELITE"
      trade_status:
        | "DRAFT"
        | "PRE_ANALYSIS"
        | "PRE_ANALYZED"
        | "POST_DRAFT"
        | "POST_ANALYSIS"
        | "POST_ANALYZED"
        | "JOURNALED"
        | "DELETED"
      verdict_type: "APPROVED" | "DISQUALIFIED" | "NEUTRAL"
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
  public: {
    Enums: {
      analysis_stage: ["BLIND", "COMPARATIVE", "VERDICT"],
      analysis_type: ["PRE", "POST"],
      job_status: ["QUEUED", "RUNNING", "SUCCEEDED", "FAILED"],
      outcome_type: ["WIN", "LOSS", "BREAKEVEN", "CANCELLED"],
      processing_step: [
        "PENDING",
        "BLIND",
        "STRATEGY",
        "VALIDATION",
        "LEARNING",
        "VERDICT",
        "EDUCATION",
        "COACH",
        "COMPLETED",
        "FAILED",
      ],
      prompt_type: ["PRE", "POST", "VERDICT", "COACHING"],
      subscription_tier: ["FREE", "PRO", "ELITE"],
      trade_status: [
        "DRAFT",
        "PRE_ANALYSIS",
        "PRE_ANALYZED",
        "POST_DRAFT",
        "POST_ANALYSIS",
        "POST_ANALYZED",
        "JOURNALED",
        "DELETED",
      ],
      verdict_type: ["APPROVED", "DISQUALIFIED", "NEUTRAL"],
    },
  },
} as const
