
-- Pipeline step enum
CREATE TYPE public.processing_step AS ENUM (
  'PENDING','BLIND','STRATEGY','VALIDATION','LEARNING','VERDICT','EDUCATION','COACH','COMPLETED','FAILED'
);

CREATE TYPE public.job_status AS ENUM ('QUEUED','RUNNING','SUCCEEDED','FAILED');

-- strategy_profiles
CREATE TABLE public.strategy_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  prompt_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.strategy_profiles TO authenticated;
GRANT ALL ON public.strategy_profiles TO service_role;
ALTER TABLE public.strategy_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners manage strategy_profiles" ON public.strategy_profiles
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER strategy_profiles_set_updated_at
  BEFORE UPDATE ON public.strategy_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- trades additions
ALTER TABLE public.trades
  ADD COLUMN current_strategy_profile_id UUID REFERENCES public.strategy_profiles(id) ON DELETE SET NULL,
  ADD COLUMN processing_step public.processing_step NOT NULL DEFAULT 'PENDING',
  ADD COLUMN processing_error TEXT;

-- ai_analyses additions
ALTER TABLE public.ai_analyses
  ADD COLUMN model_provider TEXT,
  ADD COLUMN model_name TEXT,
  ADD COLUMN prompt_snapshot TEXT;

-- job_queue
CREATE TABLE public.job_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID NOT NULL REFERENCES public.trades(trade_id) ON DELETE CASCADE,
  stage public.processing_step NOT NULL,
  status public.job_status NOT NULL DEFAULT 'QUEUED',
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  last_error TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.job_queue TO authenticated;
GRANT ALL ON public.job_queue TO service_role;
ALTER TABLE public.job_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners read job_queue" ON public.job_queue
  FOR SELECT USING (public.owns_trade(trade_id));

CREATE TRIGGER job_queue_set_updated_at
  BEFORE UPDATE ON public.job_queue
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.trades;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_analyses;
ALTER TABLE public.trades REPLICA IDENTITY FULL;
ALTER TABLE public.ai_analyses REPLICA IDENTITY FULL;
