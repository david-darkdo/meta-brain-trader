
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
  user_override TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trades TO authenticated;
GRANT ALL ON public.trades TO service_role;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trades owner" ON public.trades FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_trades_updated BEFORE UPDATE ON public.trades
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_trades_user ON public.trades(user_id, created_at DESC);

-- Helper for child policies
CREATE OR REPLACE FUNCTION public.owns_trade(_trade_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.trades WHERE trade_id = _trade_id AND user_id = auth.uid())
$$;

-- SCREENSHOTS
CREATE TABLE public.screenshots (
  screenshot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID NOT NULL REFERENCES public.trades(trade_id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  user_label TEXT,
  ai_identified_context JSONB,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.screenshots TO authenticated;
GRANT ALL ON public.screenshots TO service_role;
ALTER TABLE public.screenshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "screenshots owner" ON public.screenshots FOR ALL TO authenticated
  USING (public.owns_trade(trade_id)) WITH CHECK (public.owns_trade(trade_id));
CREATE INDEX idx_screenshots_trade ON public.screenshots(trade_id);

-- AI ANALYSES
CREATE TABLE public.ai_analyses (
  analysis_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID NOT NULL REFERENCES public.trades(trade_id) ON DELETE CASCADE,
  prompt_version_id UUID REFERENCES public.prompt_registry(id),
  stage public.analysis_stage NOT NULL,
  ai_output JSONB,
  verdict public.verdict_type,
  entry_score NUMERIC,
  coaching_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_analyses TO authenticated;
GRANT ALL ON public.ai_analyses TO service_role;
ALTER TABLE public.ai_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_analyses owner" ON public.ai_analyses FOR ALL TO authenticated
  USING (public.owns_trade(trade_id)) WITH CHECK (public.owns_trade(trade_id));
CREATE INDEX idx_analyses_trade ON public.ai_analyses(trade_id);

-- REFLECTIONS
CREATE TABLE public.reflections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID NOT NULL REFERENCES public.trades(trade_id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_lesson BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reflections TO authenticated;
GRANT ALL ON public.reflections TO service_role;
ALTER TABLE public.reflections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reflections owner" ON public.reflections FOR ALL TO authenticated
  USING (public.owns_trade(trade_id)) WITH CHECK (public.owns_trade(trade_id));
CREATE TRIGGER trg_reflections_updated BEFORE UPDATE ON public.reflections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_reflections_trade ON public.reflections(trade_id);

-- RESULTS
CREATE TABLE public.results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID NOT NULL REFERENCES public.trades(trade_id) ON DELETE CASCADE,
  outcome public.outcome_type NOT NULL,
  closing_price NUMERIC,
  close_date TIMESTAMPTZ,
  result_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.results TO authenticated;
GRANT ALL ON public.results TO service_role;
ALTER TABLE public.results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "results owner" ON public.results FOR ALL TO authenticated
  USING (public.owns_trade(trade_id)) WITH CHECK (public.owns_trade(trade_id));
