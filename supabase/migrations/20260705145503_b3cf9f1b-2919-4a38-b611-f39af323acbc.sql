
CREATE TABLE public.orchestration_logs (
  decision_id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pipeline_id TEXT NOT NULL,
  stage TEXT NOT NULL,
  trade_id UUID NULL,
  user_id UUID NULL,
  loaded_prompts JSONB NOT NULL DEFAULT '[]'::jsonb,
  blocked_prompts JSONB NOT NULL DEFAULT '[]'::jsonb,
  execution_order JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'STARTED',
  error_message TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX orchestration_logs_trade_id_idx ON public.orchestration_logs(trade_id);
CREATE INDEX orchestration_logs_user_id_idx ON public.orchestration_logs(user_id);
CREATE INDEX orchestration_logs_created_at_idx ON public.orchestration_logs(created_at DESC);

GRANT SELECT ON public.orchestration_logs TO authenticated;
GRANT ALL ON public.orchestration_logs TO service_role;

ALTER TABLE public.orchestration_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own orchestration logs"
  ON public.orchestration_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
