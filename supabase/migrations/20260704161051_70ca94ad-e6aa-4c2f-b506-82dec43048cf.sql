
CREATE TABLE public.strategy_os (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  system_identity_prompt text NOT NULL DEFAULT '',
  core_strategy_prompt text NOT NULL DEFAULT '',
  entry_confirmation_prompt text NOT NULL DEFAULT '',
  risk_prompt text NOT NULL DEFAULT '',
  filter_prompt text NOT NULL DEFAULT '',
  psychology_prompt text NOT NULL DEFAULT '',
  learning_prompt text NOT NULL DEFAULT '',
  education_prompt text NOT NULL DEFAULT '',
  community_prompt text NOT NULL DEFAULT '',
  investor_prompt text NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.strategy_os TO authenticated;
GRANT ALL ON public.strategy_os TO service_role;

ALTER TABLE public.strategy_os ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own strategy_os"
  ON public.strategy_os FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.strategy_os_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_os_id uuid NOT NULL REFERENCES public.strategy_os(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  engine_key text NOT NULL,
  previous_content text NOT NULL DEFAULT '',
  new_content text NOT NULL DEFAULT '',
  version integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.strategy_os_versions TO authenticated;
GRANT ALL ON public.strategy_os_versions TO service_role;

ALTER TABLE public.strategy_os_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own strategy_os_versions"
  ON public.strategy_os_versions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own strategy_os_versions"
  ON public.strategy_os_versions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_strategy_os_versions_lookup
  ON public.strategy_os_versions(strategy_os_id, engine_key, created_at DESC);

CREATE OR REPLACE FUNCTION public.snapshot_strategy_os_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  engines text[] := ARRAY[
    'system_identity_prompt','core_strategy_prompt','entry_confirmation_prompt',
    'risk_prompt','filter_prompt','psychology_prompt','learning_prompt',
    'education_prompt','community_prompt','investor_prompt'
  ];
  eng text;
  old_val text;
  new_val text;
  bumped boolean := false;
BEGIN
  FOREACH eng IN ARRAY engines LOOP
    EXECUTE format('SELECT ($1).%I, ($2).%I', eng, eng)
      INTO old_val, new_val USING OLD, NEW;
    IF COALESCE(old_val,'') IS DISTINCT FROM COALESCE(new_val,'') THEN
      IF NOT bumped THEN
        NEW.version := COALESCE(OLD.version,1) + 1;
        bumped := true;
      END IF;
      INSERT INTO public.strategy_os_versions(
        strategy_os_id, user_id, engine_key, previous_content, new_content, version
      ) VALUES (NEW.id, NEW.user_id, eng, COALESCE(old_val,''), COALESCE(new_val,''), NEW.version);
    END IF;
  END LOOP;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE TRIGGER trg_strategy_os_version
  BEFORE UPDATE ON public.strategy_os
  FOR EACH ROW
  EXECUTE FUNCTION public.snapshot_strategy_os_version();
