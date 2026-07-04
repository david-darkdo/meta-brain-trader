
CREATE OR REPLACE FUNCTION public.snapshot_strategy_os_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
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
