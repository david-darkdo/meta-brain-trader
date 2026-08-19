-- ====================================================
-- METABRAIN TRADER COMPLETE DATABASE SCHEMA MIGRATION
-- Run this SQL in your Supabase SQL Editor to create all tables, types, & RLS policies.
-- Project URL: https://jqptprskuxkhfoxsvwcl.supabase.co
-- ====================================================

-- ----------------------------------------------------
-- Migration File: 20260625105430_62324128-b887-4905-a4d0-0944d0c9642f.sql
-- ----------------------------------------------------
-- ENUMS
CREATE TYPE public.subscription_tier AS ENUM ('FREE','PRO','ELITE');
CREATE TYPE public.trade_status AS ENUM ('DRAFT','PRE_ANALYSIS','PRE_ANALYZED','POST_DRAFT','POST_ANALYSIS','POST_ANALYZED','JOURNALED','DELETED');
CREATE TYPE public.analysis_type AS ENUM ('PRE','POST');
CREATE TYPE public.prompt_type AS ENUM ('PRE','POST','VERDICT','COACHING');
CREATE TYPE public.analysis_stage AS ENUM ('BLIND','COMPARATIVE','VERDICT');
CREATE TYPE public.verdict_type AS ENUM ('APPROVED','DISQUALIFIED','NEUTRAL');
CREATE TYPE public.outcome_type AS ENUM ('WIN','LOSS','BREAKEVEN','CANCELLED');

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- USERS
CREATE TABLE public.users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  subscription_tier public.subscription_tier NOT NULL DEFAULT 'FREE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO authenticated;
GRANT ALL ON public.users TO service_role;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users self read" ON public.users FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users self update" ON public.users FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Auto-create user row on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.users (user_id, email, subscription_tier)
  VALUES (NEW.id, NEW.email, 'FREE')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- PROFILE SETTINGS
CREATE TABLE public.profile_settings (
  settings_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  custom_prompts JSONB NOT NULL DEFAULT '{}'::jsonb,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_settings TO authenticated;
GRANT ALL ON public.profile_settings TO service_role;
ALTER TABLE public.profile_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profile_settings owner" ON public.profile_settings FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_profile_settings_updated BEFORE UPDATE ON public.profile_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- USAGE LOGS
CREATE TABLE public.usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  analysis_type public.analysis_type NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.usage_logs TO authenticated;
GRANT ALL ON public.usage_logs TO service_role;
ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usage_logs owner" ON public.usage_logs FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- PROMPT REGISTRY (global, read-only for users)
CREATE TABLE public.prompt_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_label TEXT NOT NULL,
  prompt_type public.prompt_type NOT NULL,
  actual_prompt_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.prompt_registry TO authenticated;
GRANT ALL ON public.prompt_registry TO service_role;
ALTER TABLE public.prompt_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prompt_registry read" ON public.prompt_registry FOR SELECT TO authenticated USING (true);

-- TRADES
CREATE TABLE public.trades (
  trade_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trade_status public.trade_status NOT NULL DEFAULT 'DRAFT',
  pair TEXT NOT NULL,
  direction TEXT NOT NULL,
  entry_price NUMERIC,
  stop_loss NUMERIC,
  take_profit NUMERIC,
  account_size NUMERIC,
  risk_pct NUMERIC,
  session TEXT,
  notes TEXT,
  executed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trades TO authenticated;
GRANT ALL ON public.trades TO service_role;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trades owner read" ON public.trades FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "trades owner insert" ON public.trades FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "trades owner update" ON public.trades FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "trades owner delete" ON public.trades FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_trades_updated BEFORE UPDATE ON public.trades
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- SCREENSHOTS
CREATE TABLE public.screenshots (
  screenshot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID NOT NULL REFERENCES public.trades(trade_id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  user_label TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.screenshots TO authenticated;
GRANT ALL ON public.screenshots TO service_role;
ALTER TABLE public.screenshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "screenshots owner" ON public.screenshots FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.trades WHERE trade_id = screenshots.trade_id AND user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.trades WHERE trade_id = screenshots.trade_id AND user_id = auth.uid()));

-- AI ANALYSES
CREATE TABLE public.ai_analyses (
  analysis_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID NOT NULL REFERENCES public.trades(trade_id) ON DELETE CASCADE,
  analysis_type public.analysis_type NOT NULL,
  stage public.analysis_stage NOT NULL,
  verdict public.verdict_type,
  reasoning TEXT,
  suggestions JSONB DEFAULT '[]'::jsonb,
  metrics_impact JSONB DEFAULT '{}'::jsonb,
  raw_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(trade_id, analysis_type, stage)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_analyses TO authenticated;
GRANT ALL ON public.ai_analyses TO service_role;
ALTER TABLE public.ai_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_analyses owner" ON public.ai_analyses FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.trades WHERE trade_id = ai_analyses.trade_id AND user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.trades WHERE trade_id = ai_analyses.trade_id AND user_id = auth.uid()));

-- REFLECTIONS
CREATE TABLE public.reflections (
  reflection_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID NOT NULL REFERENCES public.trades(trade_id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  execution_score INTEGER CHECK (execution_score BETWEEN 1 AND 10),
  psychology_score INTEGER CHECK (psychology_score BETWEEN 1 AND 10),
  followed_rules BOOLEAN,
  rule_violations JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(trade_id, version)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reflections TO authenticated;
GRANT ALL ON public.reflections TO service_role;
ALTER TABLE public.reflections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reflections owner" ON public.reflections FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.trades WHERE trade_id = reflections.trade_id AND user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.trades WHERE trade_id = reflections.trade_id AND user_id = auth.uid()));
CREATE TRIGGER trg_reflections_updated BEFORE UPDATE ON public.reflections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RESULTS
CREATE TABLE public.results (
  result_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID NOT NULL UNIQUE REFERENCES public.trades(trade_id) ON DELETE CASCADE,
  pnl NUMERIC,
  r_multiple NUMERIC,
  outcome public.outcome_type NOT NULL,
  exit_price NUMERIC,
  exit_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.results TO authenticated;
GRANT ALL ON public.results TO service_role;
ALTER TABLE public.results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "results owner" ON public.results FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.trades WHERE trade_id = results.trade_id AND user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.trades WHERE trade_id = results.trade_id AND user_id = auth.uid()));
CREATE TRIGGER trg_results_updated BEFORE UPDATE ON public.results
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- JOB QUEUE
CREATE TABLE public.job_queue (
  job_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID NOT NULL REFERENCES public.trades(trade_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  analysis_type public.analysis_type NOT NULL,
  step public.processing_step NOT NULL DEFAULT 'PENDING',
  status public.job_status NOT NULL DEFAULT 'QUEUED',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  last_error TEXT,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_queue TO authenticated;
GRANT ALL ON public.job_queue TO service_role;
ALTER TABLE public.job_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "job_queue owner" ON public.job_queue FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_job_queue_updated BEFORE UPDATE ON public.job_queue
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- DASHBOARD METRICS VIEW/TABLE & LEARNING INSIGHTS
CREATE TABLE public.dashboard_metrics (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  closed_trades INTEGER NOT NULL DEFAULT 0,
  win_rate NUMERIC NOT NULL DEFAULT 0,
  avg_rr NUMERIC NOT NULL DEFAULT 0,
  discipline_score NUMERIC NOT NULL DEFAULT 0,
  agreement_score NUMERIC NOT NULL DEFAULT 0,
  override_score NUMERIC NOT NULL DEFAULT 0,
  trust_score NUMERIC NOT NULL DEFAULT 0,
  most_violated_rule TEXT,
  most_profitable_behavior TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dashboard_metrics TO authenticated;
GRANT ALL ON public.dashboard_metrics TO service_role;
ALTER TABLE public.dashboard_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dashboard_metrics owner" ON public.dashboard_metrics FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.learning_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  content TEXT NOT NULL,
  occurrences INTEGER NOT NULL DEFAULT 1,
  referenced_trade_ids UUID[] DEFAULT '{}'::uuid[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.learning_insights TO authenticated;
GRANT ALL ON public.learning_insights TO service_role;
ALTER TABLE public.learning_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "learning_insights owner" ON public.learning_insights FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- STRATEGY PROFILES & STRATEGY OS
CREATE TABLE public.strategy_profiles (
  profile_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  system_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  core_strategy JSONB NOT NULL DEFAULT '{}'::jsonb,
  entry_confirmations JSONB NOT NULL DEFAULT '{}'::jsonb,
  risk_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  psychology_rules JSONB NOT NULL DEFAULT '{}'::jsonb
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.strategy_profiles TO authenticated;
GRANT ALL ON public.strategy_profiles TO service_role;
ALTER TABLE public.strategy_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "strategy_profiles owner" ON public.strategy_profiles FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ADD MISSING day_of_week COLUMN TO TRADES
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS day_of_week TEXT;

-- STORAGE BUCKET & RLS POLICIES FOR trade-screenshots
INSERT INTO storage.buckets (id, name, public)
VALUES ('trade-screenshots', 'trade-screenshots', false)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Authenticated users can upload trade screenshots'
  ) THEN
    CREATE POLICY "Authenticated users can upload trade screenshots"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'trade-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Authenticated users can read trade screenshots'
  ) THEN
    CREATE POLICY "Authenticated users can read trade screenshots"
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'trade-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Authenticated users can delete trade screenshots'
  ) THEN
    CREATE POLICY "Authenticated users can delete trade screenshots"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'trade-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;
