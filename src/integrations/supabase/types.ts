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
      capital_events: {
        Row: {
          activated_at: string | null
          amount: number
          created_at: string
          created_by: string | null
          currency: string
          event_type: Database["public"]["Enums"]["capital_event_type"]
          id: string
          idempotency_key: string
          investor_id: string
          notes: string | null
          status: Database["public"]["Enums"]["capital_event_status"]
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          amount: number
          created_at?: string
          created_by?: string | null
          currency?: string
          event_type: Database["public"]["Enums"]["capital_event_type"]
          id?: string
          idempotency_key: string
          investor_id: string
          notes?: string | null
          status?: Database["public"]["Enums"]["capital_event_status"]
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          amount?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          event_type?: Database["public"]["Enums"]["capital_event_type"]
          id?: string
          idempotency_key?: string
          investor_id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["capital_event_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "capital_events_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_ledger: {
        Row: {
          amount: number
          created_at: string
          currency: string
          cycle_id: string | null
          description: string
          event_type: Database["public"]["Enums"]["ledger_event_type"]
          id: string
          idempotency_key: string
          investor_id: string
          metadata: Json
          participation_id: string | null
          reference_id: string | null
          running_balance_after: number | null
          trade_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          cycle_id?: string | null
          description: string
          event_type: Database["public"]["Enums"]["ledger_event_type"]
          id?: string
          idempotency_key: string
          investor_id: string
          metadata?: Json
          participation_id?: string | null
          reference_id?: string | null
          running_balance_after?: number | null
          trade_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          cycle_id?: string | null
          description?: string
          event_type?: Database["public"]["Enums"]["ledger_event_type"]
          id?: string
          idempotency_key?: string
          investor_id?: string
          metadata?: Json
          participation_id?: string | null
          reference_id?: string | null
          running_balance_after?: number | null
          trade_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_ledger_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "investment_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_ledger_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_ledger_participation_id_fkey"
            columns: ["participation_id"]
            isOneToOne: false
            referencedRelation: "trade_participations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_ledger_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["trade_id"]
          },
        ]
      }
      investment_cycles: {
        Row: {
          company_profit_share_pct: number
          config_version: number
          created_at: string
          cycle_number: number
          duration_unit: Database["public"]["Enums"]["cycle_duration_unit"]
          duration_value: number
          end_date: string
          id: string
          investor_profit_share_pct: number
          name: string
          settled_at: string | null
          start_date: string
          status: Database["public"]["Enums"]["investment_cycle_status"]
          total_realized_pnl: number | null
          updated_at: string
        }
        Insert: {
          company_profit_share_pct?: number
          config_version?: number
          created_at?: string
          cycle_number: number
          duration_unit?: Database["public"]["Enums"]["cycle_duration_unit"]
          duration_value?: number
          end_date: string
          id?: string
          investor_profit_share_pct?: number
          name: string
          settled_at?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["investment_cycle_status"]
          total_realized_pnl?: number | null
          updated_at?: string
        }
        Update: {
          company_profit_share_pct?: number
          config_version?: number
          created_at?: string
          cycle_number?: number
          duration_unit?: Database["public"]["Enums"]["cycle_duration_unit"]
          duration_value?: number
          end_date?: string
          id?: string
          investor_profit_share_pct?: number
          name?: string
          settled_at?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["investment_cycle_status"]
          total_realized_pnl?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "investment_cycles_config_version_fkey"
            columns: ["config_version"]
            isOneToOne: false
            referencedRelation: "platform_configuration"
            referencedColumns: ["version"]
          },
        ]
      }
      investor_accounts: {
        Row: {
          account_number: string
          created_at: string
          currency: string
          id: string
          status: Database["public"]["Enums"]["investor_account_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          account_number: string
          created_at?: string
          currency?: string
          id?: string
          status?: Database["public"]["Enums"]["investor_account_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          account_number?: string
          created_at?: string
          currency?: string
          id?: string
          status?: Database["public"]["Enums"]["investor_account_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      orchestration_logs: {
        Row: {
          blocked_prompts: Json
          created_at: string
          decision_id: string
          error_message: string | null
          execution_order: Json
          loaded_prompts: Json
          pipeline_id: string
          stage: string
          status: string
          trade_id: string | null
          user_id: string | null
        }
        Insert: {
          blocked_prompts?: Json
          created_at?: string
          decision_id?: string
          error_message?: string | null
          execution_order?: Json
          loaded_prompts?: Json
          pipeline_id: string
          stage: string
          status?: string
          trade_id?: string | null
          user_id?: string | null
        }
        Update: {
          blocked_prompts?: Json
          created_at?: string
          decision_id?: string
          error_message?: string | null
          execution_order?: Json
          loaded_prompts?: Json
          pipeline_id?: string
          stage?: string
          status?: string
          trade_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      platform_configuration: {
        Row: {
          base_currency: string
          company_profit_share_pct: number
          created_at: string
          default_cycle_duration_unit: Database["public"]["Enums"]["cycle_duration_unit"]
          default_cycle_duration_value: number
          id: string
          investor_profit_share_pct: number
          is_active: boolean
          notes: string | null
          risk_basis: Database["public"]["Enums"]["risk_basis_type"]
          supported_display_currencies: string[]
          updated_at: string
          version: number
        }
        Insert: {
          base_currency?: string
          company_profit_share_pct?: number
          created_at?: string
          default_cycle_duration_unit?: Database["public"]["Enums"]["cycle_duration_unit"]
          default_cycle_duration_value?: number
          id?: string
          investor_profit_share_pct?: number
          is_active?: boolean
          notes?: string | null
          risk_basis?: Database["public"]["Enums"]["risk_basis_type"]
          supported_display_currencies?: string[]
          updated_at?: string
          version: number
        }
        Update: {
          base_currency?: string
          company_profit_share_pct?: number
          created_at?: string
          default_cycle_duration_unit?: Database["public"]["Enums"]["cycle_duration_unit"]
          default_cycle_duration_value?: number
          id?: string
          investor_profit_share_pct?: number
          is_active?: boolean
          notes?: string | null
          risk_basis?: Database["public"]["Enums"]["risk_basis_type"]
          supported_display_currencies?: string[]
          updated_at?: string
          version?: number
        }
        Relationships: []
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
      reflection_versions: {
        Row: {
          content: string
          created_at: string
          id: string
          reflection_id: string
          trade_id: string
          version: number
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          reflection_id: string
          trade_id: string
          version: number
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          reflection_id?: string
          trade_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "reflection_versions_reflection_id_fkey"
            columns: ["reflection_id"]
            isOneToOne: false
            referencedRelation: "reflections"
            referencedColumns: ["id"]
          },
        ]
      }
      reflections: {
        Row: {
          content: string
          created_at: string
          id: string
          is_lesson: boolean
          section_type: Database["public"]["Enums"]["reflection_section"]
          trade_id: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_lesson?: boolean
          section_type?: Database["public"]["Enums"]["reflection_section"]
          trade_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_lesson?: boolean
          section_type?: Database["public"]["Enums"]["reflection_section"]
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
          pnl_amount: number | null
          pnl_percent: number | null
          result_notes: string | null
          rr_achieved: number | null
          trade_duration: string | null
          trade_id: string
        }
        Insert: {
          close_date?: string | null
          closing_price?: number | null
          created_at?: string
          id?: string
          outcome: Database["public"]["Enums"]["outcome_type"]
          pnl_amount?: number | null
          pnl_percent?: number | null
          result_notes?: string | null
          rr_achieved?: number | null
          trade_duration?: string | null
          trade_id: string
        }
        Update: {
          close_date?: string | null
          closing_price?: number | null
          created_at?: string
          id?: string
          outcome?: Database["public"]["Enums"]["outcome_type"]
          pnl_amount?: number | null
          pnl_percent?: number | null
          result_notes?: string | null
          rr_achieved?: number | null
          trade_duration?: string | null
          trade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "results_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: true
            referencedRelation: "trades"
            referencedColumns: ["trade_id"]
          },
        ]
      }
      screenshots: {
        Row: {
          ai_identified_context: Json | null
          analysis_phase: Database["public"]["Enums"]["screenshot_phase"]
          created_at: string
          is_primary: boolean
          screenshot_id: string
          shot_type: Database["public"]["Enums"]["screenshot_shot_type"]
          trade_id: string
          url: string
          user_label: string | null
        }
        Insert: {
          ai_identified_context?: Json | null
          analysis_phase?: Database["public"]["Enums"]["screenshot_phase"]
          created_at?: string
          is_primary?: boolean
          screenshot_id?: string
          shot_type?: Database["public"]["Enums"]["screenshot_shot_type"]
          trade_id: string
          url: string
          user_label?: string | null
        }
        Update: {
          ai_identified_context?: Json | null
          analysis_phase?: Database["public"]["Enums"]["screenshot_phase"]
          created_at?: string
          is_primary?: boolean
          screenshot_id?: string
          shot_type?: Database["public"]["Enums"]["screenshot_shot_type"]
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
      strategy_os: {
        Row: {
          community_prompt: string
          core_strategy_prompt: string
          created_at: string
          education_prompt: string
          entry_confirmation_prompt: string
          filter_prompt: string
          id: string
          investor_prompt: string
          learning_prompt: string
          psychology_prompt: string
          risk_prompt: string
          system_identity_prompt: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          community_prompt?: string
          core_strategy_prompt?: string
          created_at?: string
          education_prompt?: string
          entry_confirmation_prompt?: string
          filter_prompt?: string
          id?: string
          investor_prompt?: string
          learning_prompt?: string
          psychology_prompt?: string
          risk_prompt?: string
          system_identity_prompt?: string
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          community_prompt?: string
          core_strategy_prompt?: string
          created_at?: string
          education_prompt?: string
          entry_confirmation_prompt?: string
          filter_prompt?: string
          id?: string
          investor_prompt?: string
          learning_prompt?: string
          psychology_prompt?: string
          risk_prompt?: string
          system_identity_prompt?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      strategy_os_versions: {
        Row: {
          created_at: string
          engine_key: string
          id: string
          new_content: string
          previous_content: string
          strategy_os_id: string
          user_id: string
          version: number
        }
        Insert: {
          created_at?: string
          engine_key: string
          id?: string
          new_content?: string
          previous_content?: string
          strategy_os_id: string
          user_id: string
          version: number
        }
        Update: {
          created_at?: string
          engine_key?: string
          id?: string
          new_content?: string
          previous_content?: string
          strategy_os_id?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "strategy_os_versions_strategy_os_id_fkey"
            columns: ["strategy_os_id"]
            isOneToOne: false
            referencedRelation: "strategy_os"
            referencedColumns: ["id"]
          },
        ]
      }
      strategy_profiles: {
        Row: {
          area_of_interest: Json
          coaching_expectations: Json
          community_engine: Json
          confirmation_rules: Json
          core_strategy: Json
          created_at: string
          disqualification_rules: Json
          education_engine: Json
          educational_expectations: Json
          entry_confirmations: Json
          filter_engine: Json
          id: string
          investor_engine: Json
          is_active: boolean
          learning_engine: Json
          name: string | null
          prompt_config: Json
          psychology_engine: Json
          risk_engine: Json
          risk_rules: Json
          system_profile: Json
          trend_model: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          area_of_interest?: Json
          coaching_expectations?: Json
          community_engine?: Json
          confirmation_rules?: Json
          core_strategy?: Json
          created_at?: string
          disqualification_rules?: Json
          education_engine?: Json
          educational_expectations?: Json
          entry_confirmations?: Json
          filter_engine?: Json
          id?: string
          investor_engine?: Json
          is_active?: boolean
          learning_engine?: Json
          name?: string | null
          prompt_config?: Json
          psychology_engine?: Json
          risk_engine?: Json
          risk_rules?: Json
          system_profile?: Json
          trend_model?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          area_of_interest?: Json
          coaching_expectations?: Json
          community_engine?: Json
          confirmation_rules?: Json
          core_strategy?: Json
          created_at?: string
          disqualification_rules?: Json
          education_engine?: Json
          educational_expectations?: Json
          entry_confirmations?: Json
          filter_engine?: Json
          id?: string
          investor_engine?: Json
          is_active?: boolean
          learning_engine?: Json
          name?: string | null
          prompt_config?: Json
          psychology_engine?: Json
          risk_engine?: Json
          risk_rules?: Json
          system_profile?: Json
          trend_model?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trade_participations: {
        Row: {
          created_at: string
          cycle_id: string | null
          id: string
          idempotency_key: string
          investor_gross_pnl: number | null
          investor_id: string
          participation_timestamp: string
          participating_capital_snapshot: number
          result_pnl_percent: number | null
          risk_amount: number
          risk_basis: Database["public"]["Enums"]["risk_basis_type"]
          risk_pct: number
          status: Database["public"]["Enums"]["participation_status"]
          trade_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          cycle_id?: string | null
          id?: string
          idempotency_key: string
          investor_gross_pnl?: number | null
          investor_id: string
          participation_timestamp?: string
          participating_capital_snapshot: number
          result_pnl_percent?: number | null
          risk_amount?: number
          risk_basis?: Database["public"]["Enums"]["risk_basis_type"]
          risk_pct?: number
          status?: Database["public"]["Enums"]["participation_status"]
          trade_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          cycle_id?: string | null
          id?: string
          idempotency_key?: string
          investor_gross_pnl?: number | null
          investor_id?: string
          participation_timestamp?: string
          participating_capital_snapshot?: number
          result_pnl_percent?: number | null
          risk_amount?: number
          risk_basis?: Database["public"]["Enums"]["risk_basis_type"]
          risk_pct?: number
          status?: Database["public"]["Enums"]["participation_status"]
          trade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_participations_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "investment_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_participations_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_participations_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["trade_id"]
          },
        ]
      }
      trades: {
        Row: {
          account_size: number | null
          created_at: string
          current_strategy_profile_id: string | null
          day_of_week: string | null
          direction: string
          entry_price: number | null
          executed: boolean
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
          day_of_week?: string | null
          direction: string
          entry_price?: number | null
          executed?: boolean
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
          day_of_week?: string | null
          direction?: string
          entry_price?: number | null
          executed?: boolean
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
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
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
      withdrawal_requests: {
        Row: {
          company_profit_share_deducted: number | null
          created_at: string
          crystallized_performance_pnl: number | null
          currency: string
          cycle_id: string | null
          id: string
          investor_id: string
          net_disbursed_amount: number | null
          payout_details: Json | null
          processed_at: string | null
          rejection_reason: string | null
          requested_amount: number
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["withdrawal_status"]
          updated_at: string
        }
        Insert: {
          company_profit_share_deducted?: number | null
          created_at?: string
          crystallized_performance_pnl?: number | null
          currency?: string
          cycle_id?: string | null
          id?: string
          investor_id: string
          net_disbursed_amount?: number | null
          payout_details?: Json | null
          processed_at?: string | null
          rejection_reason?: string | null
          requested_amount: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
          updated_at?: string
        }
        Update: {
          company_profit_share_deducted?: number | null
          created_at?: string
          crystallized_performance_pnl?: number | null
          currency?: string
          cycle_id?: string | null
          id?: string
          investor_id?: string
          net_disbursed_amount?: number | null
          payout_details?: Json | null
          processed_at?: string | null
          rejection_reason?: string | null
          requested_amount?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_requests_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "investment_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_requests_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      company_financial_summary: {
        Row: {
          active_investors_count: number | null
          company_net_earnings: number | null
          gross_trading_pnl: number | null
          net_company_equity: number | null
          open_trades_count: number | null
          total_activated_capital: number | null
          total_committed_trade_capital: number | null
          total_withdrawn_capital: number | null
        }
        Relationships: []
      }
      dashboard_metrics: {
        Row: {
          agreement_score: number | null
          ai_agreement_score: number | null
          avg_rr: number | null
          closed_trades: number | null
          discipline_score: number | null
          most_common_mistake: string | null
          most_profitable_behavior: string | null
          most_violated_rule: string | null
          override_score: number | null
          trust_score: number | null
          user_id: string | null
          win_rate: number | null
        }
        Relationships: []
      }
      investor_financial_summary: {
        Row: {
          account_number: string | null
          active_committed_capital: number | null
          available_capital: number | null
          closed_trades_count: number | null
          created_at: string | null
          currency: string | null
          current_cycle_realized_pnl: number | null
          current_economic_equity: number | null
          investor_id: string | null
          open_trades_count: number | null
          settled_capital: number | null
          status: Database["public"]["Enums"]["investor_account_status"] | null
          total_deposited: number | null
          total_withdrawn: number | null
          user_id: string | null
        }
        Relationships: []
      }
      portfolio_exposure_summary: {
        Row: {
          direction: string | null
          entry_price: number | null
          pair: string | null
          participating_investors_count: number | null
          risk_pct: number | null
          total_active_risk_exposure: number | null
          total_committed_capital: number | null
          trade_created_at: string | null
          trade_id: string | null
          trade_status: Database["public"]["Enums"]["trade_status"] | null
        }
        Relationships: []
      }
    }
    Functions: {
      activate_capital_event: {
        Args: {
          p_event_id: string
          p_admin_user_id?: string
        }
        Returns: Json
      }
      crystallize_and_approve_withdrawal: {
        Args: {
          p_withdrawal_id: string
          p_admin_user_id?: string
        }
        Returns: Json
      }
      get_investor_financial_position: {
        Args: {
          p_investor_id: string
        }
        Returns: {
          active_committed_capital: number
          available_capital: number
          closed_trades_count: number
          current_cycle_realized_pnl: number
          current_economic_equity: number
          open_trades_count: number
          settled_capital: number
          total_deposited: number
          total_withdrawn: number
        }[]
      }
      is_admin: {
        Args: {
          p_user_id?: string
        }
        Returns: boolean
      }
      is_investor: {
        Args: {
          p_user_id?: string
        }
        Returns: boolean
      }
      is_trader: {
        Args: {
          p_user_id?: string
        }
        Returns: boolean
      }
      owns_trade: {
        Args: {
          _trade_id: string
        }
        Returns: boolean
      }
      process_trade_allocation: {
        Args: {
          p_trade_id: string
        }
        Returns: Json
      }
      snapshot_trade_participation: {
        Args: {
          p_trade_id: string
          p_risk_basis?: Database["public"]["Enums"]["risk_basis_type"]
        }
        Returns: Json
      }
    }
    Enums: {
      analysis_stage: "BLIND" | "COMPARATIVE" | "VERDICT"
      analysis_type: "PRE" | "POST"
      app_role: "ADMIN" | "TRADER" | "INVESTOR"
      capital_event_status: "PENDING" | "ACTIVATED" | "REJECTED" | "CANCELLED"
      capital_event_type:
        | "INITIAL_CAPITAL"
        | "ADDITIONAL_CAPITAL"
        | "WITHDRAWAL"
        | "ADJUSTMENT"
        | "REVERSAL"
      cycle_duration_unit: "DAYS" | "WEEKS" | "MONTHS" | "YEARS"
      insight_category: "MISTAKE" | "STRENGTH" | "PATTERN" | "NOTE"
      investment_cycle_status:
        | "UPCOMING"
        | "ACTIVE"
        | "SETTLING"
        | "SETTLED"
        | "CLOSED"
      investor_account_status:
        | "PENDING_APPROVAL"
        | "ACTIVE"
        | "SUSPENDED"
        | "CLOSED"
      job_status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED"
      ledger_event_type:
        | "CAPITAL_ACTIVATED"
        | "ADDITIONAL_CAPITAL"
        | "TRADE_ALLOCATION_PROFIT"
        | "TRADE_ALLOCATION_LOSS"
        | "CYCLE_SETTLEMENT_PROFIT"
        | "CYCLE_SETTLEMENT_INVESTOR_SHARE"
        | "CYCLE_SETTLEMENT_COMPANY_SHARE"
        | "WITHDRAWAL_REQUESTED"
        | "WITHDRAWAL_PROCESSED"
        | "ADJUSTMENT"
        | "REVERSAL"
      outcome_type: "WIN" | "LOSS" | "BREAKEVEN" | "CANCELLED"
      participation_status:
        | "COMMITTED"
        | "ALLOCATED"
        | "SETTLED"
        | "CANCELLED"
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
        | "POST_PENDING"
        | "POST_REVIEW"
        | "POST_MISTAKE"
        | "POST_PERFORMANCE"
        | "POST_LEARNING"
        | "POST_COACH"
        | "POST_COMPLETED"
        | "POST_FAILED"
      prompt_type: "PRE" | "POST" | "VERDICT" | "COACHING"
      reflection_section:
        | "WHAT_I_SAW"
        | "WHAT_I_FELT"
        | "WHAT_I_DID_RIGHT"
        | "WHAT_I_DID_WRONG"
        | "WHAT_I_LEARNED"
        | "PROMISE_TO_MYSELF"
        | "GENERAL"
      risk_basis_type:
        | "AVAILABLE_CAPITAL"
        | "PARTICIPATING_CAPITAL"
        | "ACCOUNT_EQUITY"
      screenshot_phase: "PRE" | "POST"
      screenshot_shot_type:
        | "ENTRY"
        | "MANAGEMENT"
        | "EXIT"
        | "RESULT"
        | "ACCOUNT"
        | "CONTEXT"
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
      withdrawal_status:
        | "REQUESTED"
        | "UNDER_REVIEW"
        | "WAITING_FOR_OPEN_TRADES"
        | "PERFORMANCE_CRYSTALLIZATION_REQUIRED"
        | "APPROVED"
        | "PROCESSED"
        | "REJECTED"
        | "CANCELLED"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["ADMIN", "TRADER", "INVESTOR"],
      capital_event_status: ["PENDING", "ACTIVATED", "REJECTED", "CANCELLED"],
      capital_event_type: [
        "INITIAL_CAPITAL",
        "ADDITIONAL_CAPITAL",
        "WITHDRAWAL",
        "ADJUSTMENT",
        "REVERSAL",
      ],
      cycle_duration_unit: ["DAYS", "WEEKS", "MONTHS", "YEARS"],
      insight_category: ["MISTAKE", "STRENGTH", "PATTERN", "NOTE"],
      investment_cycle_status: [
        "UPCOMING",
        "ACTIVE",
        "SETTLING",
        "SETTLED",
        "CLOSED",
      ],
      investor_account_status: [
        "PENDING_APPROVAL",
        "ACTIVE",
        "SUSPENDED",
        "CLOSED",
      ],
      job_status: ["QUEUED", "RUNNING", "SUCCEEDED", "FAILED"],
      ledger_event_type: [
        "CAPITAL_ACTIVATED",
        "ADDITIONAL_CAPITAL",
        "TRADE_ALLOCATION_PROFIT",
        "TRADE_ALLOCATION_LOSS",
        "CYCLE_SETTLEMENT_PROFIT",
        "CYCLE_SETTLEMENT_INVESTOR_SHARE",
        "CYCLE_SETTLEMENT_COMPANY_SHARE",
        "WITHDRAWAL_REQUESTED",
        "WITHDRAWAL_PROCESSED",
        "ADJUSTMENT",
        "REVERSAL",
      ],
      outcome_type: ["WIN", "LOSS", "BREAKEVEN", "CANCELLED"],
      participation_status: [
        "COMMITTED",
        "ALLOCATED",
        "SETTLED",
        "CANCELLED",
      ],
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
        "POST_PENDING",
        "POST_REVIEW",
        "POST_MISTAKE",
        "POST_PERFORMANCE",
        "POST_LEARNING",
        "POST_COACH",
        "POST_COMPLETED",
        "POST_FAILED",
      ],
      prompt_type: ["PRE", "POST", "VERDICT", "COACHING"],
      reflection_section: [
        "WHAT_I_SAW",
        "WHAT_I_FELT",
        "WHAT_I_DID_RIGHT",
        "WHAT_I_DID_WRONG",
        "WHAT_I_LEARNED",
        "PROMISE_TO_MYSELF",
        "GENERAL",
      ],
      risk_basis_type: [
        "AVAILABLE_CAPITAL",
        "PARTICIPATING_CAPITAL",
        "ACCOUNT_EQUITY",
      ],
      screenshot_phase: ["PRE", "POST"],
      screenshot_shot_type: [
        "ENTRY",
        "MANAGEMENT",
        "EXIT",
        "RESULT",
        "ACCOUNT",
        "CONTEXT",
      ],
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
      withdrawal_status: [
        "REQUESTED",
        "UNDER_REVIEW",
        "WAITING_FOR_OPEN_TRADES",
        "PERFORMANCE_CRYSTALLIZATION_REQUIRED",
        "APPROVED",
        "PROCESSED",
        "REJECTED",
        "CANCELLED",
      ],
    },
  },
} as const
