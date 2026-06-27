
-- Extend processing_step enum with post-trade stages
ALTER TYPE public.processing_step ADD VALUE IF NOT EXISTS 'POST_PENDING';
ALTER TYPE public.processing_step ADD VALUE IF NOT EXISTS 'POST_REVIEW';
ALTER TYPE public.processing_step ADD VALUE IF NOT EXISTS 'POST_MISTAKE';
ALTER TYPE public.processing_step ADD VALUE IF NOT EXISTS 'POST_PERFORMANCE';
ALTER TYPE public.processing_step ADD VALUE IF NOT EXISTS 'POST_LEARNING';
ALTER TYPE public.processing_step ADD VALUE IF NOT EXISTS 'POST_COACH';
ALTER TYPE public.processing_step ADD VALUE IF NOT EXISTS 'POST_COMPLETED';
ALTER TYPE public.processing_step ADD VALUE IF NOT EXISTS 'POST_FAILED';

-- Extend results table
ALTER TABLE public.results
  ADD COLUMN IF NOT EXISTS pnl_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS pnl_percent NUMERIC,
  ADD COLUMN IF NOT EXISTS rr_achieved NUMERIC,
  ADD COLUMN IF NOT EXISTS trade_duration INTERVAL;

-- Reflection sections
DO $$ BEGIN
  CREATE TYPE public.reflection_section AS ENUM (
    'WHAT_I_SAW','WHAT_I_FELT','WHAT_I_DID_RIGHT','WHAT_I_DID_WRONG','WHAT_I_LEARNED','PROMISE_TO_MYSELF','GENERAL'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.reflections
  ADD COLUMN IF NOT EXISTS section_type public.reflection_section NOT NULL DEFAULT 'GENERAL';

-- Reflection versions (history)
CREATE TABLE IF NOT EXISTS public.reflection_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reflection_id UUID NOT NULL REFERENCES public.reflections(id) ON DELETE CASCADE,
  trade_id UUID NOT NULL,
  content TEXT NOT NULL,
  version INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.reflection_versions TO authenticated;
GRANT ALL ON public.reflection_versions TO service_role;
ALTER TABLE public.reflection_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read reflection versions"
  ON public.reflection_versions FOR SELECT TO authenticated
  USING (public.owns_trade(trade_id));
CREATE POLICY "Owners insert reflection versions"
  ON public.reflection_versions FOR INSERT TO authenticated
  WITH CHECK (public.owns_trade(trade_id));

-- Trigger: every insert/update of reflections snapshots a new version
CREATE OR REPLACE FUNCTION public.snapshot_reflection_version()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE next_v INTEGER;
BEGIN
  SELECT COALESCE(MAX(version),0)+1 INTO next_v
    FROM public.reflection_versions WHERE reflection_id = NEW.id;
  INSERT INTO public.reflection_versions(reflection_id, trade_id, content, version)
    VALUES (NEW.id, NEW.trade_id, NEW.content, next_v);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_reflection_version_ins ON public.reflections;
CREATE TRIGGER trg_reflection_version_ins
  AFTER INSERT ON public.reflections
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_reflection_version();

DROP TRIGGER IF EXISTS trg_reflection_version_upd ON public.reflections;
CREATE TRIGGER trg_reflection_version_upd
  AFTER UPDATE OF content ON public.reflections
  FOR EACH ROW
  WHEN (NEW.content IS DISTINCT FROM OLD.content)
  EXECUTE FUNCTION public.snapshot_reflection_version();

-- Learning insights
DO $$ BEGIN
  CREATE TYPE public.insight_category AS ENUM ('MISTAKE','STRENGTH','PATTERN','NOTE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.learning_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  category public.insight_category NOT NULL,
  content TEXT NOT NULL,
  referenced_trade_ids UUID[] NOT NULL DEFAULT '{}',
  occurrences INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.learning_insights TO authenticated;
GRANT ALL ON public.learning_insights TO service_role;
ALTER TABLE public.learning_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their insights"
  ON public.learning_insights FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS trg_learning_insights_updated_at ON public.learning_insights;
CREATE TRIGGER trg_learning_insights_updated_at
  BEFORE UPDATE ON public.learning_insights
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Dashboard metrics view (per user, RLS via base tables)
CREATE OR REPLACE VIEW public.dashboard_metrics
WITH (security_invoker = true) AS
WITH t AS (
  SELECT tr.user_id, tr.trade_id, r.outcome, r.pnl_amount, r.rr_achieved
  FROM public.trades tr
  LEFT JOIN public.results r ON r.trade_id = tr.trade_id
),
agg AS (
  SELECT
    user_id,
    COUNT(*) FILTER (WHERE outcome IS NOT NULL) AS closed_trades,
    COUNT(*) FILTER (WHERE outcome = 'WIN') AS wins,
    COUNT(*) FILTER (WHERE outcome = 'LOSS') AS losses,
    COALESCE(SUM(pnl_amount), 0) AS total_pnl,
    COALESCE(AVG(rr_achieved), 0) AS avg_rr
  FROM t GROUP BY user_id
),
mistakes AS (
  SELECT user_id, content, COUNT(*) c
  FROM public.learning_insights
  WHERE category = 'MISTAKE'
  GROUP BY user_id, content
),
strengths AS (
  SELECT user_id, content, COUNT(*) c
  FROM public.learning_insights
  WHERE category = 'STRENGTH'
  GROUP BY user_id, content
)
SELECT
  a.user_id,
  COALESCE(a.closed_trades,0) AS closed_trades,
  COALESCE(a.wins,0) AS wins,
  COALESCE(a.losses,0) AS losses,
  CASE WHEN COALESCE(a.closed_trades,0) > 0
       THEN ROUND((a.wins::numeric / a.closed_trades) * 100, 1)
       ELSE 0 END AS win_rate,
  COALESCE(a.total_pnl,0) AS total_pnl,
  ROUND(COALESCE(a.avg_rr,0)::numeric, 2) AS avg_rr,
  (SELECT content FROM mistakes m WHERE m.user_id = a.user_id ORDER BY c DESC LIMIT 1) AS most_common_mistake,
  (SELECT content FROM strengths s WHERE s.user_id = a.user_id ORDER BY c DESC LIMIT 1) AS most_profitable_behavior,
  CASE WHEN COALESCE(a.closed_trades,0) > 0
       THEN ROUND((a.wins::numeric / a.closed_trades) * 100, 0)
       ELSE 0 END AS discipline_score,
  0 AS ai_agreement_score
FROM agg a;

GRANT SELECT ON public.dashboard_metrics TO authenticated;
