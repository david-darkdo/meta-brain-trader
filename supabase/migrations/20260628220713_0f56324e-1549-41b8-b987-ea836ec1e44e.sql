
-- 1. Screenshot phase + type
DO $$ BEGIN
  CREATE TYPE public.screenshot_phase AS ENUM ('PRE','POST');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.screenshot_shot_type AS ENUM ('ENTRY','MANAGEMENT','EXIT','RESULT','ACCOUNT','CONTEXT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.screenshots
  ADD COLUMN IF NOT EXISTS analysis_phase public.screenshot_phase NOT NULL DEFAULT 'PRE',
  ADD COLUMN IF NOT EXISTS shot_type public.screenshot_shot_type NOT NULL DEFAULT 'CONTEXT';

-- 2. Trades: executed flag for agreement engine
ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS executed boolean NOT NULL DEFAULT true;

-- 3. Strategy profiles: structured identity
ALTER TABLE public.strategy_profiles
  ADD COLUMN IF NOT EXISTS trend_model jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS area_of_interest jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS confirmation_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS risk_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS disqualification_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS educational_expectations jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS coaching_expectations jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 4. Rebuild dashboard_metrics view with new scores
DROP VIEW IF EXISTS public.dashboard_metrics;

CREATE VIEW public.dashboard_metrics
WITH (security_invoker = true)
AS
WITH base AS (
  SELECT
    t.user_id,
    t.trade_id,
    t.executed,
    r.outcome,
    r.pnl_amount,
    r.rr_achieved,
    (
      SELECT (a.ai_output->>'verdict')
      FROM public.ai_analyses a
      WHERE a.trade_id = t.trade_id
        AND (a.ai_output->>'stage') = 'VERDICT'
      ORDER BY a.created_at DESC
      LIMIT 1
    ) AS ai_verdict
  FROM public.trades t
  LEFT JOIN public.results r ON r.trade_id = t.trade_id
  WHERE t.user_id = auth.uid()
),
mistakes AS (
  SELECT li.content, li.occurrences
  FROM public.learning_insights li
  WHERE li.user_id = auth.uid() AND li.category = 'MISTAKE'
  ORDER BY li.occurrences DESC NULLS LAST
  LIMIT 1
),
strengths AS (
  SELECT li.content, li.occurrences
  FROM public.learning_insights li
  WHERE li.user_id = auth.uid() AND li.category = 'STRENGTH'
  ORDER BY li.occurrences DESC NULLS LAST
  LIMIT 1
)
SELECT
  auth.uid() AS user_id,
  COUNT(*) FILTER (WHERE outcome IS NOT NULL) AS closed_trades,
  COALESCE(ROUND(100.0 * COUNT(*) FILTER (WHERE outcome = 'WIN')::numeric
    / NULLIF(COUNT(*) FILTER (WHERE outcome IS NOT NULL), 0), 1), 0) AS win_rate,
  COALESCE(ROUND(AVG(rr_achieved) FILTER (WHERE rr_achieved IS NOT NULL), 2), 0) AS avg_rr,
  -- Agreement: % of completed trades where execution matched AI verdict
  COALESCE(ROUND(100.0 * COUNT(*) FILTER (
    WHERE ai_verdict IS NOT NULL AND (
      (ai_verdict = 'APPROVED' AND executed) OR
      (ai_verdict = 'DISQUALIFIED' AND NOT executed)
    )
  )::numeric / NULLIF(COUNT(*) FILTER (WHERE ai_verdict IS NOT NULL), 0), 1), 0) AS agreement_score,
  -- Discipline: % of disqualified setups the user skipped
  COALESCE(ROUND(100.0 * COUNT(*) FILTER (WHERE ai_verdict = 'DISQUALIFIED' AND NOT executed)::numeric
    / NULLIF(COUNT(*) FILTER (WHERE ai_verdict = 'DISQUALIFIED'), 0), 1), 0) AS discipline_score,
  -- Override: % of disqualified setups the user took anyway
  COALESCE(ROUND(100.0 * COUNT(*) FILTER (WHERE ai_verdict = 'DISQUALIFIED' AND executed)::numeric
    / NULLIF(COUNT(*) FILTER (WHERE ai_verdict = 'DISQUALIFIED'), 0), 1), 0) AS override_score,
  -- Trust: blended agreement + winrate
  COALESCE(ROUND((
    0.6 * COALESCE(100.0 * COUNT(*) FILTER (
      WHERE ai_verdict IS NOT NULL AND (
        (ai_verdict = 'APPROVED' AND executed) OR
        (ai_verdict = 'DISQUALIFIED' AND NOT executed)
      )
    )::numeric / NULLIF(COUNT(*) FILTER (WHERE ai_verdict IS NOT NULL), 0), 0)
    + 0.4 * COALESCE(100.0 * COUNT(*) FILTER (WHERE outcome = 'WIN')::numeric
      / NULLIF(COUNT(*) FILTER (WHERE outcome IS NOT NULL), 0), 0)
  ), 1), 0) AS trust_score,
  -- Legacy discipline alias kept for back-compat; same value
  COALESCE(ROUND(100.0 * COUNT(*) FILTER (WHERE ai_verdict = 'DISQUALIFIED' AND NOT executed)::numeric
    / NULLIF(COUNT(*) FILTER (WHERE ai_verdict = 'DISQUALIFIED'), 0), 1), 0) AS ai_agreement_score,
  (SELECT content FROM mistakes) AS most_common_mistake,
  (SELECT content FROM mistakes) AS most_violated_rule,
  (SELECT content FROM strengths) AS most_profitable_behavior
FROM base;

GRANT SELECT ON public.dashboard_metrics TO authenticated;
