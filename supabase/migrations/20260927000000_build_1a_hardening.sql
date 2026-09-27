-- ============================================================================
-- METABRAIN TRADER — BUILD 1A: HARDENING & CORRECTION MIGRATION
-- Non-destructive, idempotent, production-grade financial foundation hardening
-- ============================================================================

-- 1. HARDEN CAPITAL EVENTS: MULTI-CURRENCY COLUMNS
ALTER TABLE public.capital_events
  ADD COLUMN IF NOT EXISTS original_amount NUMERIC(20, 6),
  ADD COLUMN IF NOT EXISTS original_currency TEXT DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS base_amount_usd NUMERIC(20, 6),
  ADD COLUMN IF NOT EXISTS exchange_rate_to_usd NUMERIC(20, 8) DEFAULT 1.00000000,
  ADD COLUMN IF NOT EXISTS fx_rate_timestamp TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fx_source TEXT DEFAULT 'MANUAL';

-- Backfill multi-currency columns for existing rows
UPDATE public.capital_events
SET
  original_amount = COALESCE(original_amount, amount),
  original_currency = COALESCE(original_currency, currency, 'USD'),
  base_amount_usd = COALESCE(base_amount_usd, amount),
  exchange_rate_to_usd = COALESCE(exchange_rate_to_usd, 1.00000000)
WHERE original_amount IS NULL OR base_amount_usd IS NULL;


-- 2. HARDEN FINANCIAL LEDGER: BASE USD GUARANTEE & COLUMNS
ALTER TABLE public.financial_ledger
  ADD COLUMN IF NOT EXISTS original_amount NUMERIC(20, 6),
  ADD COLUMN IF NOT EXISTS original_currency TEXT DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS exchange_rate_to_usd NUMERIC(20, 8) DEFAULT 1.00000000;

UPDATE public.financial_ledger
SET
  original_amount = COALESCE(original_amount, amount),
  original_currency = COALESCE(original_currency, currency, 'USD'),
  exchange_rate_to_usd = COALESCE(exchange_rate_to_usd, 1.00000000)
WHERE original_amount IS NULL;


-- 3. FINANCIAL IMMUTABILITY TRIGGERS
-- Trigger: Prevent ANY direct UPDATE or DELETE on financial_ledger
CREATE OR REPLACE FUNCTION public.prevent_financial_ledger_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('app.allow_financial_cleanup', true) = 'true' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  RAISE EXCEPTION 'Financial Immutability Violation: Direct % on financial_ledger is prohibited. Financial records must be corrected via ADJUSTMENT or REVERSAL entries.', TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_financial_ledger_mutation ON public.financial_ledger;
CREATE TRIGGER trg_prevent_financial_ledger_mutation
  BEFORE UPDATE OR DELETE ON public.financial_ledger
  FOR EACH ROW EXECUTE FUNCTION public.prevent_financial_ledger_mutation();

-- Trigger: Prevent modification or deletion of ACTIVATED capital events
CREATE OR REPLACE FUNCTION public.prevent_activated_capital_event_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('app.allow_financial_cleanup', true) = 'true' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'ACTIVATED' THEN
      RAISE EXCEPTION 'Financial Immutability Violation: Cannot DELETE an ACTIVATED capital event (ID: %). Use REVERSAL instead.', OLD.id;
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'ACTIVATED' THEN
      -- Prohibit modifying financial parameters
      IF OLD.amount IS DISTINCT FROM NEW.amount
         OR OLD.currency IS DISTINCT FROM NEW.currency
         OR OLD.original_amount IS DISTINCT FROM NEW.original_amount
         OR OLD.original_currency IS DISTINCT FROM NEW.original_currency
         OR OLD.base_amount_usd IS DISTINCT FROM NEW.base_amount_usd
         OR OLD.exchange_rate_to_usd IS DISTINCT FROM NEW.exchange_rate_to_usd
         OR OLD.investor_id IS DISTINCT FROM NEW.investor_id
         OR OLD.event_type IS DISTINCT FROM NEW.event_type
         OR OLD.status IS DISTINCT FROM NEW.status THEN
        RAISE EXCEPTION 'Financial Immutability Violation: Cannot alter financial terms of an ACTIVATED capital event (ID: %).', OLD.id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_activated_capital_event_mutation ON public.capital_events;
CREATE TRIGGER trg_prevent_activated_capital_event_mutation
  BEFORE UPDATE OR DELETE ON public.capital_events
  FOR EACH ROW EXECUTE FUNCTION public.prevent_activated_capital_event_mutation();


-- 4. HARDEN SECURITY DEFINER PROCEDURES WITH CALLER AUTHORIZATION

-- Drop dependent view before replacing function with new signature
DROP VIEW IF EXISTS public.investor_financial_summary CASCADE;
DROP FUNCTION IF EXISTS public.get_investor_financial_position(UUID) CASCADE;

-- Function: Compute Investor Financial Position (Strict Caller Validation & Standardized Schema)
CREATE OR REPLACE FUNCTION public.get_investor_financial_position(p_investor_id UUID)
RETURNS TABLE (
  cumulative_deposited NUMERIC,
  current_contributed_capital NUMERIC,
  active_committed_capital NUMERIC,
  available_capital NUMERIC,
  realized_trading_pnl NUMERIC,
  current_economic_equity NUMERIC,
  settled_capital NUMERIC,
  cumulative_withdrawn NUMERIC,
  open_trades_count INTEGER,
  closed_trades_count INTEGER
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_deposited NUMERIC(20, 6) := 0;
  v_withdrawn NUMERIC(20, 6) := 0;
  v_pnl NUMERIC(20, 6) := 0;
  v_committed NUMERIC(20, 6) := 0;
  v_open_count INTEGER := 0;
  v_closed_count INTEGER := 0;
BEGIN
  -- Strict Caller Authorization Check: auth.uid() must be account owner or Admin
  IF auth.uid() IS NOT NULL THEN
    IF NOT (public.is_admin(auth.uid()) OR EXISTS (
      SELECT 1 FROM public.investor_accounts WHERE id = p_investor_id AND user_id = auth.uid()
    )) THEN
      RAISE EXCEPTION 'Access denied: unauthorized query for investor position % by user %', p_investor_id, auth.uid();
    END IF;
  END IF;

  -- 1. Cumulative Activated Capital Deposits (in base USD)
  SELECT COALESCE(SUM(COALESCE(base_amount_usd, amount)), 0) INTO v_deposited
  FROM public.capital_events
  WHERE investor_id = p_investor_id
    AND status = 'ACTIVATED'
    AND event_type IN ('INITIAL_CAPITAL', 'ADDITIONAL_CAPITAL');

  -- 2. Cumulative Processed Withdrawals (in base USD)
  SELECT COALESCE(SUM(amount), 0) INTO v_withdrawn
  FROM public.financial_ledger
  WHERE investor_id = p_investor_id
    AND event_type = 'WITHDRAWAL_PROCESSED';

  -- 3. Total Realized PnL from Ledger
  SELECT COALESCE(SUM(amount), 0) INTO v_pnl
  FROM public.financial_ledger
  WHERE investor_id = p_investor_id
    AND event_type IN ('TRADE_ALLOCATION_PROFIT', 'TRADE_ALLOCATION_LOSS', 'CYCLE_SETTLEMENT_PROFIT');

  -- 4. Active Committed Capital on Open Trades
  SELECT
    COALESCE(SUM(tp.participating_capital_snapshot), 0),
    COUNT(tp.id)
  INTO v_committed, v_open_count
  FROM public.trade_participations tp
  JOIN public.trades t ON t.trade_id = tp.trade_id
  WHERE tp.investor_id = p_investor_id
    AND tp.status = 'COMMITTED'
    AND t.trade_status NOT IN ('POST_ANALYZED', 'JOURNALED', 'DELETED');

  -- 5. Closed Trades Count
  SELECT COUNT(tp.id) INTO v_closed_count
  FROM public.trade_participations tp
  WHERE tp.investor_id = p_investor_id
    AND tp.status = 'ALLOCATED';

  -- Return Standardized Result Record
  cumulative_deposited := v_deposited;
  cumulative_withdrawn := v_withdrawn;
  current_contributed_capital := (v_deposited - v_withdrawn);
  realized_trading_pnl := v_pnl;
  current_economic_equity := (v_deposited + v_pnl - v_withdrawn);
  active_committed_capital := v_committed;
  available_capital := GREATEST(0, (v_deposited + v_pnl - v_withdrawn) - v_committed);
  settled_capital := (v_deposited - v_withdrawn);
  open_trades_count := v_open_count;
  closed_trades_count := v_closed_count;
  RETURN NEXT;
END;
$$;


-- Function: Activate Capital Event (With Multi-Currency Base USD Conversion)
CREATE OR REPLACE FUNCTION public.activate_capital_event(
  p_event_id UUID,
  p_admin_user_id UUID DEFAULT auth.uid()
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event RECORD;
  v_ledger_event public.ledger_event_type;
  v_ledger_id UUID;
  v_base_usd NUMERIC(20, 6);
  v_fx_rate NUMERIC(20, 8);
BEGIN
  -- Verify admin authorization if invoked in user context
  IF auth.uid() IS NOT NULL AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can activate capital events.';
  END IF;

  SELECT * INTO v_event FROM public.capital_events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Capital event not found: %', p_event_id;
  END IF;

  IF v_event.status = 'ACTIVATED' THEN
    RETURN jsonb_build_object('status', 'already_activated', 'event_id', p_event_id);
  END IF;

  v_fx_rate := COALESCE(v_event.exchange_rate_to_usd, 1.00000000);
  v_base_usd := COALESCE(
    v_event.base_amount_usd,
    ROUND((COALESCE(v_event.original_amount, v_event.amount) * v_fx_rate), 6)
  );

  UPDATE public.capital_events
  SET status = 'ACTIVATED',
      activated_at = COALESCE(activated_at, now()),
      original_amount = COALESCE(original_amount, amount),
      original_currency = COALESCE(original_currency, currency, 'USD'),
      exchange_rate_to_usd = v_fx_rate,
      base_amount_usd = v_base_usd,
      updated_at = now()
  WHERE id = p_event_id;

  -- Map capital event type to ledger event type
  IF v_event.event_type = 'INITIAL_CAPITAL' THEN
    v_ledger_event := 'CAPITAL_ACTIVATED';
  ELSIF v_event.event_type = 'ADDITIONAL_CAPITAL' THEN
    v_ledger_event := 'ADDITIONAL_CAPITAL';
  ELSIF v_event.event_type = 'WITHDRAWAL' THEN
    v_ledger_event := 'WITHDRAWAL_PROCESSED';
  ELSIF v_event.event_type = 'ADJUSTMENT' THEN
    v_ledger_event := 'ADJUSTMENT';
  ELSE
    v_ledger_event := 'REVERSAL';
  END IF;

  -- Post to Financial Ledger in Base USD
  INSERT INTO public.financial_ledger (
    investor_id, event_type, amount, currency,
    original_amount, original_currency, exchange_rate_to_usd,
    idempotency_key, reference_id, description, metadata
  ) VALUES (
    v_event.investor_id,
    v_ledger_event,
    v_base_usd,
    'USD',
    COALESCE(v_event.original_amount, v_event.amount),
    COALESCE(v_event.original_currency, v_event.currency, 'USD'),
    v_fx_rate,
    'cap_act_' || p_event_id,
    p_event_id::text,
    'Capital activation: ' || v_event.event_type || ' of ' || COALESCE(v_event.original_amount, v_event.amount) || ' ' || COALESCE(v_event.original_currency, v_event.currency, 'USD') || ' (USD ' || v_base_usd || ')',
    jsonb_build_object(
      'capital_event_id', p_event_id,
      'activated_by', COALESCE(p_admin_user_id, auth.uid()),
      'original_amount', COALESCE(v_event.original_amount, v_event.amount),
      'original_currency', COALESCE(v_event.original_currency, v_event.currency, 'USD'),
      'exchange_rate_to_usd', v_fx_rate,
      'base_amount_usd', v_base_usd
    )
  ) ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_ledger_id;

  RETURN jsonb_build_object(
    'status', 'success',
    'event_id', p_event_id,
    'base_amount_usd', v_base_usd,
    'activated_at', now(),
    'ledger_id', v_ledger_id
  );
END;
$$;


-- 5. HARDEN RLS AND TABLE ACCESS PERMISSIONS
-- Lock down financial_ledger direct mutations
REVOKE INSERT, UPDATE, DELETE ON public.financial_ledger FROM authenticated, anon;
GRANT SELECT ON public.financial_ledger TO authenticated;
GRANT ALL ON public.financial_ledger TO service_role;

-- Tighten withdrawal_requests RLS
DROP POLICY IF EXISTS "withdrawal_requests_investor_manage" ON public.withdrawal_requests;
DROP POLICY IF EXISTS "withdrawal_requests_investor_select" ON public.withdrawal_requests;
DROP POLICY IF EXISTS "withdrawal_requests_investor_insert" ON public.withdrawal_requests;
DROP POLICY IF EXISTS "withdrawal_requests_investor_update" ON public.withdrawal_requests;
DROP POLICY IF EXISTS "withdrawal_requests_admin_manage" ON public.withdrawal_requests;

CREATE POLICY "withdrawal_requests_investor_select" ON public.withdrawal_requests
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.investor_accounts
      WHERE id = withdrawal_requests.investor_id AND user_id = auth.uid()
    ) OR public.is_admin(auth.uid())
  );

CREATE POLICY "withdrawal_requests_investor_insert" ON public.withdrawal_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.investor_accounts
      WHERE id = withdrawal_requests.investor_id AND user_id = auth.uid()
    )
    AND (status = 'REQUESTED' OR status IS NULL)
    AND COALESCE(crystallized_performance_pnl, 0) = 0
    AND COALESCE(company_profit_share_deducted, 0) = 0
  );

CREATE POLICY "withdrawal_requests_investor_update" ON public.withdrawal_requests
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.investor_accounts
      WHERE id = withdrawal_requests.investor_id AND user_id = auth.uid()
    )
    AND status IN ('REQUESTED', 'UNDER_REVIEW')
  )
  WITH CHECK (status = 'CANCELLED');

CREATE POLICY "withdrawal_requests_admin_manage" ON public.withdrawal_requests
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));


-- 6. HARDENED REPORTING READ MODELS & VIEWS

-- View: Company-wide Financial Summary (Admin Only Guard)
DROP VIEW IF EXISTS public.company_financial_summary CASCADE;
CREATE OR REPLACE VIEW public.company_financial_summary WITH (security_invoker = true) AS
WITH deposits AS (
  SELECT
    COALESCE(SUM(COALESCE(base_amount_usd, amount)), 0) AS total_deposited
  FROM public.capital_events
  WHERE status = 'ACTIVATED' AND event_type IN ('INITIAL_CAPITAL', 'ADDITIONAL_CAPITAL')
),
withdrawals AS (
  SELECT
    COALESCE(SUM(amount), 0) AS total_withdrawn
  FROM public.financial_ledger
  WHERE event_type = 'WITHDRAWAL_PROCESSED'
),
trading_pnl AS (
  SELECT
    COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) AS total_gross_profit,
    COALESCE(SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END), 0) AS total_gross_loss,
    COALESCE(SUM(amount), 0) AS net_trading_pnl
  FROM public.financial_ledger
  WHERE event_type IN ('TRADE_ALLOCATION_PROFIT', 'TRADE_ALLOCATION_LOSS')
),
committed_exposure AS (
  SELECT
    COALESCE(SUM(tp.participating_capital_snapshot), 0) AS total_active_committed_capital,
    COALESCE(SUM(tp.risk_amount), 0) AS total_active_risk_amount
  FROM public.trade_participations tp
  JOIN public.trades t ON t.trade_id = tp.trade_id
  WHERE tp.status = 'COMMITTED'
    AND t.trade_status NOT IN ('POST_ANALYZED', 'JOURNALED', 'DELETED')
),
counts AS (
  SELECT
    (SELECT COUNT(*) FROM public.investor_accounts) AS total_investors,
    (SELECT COUNT(*) FROM public.investor_accounts WHERE status = 'ACTIVE') AS active_investors,
    (SELECT COUNT(*) FROM public.trades WHERE trade_status NOT IN ('POST_ANALYZED', 'JOURNALED', 'DELETED')) AS open_trades_count,
    (SELECT COUNT(*) FROM public.trades WHERE trade_status IN ('POST_ANALYZED', 'JOURNALED')) AS closed_trades_count
)
SELECT
  d.total_deposited,
  ce.total_active_committed_capital,
  GREATEST(0, (d.total_deposited + tpnl.net_trading_pnl - w.total_withdrawn) - ce.total_active_committed_capital) AS total_available_capital,
  (d.total_deposited + tpnl.net_trading_pnl - w.total_withdrawn) AS total_economic_equity,
  w.total_withdrawn,
  tpnl.total_gross_profit,
  tpnl.total_gross_loss,
  tpnl.net_trading_pnl,
  ce.total_active_risk_amount,
  c.total_investors,
  c.active_investors,
  c.open_trades_count,
  c.closed_trades_count,
  ROUND((tpnl.total_gross_profit * 0.30), 6) AS pending_company_profit_share
FROM deposits d
CROSS JOIN withdrawals w
CROSS JOIN trading_pnl tpnl
CROSS JOIN committed_exposure ce
CROSS JOIN counts c
WHERE (auth.uid() IS NULL OR public.is_admin(auth.uid()));

REVOKE ALL ON public.company_financial_summary FROM anon;
GRANT SELECT ON public.company_financial_summary TO authenticated, service_role;


-- View: Portfolio Exposure Summary (Admin Only Guard)
DROP VIEW IF EXISTS public.portfolio_exposure_summary CASCADE;
CREATE OR REPLACE VIEW public.portfolio_exposure_summary WITH (security_invoker = true) AS
SELECT
  t.pair,
  t.direction,
  COUNT(DISTINCT t.trade_id) AS open_trades_count,
  COALESCE(SUM(tp.participating_capital_snapshot), 0) AS total_committed_capital,
  COALESCE(SUM(tp.risk_amount), 0) AS total_risk_amount,
  COUNT(DISTINCT tp.investor_id) AS investors_exposed_count
FROM public.trades t
LEFT JOIN public.trade_participations tp ON tp.trade_id = t.trade_id AND tp.status = 'COMMITTED'
WHERE t.trade_status NOT IN ('POST_ANALYZED', 'JOURNALED', 'DELETED')
  AND (auth.uid() IS NULL OR public.is_admin(auth.uid()))
GROUP BY t.pair, t.direction;

REVOKE ALL ON public.portfolio_exposure_summary FROM anon;
GRANT SELECT ON public.portfolio_exposure_summary TO authenticated, service_role;


-- View: Investor Financial Summary (Scoped to User via Security Invoker)
CREATE OR REPLACE VIEW public.investor_financial_summary WITH (security_invoker = true) AS
SELECT
  ia.id AS investor_id,
  ia.user_id,
  ia.account_number,
  ia.currency,
  ia.status AS account_status,
  pos.cumulative_deposited,
  pos.current_contributed_capital,
  pos.active_committed_capital,
  pos.available_capital,
  pos.settled_capital,
  pos.realized_trading_pnl,
  pos.current_economic_equity,
  pos.cumulative_withdrawn,
  pos.open_trades_count,
  pos.closed_trades_count
FROM public.investor_accounts ia
CROSS JOIN LATERAL public.get_investor_financial_position(ia.id) pos;

GRANT SELECT ON public.investor_financial_summary TO authenticated, service_role;


-- View: Investor Trade History (Scoped to User via Security Invoker)
DROP VIEW IF EXISTS public.investor_trade_history CASCADE;
CREATE OR REPLACE VIEW public.investor_trade_history WITH (security_invoker = true) AS
SELECT
  tp.id AS participation_id,
  tp.investor_id,
  ia.user_id,
  ia.account_number,
  tp.trade_id,
  t.pair,
  t.direction,
  t.entry_price,
  t.trade_status,
  t.created_at AS trade_entry_time,
  tp.cycle_id,
  ic.cycle_number,
  tp.participating_capital_snapshot,
  tp.risk_pct,
  tp.risk_amount,
  tp.status AS participation_status,
  r.closing_price,
  r.pnl_percent,
  r.outcome,
  tp.investor_gross_pnl,
  CASE
    WHEN tp.investor_gross_pnl > 0 THEN ROUND((tp.investor_gross_pnl * (COALESCE(ic.investor_profit_share_pct, 70.00) / 100.0)), 6)
    ELSE tp.investor_gross_pnl
  END AS investor_net_pnl,
  tp.created_at,
  tp.updated_at
FROM public.trade_participations tp
JOIN public.investor_accounts ia ON ia.id = tp.investor_id
JOIN public.trades t ON t.trade_id = tp.trade_id
LEFT JOIN public.results r ON r.trade_id = t.trade_id
LEFT JOIN public.investment_cycles ic ON ic.id = tp.cycle_id;

GRANT SELECT ON public.investor_trade_history TO authenticated, service_role;


-- 7. RECONCILIATION ENGINE
CREATE OR REPLACE FUNCTION public.reconcile_financial_system()
RETURNS TABLE (
  check_code TEXT,
  check_name TEXT,
  severity TEXT,
  discrepancy_count INTEGER,
  details JSONB
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count INTEGER;
  v_data JSONB;
BEGIN
  -- Strict Admin Guard
  IF auth.uid() IS NOT NULL AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can execute financial reconciliation.';
  END IF;

  -- 1. Check Orphaned Financial Ledger Records
  SELECT COUNT(*), jsonb_agg(jsonb_build_object('ledger_id', fl.id, 'investor_id', fl.investor_id))
  INTO v_count, v_data
  FROM public.financial_ledger fl
  LEFT JOIN public.investor_accounts ia ON ia.id = fl.investor_id
  WHERE ia.id IS NULL;

  check_code := 'ORPHAN_LEDGER';
  check_name := 'Orphaned Financial Ledger Entries';
  severity := CASE WHEN v_count > 0 THEN 'ERROR' ELSE 'OK' END;
  discrepancy_count := COALESCE(v_count, 0);
  details := COALESCE(v_data, '[]'::jsonb);
  RETURN NEXT;

  -- 2. Check Activated Capital Events Missing Ledger Entries
  SELECT COUNT(*), jsonb_agg(jsonb_build_object('event_id', ce.id, 'amount', ce.amount))
  INTO v_count, v_data
  FROM public.capital_events ce
  LEFT JOIN public.financial_ledger fl ON fl.idempotency_key = ('cap_act_' || ce.id)
  WHERE ce.status = 'ACTIVATED' AND ce.event_type IN ('INITIAL_CAPITAL', 'ADDITIONAL_CAPITAL') AND fl.id IS NULL;

  check_code := 'UNPOSTED_CAPITAL';
  check_name := 'Activated Capital Events Unposted to Ledger';
  severity := CASE WHEN v_count > 0 THEN 'ERROR' ELSE 'OK' END;
  discrepancy_count := COALESCE(v_count, 0);
  details := COALESCE(v_data, '[]'::jsonb);
  RETURN NEXT;

  -- 3. Check Closed Trades Missing Allocation Entries
  SELECT COUNT(*), jsonb_agg(jsonb_build_object('trade_id', t.trade_id, 'participation_id', tp.id))
  INTO v_count, v_data
  FROM public.trade_participations tp
  JOIN public.trades t ON t.trade_id = tp.trade_id
  LEFT JOIN public.financial_ledger fl ON fl.idempotency_key = ('alloc_' || tp.id)
  WHERE t.trade_status IN ('POST_ANALYZED', 'JOURNALED')
    AND tp.status = 'COMMITTED'
    AND fl.id IS NULL;

  check_code := 'UNALLOCATED_CLOSED_TRADES';
  check_name := 'Closed Trades with Unallocated Participations';
  severity := CASE WHEN v_count > 0 THEN 'WARNING' ELSE 'OK' END;
  discrepancy_count := COALESCE(v_count, 0);
  details := COALESCE(v_data, '[]'::jsonb);
  RETURN NEXT;

  -- 4. Check Duplicate Trade Allocations on Ledger
  SELECT COUNT(*), jsonb_agg(sub.alloc_data)
  INTO v_count, v_data
  FROM (
    SELECT fl.participation_id, COUNT(*) as cnt, jsonb_build_object('participation_id', fl.participation_id, 'count', COUNT(*)) AS alloc_data
    FROM public.financial_ledger fl
    WHERE fl.participation_id IS NOT NULL
    GROUP BY fl.participation_id
    HAVING COUNT(*) > 1
  ) sub;

  check_code := 'DUPLICATE_ALLOCATIONS';
  check_name := 'Duplicate Trade Allocations in Ledger';
  severity := CASE WHEN v_count > 0 THEN 'ERROR' ELSE 'OK' END;
  discrepancy_count := COALESCE(v_count, 0);
  details := COALESCE(v_data, '[]'::jsonb);
  RETURN NEXT;

  -- 5. Check Overcommitted Investor Capital (Available < 0)
  SELECT COUNT(*), jsonb_agg(jsonb_build_object('investor_id', ia.id, 'equity', pos.current_economic_equity, 'committed', pos.active_committed_capital))
  INTO v_count, v_data
  FROM public.investor_accounts ia
  CROSS JOIN LATERAL public.get_investor_financial_position(ia.id) pos
  WHERE pos.current_economic_equity < pos.active_committed_capital;

  check_code := 'OVERCOMMITTED_CAPITAL';
  check_name := 'Investors with Overcommitted Capital';
  severity := CASE WHEN v_count > 0 THEN 'ERROR' ELSE 'OK' END;
  discrepancy_count := COALESCE(v_count, 0);
  details := COALESCE(v_data, '[]'::jsonb);
  RETURN NEXT;

  -- 6. Check Multi-Currency FX Base Amount USD Integrity
  SELECT COUNT(*), jsonb_agg(jsonb_build_object('event_id', ce.id, 'currency', ce.currency, 'base_usd', ce.base_amount_usd))
  INTO v_count, v_data
  FROM public.capital_events ce
  WHERE ce.status = 'ACTIVATED' AND (ce.base_amount_usd IS NULL OR ce.base_amount_usd <= 0);

  check_code := 'INVALID_FX_BASE';
  check_name := 'Activated Capital Events with Invalid Base USD';
  severity := CASE WHEN v_count > 0 THEN 'ERROR' ELSE 'OK' END;
  discrepancy_count := COALESCE(v_count, 0);
  details := COALESCE(v_data, '[]'::jsonb);
  RETURN NEXT;

  -- 7. Check Investment Cycles Split Total
  SELECT COUNT(*), jsonb_agg(jsonb_build_object('cycle_id', ic.id, 'investor_pct', ic.investor_profit_share_pct, 'company_pct', ic.company_profit_share_pct))
  INTO v_count, v_data
  FROM public.investment_cycles ic
  WHERE (ic.investor_profit_share_pct + ic.company_profit_share_pct) != 100.00;

  check_code := 'INVALID_CYCLE_SPLIT';
  check_name := 'Investment Cycles with Invalid Split Percentage';
  severity := CASE WHEN v_count > 0 THEN 'ERROR' ELSE 'OK' END;
  discrepancy_count := COALESCE(v_count, 0);
  details := COALESCE(v_data, '[]'::jsonb);
  RETURN NEXT;

  RETURN;
END;
$$;
