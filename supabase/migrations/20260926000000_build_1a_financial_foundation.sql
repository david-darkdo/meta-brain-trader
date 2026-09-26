-- ============================================================================
-- METABRAIN TRADER — BUILD 1A: DEFINITIVE FINANCIAL FOUNDATION
-- ============================================================================

-- 1. ENUMS
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('ADMIN', 'TRADER', 'INVESTOR');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.investor_account_status AS ENUM ('PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.capital_event_type AS ENUM ('INITIAL_CAPITAL', 'ADDITIONAL_CAPITAL', 'WITHDRAWAL', 'ADJUSTMENT', 'REVERSAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.capital_event_status AS ENUM ('PENDING', 'ACTIVATED', 'REJECTED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.cycle_duration_unit AS ENUM ('DAYS', 'WEEKS', 'MONTHS', 'YEARS');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.investment_cycle_status AS ENUM ('UPCOMING', 'ACTIVE', 'SETTLING', 'SETTLED', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.risk_basis_type AS ENUM ('AVAILABLE_CAPITAL', 'PARTICIPATING_CAPITAL', 'ACCOUNT_EQUITY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.participation_status AS ENUM ('COMMITTED', 'ALLOCATED', 'SETTLED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ledger_event_type AS ENUM (
    'CAPITAL_ACTIVATED',
    'ADDITIONAL_CAPITAL',
    'TRADE_ALLOCATION_PROFIT',
    'TRADE_ALLOCATION_LOSS',
    'CYCLE_SETTLEMENT_PROFIT',
    'CYCLE_SETTLEMENT_INVESTOR_SHARE',
    'CYCLE_SETTLEMENT_COMPANY_SHARE',
    'WITHDRAWAL_REQUESTED',
    'WITHDRAWAL_PROCESSED',
    'ADJUSTMENT',
    'REVERSAL'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.withdrawal_status AS ENUM (
    'REQUESTED',
    'UNDER_REVIEW',
    'WAITING_FOR_OPEN_TRADES',
    'PERFORMANCE_CRYSTALLIZATION_REQUIRED',
    'APPROVED',
    'PROCESSED',
    'REJECTED',
    'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- 2. USER ROLES TABLE
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT ALL ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Helper authorization functions
CREATE OR REPLACE FUNCTION public.is_admin(p_user_id UUID DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_user_id AND role = 'ADMIN'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_investor(p_user_id UUID DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_user_id AND role = 'INVESTOR'
  );
$$;

-- Policies for user_roles
DROP POLICY IF EXISTS "user_roles_self_or_admin_read" ON public.user_roles;
CREATE POLICY "user_roles_self_or_admin_read" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "user_roles_admin_manage" ON public.user_roles;
CREATE POLICY "user_roles_admin_manage" ON public.user_roles FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


-- 3. PLATFORM FINANCIAL CONFIGURATION TABLE
CREATE TABLE IF NOT EXISTS public.platform_configuration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version INTEGER NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT false,
  base_currency TEXT NOT NULL DEFAULT 'USD',
  supported_display_currencies TEXT[] NOT NULL DEFAULT ARRAY['USD', 'NGN'],
  default_cycle_duration_value INTEGER NOT NULL DEFAULT 3,
  default_cycle_duration_unit public.cycle_duration_unit NOT NULL DEFAULT 'MONTHS',
  investor_profit_share_pct NUMERIC(5, 2) NOT NULL DEFAULT 70.00,
  company_profit_share_pct NUMERIC(5, 2) NOT NULL DEFAULT 30.00,
  risk_basis public.risk_basis_type NOT NULL DEFAULT 'AVAILABLE_CAPITAL',
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_configuration TO authenticated;
GRANT ALL ON public.platform_configuration TO service_role;
ALTER TABLE public.platform_configuration ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_config_read" ON public.platform_configuration;
CREATE POLICY "platform_config_read" ON public.platform_configuration FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "platform_config_admin_write" ON public.platform_configuration;
CREATE POLICY "platform_config_admin_write" ON public.platform_configuration FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Insert initial platform config v1 if not present
INSERT INTO public.platform_configuration (
  version, is_active, base_currency, supported_display_currencies,
  default_cycle_duration_value, default_cycle_duration_unit,
  investor_profit_share_pct, company_profit_share_pct, risk_basis, notes
) VALUES (
  1, true, 'USD', ARRAY['USD', 'NGN'], 3, 'MONTHS', 70.00, 30.00, 'AVAILABLE_CAPITAL', 'Initial Build 1A standard configuration'
) ON CONFLICT (version) DO NOTHING;


-- 4. INVESTOR ACCOUNTS TABLE
CREATE TABLE IF NOT EXISTS public.investor_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  account_number TEXT NOT NULL UNIQUE,
  status public.investor_account_status NOT NULL DEFAULT 'ACTIVE',
  currency TEXT NOT NULL DEFAULT 'USD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);
GRANT ALL ON public.investor_accounts TO authenticated;
GRANT ALL ON public.investor_accounts TO service_role;
ALTER TABLE public.investor_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "investor_accounts_owner_read" ON public.investor_accounts;
CREATE POLICY "investor_accounts_owner_read" ON public.investor_accounts FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "investor_accounts_admin_manage" ON public.investor_accounts;
CREATE POLICY "investor_accounts_admin_manage" ON public.investor_accounts FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP TRIGGER IF EXISTS trg_investor_accounts_updated ON public.investor_accounts;
CREATE TRIGGER trg_investor_accounts_updated BEFORE UPDATE ON public.investor_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- 5. INVESTMENT CYCLES TABLE
CREATE TABLE IF NOT EXISTS public.investment_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cycle_number INTEGER NOT NULL UNIQUE,
  duration_value INTEGER NOT NULL DEFAULT 3,
  duration_unit public.cycle_duration_unit NOT NULL DEFAULT 'MONTHS',
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  status public.investment_cycle_status NOT NULL DEFAULT 'ACTIVE',
  config_version INTEGER NOT NULL DEFAULT 1 REFERENCES public.platform_configuration(version),
  investor_profit_share_pct NUMERIC(5, 2) NOT NULL DEFAULT 70.00,
  company_profit_share_pct NUMERIC(5, 2) NOT NULL DEFAULT 30.00,
  total_realized_pnl NUMERIC(20, 6) DEFAULT 0.000000,
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.investment_cycles TO authenticated;
GRANT ALL ON public.investment_cycles TO service_role;
ALTER TABLE public.investment_cycles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "investment_cycles_read" ON public.investment_cycles;
CREATE POLICY "investment_cycles_read" ON public.investment_cycles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "investment_cycles_admin_manage" ON public.investment_cycles;
CREATE POLICY "investment_cycles_admin_manage" ON public.investment_cycles FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP TRIGGER IF EXISTS trg_investment_cycles_updated ON public.investment_cycles;
CREATE TRIGGER trg_investment_cycles_updated BEFORE UPDATE ON public.investment_cycles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Insert initial cycle 1 if not present
INSERT INTO public.investment_cycles (
  name, cycle_number, duration_value, duration_unit, start_date, end_date,
  status, config_version, investor_profit_share_pct, company_profit_share_pct
) VALUES (
  'MetaFund Inaugural Cycle 1', 1, 3, 'MONTHS', now(), now() + interval '3 months',
  'ACTIVE', 1, 70.00, 30.00
) ON CONFLICT (cycle_number) DO NOTHING;


-- 6. CAPITAL EVENTS TABLE
CREATE TABLE IF NOT EXISTS public.capital_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id UUID NOT NULL REFERENCES public.investor_accounts(id) ON DELETE RESTRICT,
  event_type public.capital_event_type NOT NULL,
  amount NUMERIC(20, 6) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  status public.capital_event_status NOT NULL DEFAULT 'PENDING',
  activated_at TIMESTAMPTZ,
  notes TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.capital_events TO authenticated;
GRANT ALL ON public.capital_events TO service_role;
ALTER TABLE public.capital_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "capital_events_investor_read" ON public.capital_events;
CREATE POLICY "capital_events_investor_read" ON public.capital_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.investor_accounts WHERE id = capital_events.investor_id AND user_id = auth.uid()) OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "capital_events_admin_manage" ON public.capital_events;
CREATE POLICY "capital_events_admin_manage" ON public.capital_events FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP TRIGGER IF EXISTS trg_capital_events_updated ON public.capital_events;
CREATE TRIGGER trg_capital_events_updated BEFORE UPDATE ON public.capital_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- 7. TRADE PARTICIPATIONS TABLE
CREATE TABLE IF NOT EXISTS public.trade_participations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID NOT NULL REFERENCES public.trades(trade_id) ON DELETE RESTRICT,
  investor_id UUID NOT NULL REFERENCES public.investor_accounts(id) ON DELETE RESTRICT,
  cycle_id UUID REFERENCES public.investment_cycles(id) ON DELETE RESTRICT,
  participation_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  participating_capital_snapshot NUMERIC(20, 6) NOT NULL CHECK (participating_capital_snapshot >= 0),
  risk_basis public.risk_basis_type NOT NULL DEFAULT 'AVAILABLE_CAPITAL',
  risk_pct NUMERIC(5, 2) NOT NULL DEFAULT 1.00,
  risk_amount NUMERIC(20, 6) NOT NULL DEFAULT 0.000000,
  status public.participation_status NOT NULL DEFAULT 'COMMITTED',
  result_pnl_percent NUMERIC(8, 4),
  investor_gross_pnl NUMERIC(20, 6),
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(trade_id, investor_id)
);
GRANT ALL ON public.trade_participations TO authenticated;
GRANT ALL ON public.trade_participations TO service_role;
ALTER TABLE public.trade_participations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trade_participations_investor_read" ON public.trade_participations;
CREATE POLICY "trade_participations_investor_read" ON public.trade_participations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.investor_accounts WHERE id = trade_participations.investor_id AND user_id = auth.uid()) OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "trade_participations_admin_manage" ON public.trade_participations;
CREATE POLICY "trade_participations_admin_manage" ON public.trade_participations FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP TRIGGER IF EXISTS trg_trade_participations_updated ON public.trade_participations;
CREATE TRIGGER trg_trade_participations_updated BEFORE UPDATE ON public.trade_participations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- 8. EVENT-BASED FINANCIAL LEDGER TABLE
CREATE TABLE IF NOT EXISTS public.financial_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id UUID NOT NULL REFERENCES public.investor_accounts(id) ON DELETE RESTRICT,
  cycle_id UUID REFERENCES public.investment_cycles(id) ON DELETE RESTRICT,
  trade_id UUID REFERENCES public.trades(trade_id) ON DELETE RESTRICT,
  participation_id UUID REFERENCES public.trade_participations(id) ON DELETE RESTRICT,
  event_type public.ledger_event_type NOT NULL,
  amount NUMERIC(20, 6) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  running_balance_after NUMERIC(20, 6),
  idempotency_key TEXT NOT NULL UNIQUE,
  reference_id TEXT,
  description TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.financial_ledger TO authenticated;
GRANT ALL ON public.financial_ledger TO service_role;
ALTER TABLE public.financial_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "financial_ledger_investor_read" ON public.financial_ledger;
CREATE POLICY "financial_ledger_investor_read" ON public.financial_ledger FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.investor_accounts WHERE id = financial_ledger.investor_id AND user_id = auth.uid()) OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "financial_ledger_admin_manage" ON public.financial_ledger;
CREATE POLICY "financial_ledger_admin_manage" ON public.financial_ledger FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


-- 9. WITHDRAWAL REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id UUID NOT NULL REFERENCES public.investor_accounts(id) ON DELETE RESTRICT,
  cycle_id UUID REFERENCES public.investment_cycles(id) ON DELETE RESTRICT,
  requested_amount NUMERIC(20, 6) NOT NULL CHECK (requested_amount > 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  status public.withdrawal_status NOT NULL DEFAULT 'REQUESTED',
  crystallized_performance_pnl NUMERIC(20, 6) DEFAULT 0.000000,
  company_profit_share_deducted NUMERIC(20, 6) DEFAULT 0.000000,
  net_disbursed_amount NUMERIC(20, 6) DEFAULT 0.000000,
  rejection_reason TEXT,
  payout_details JSONB DEFAULT '{}'::jsonb,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.withdrawal_requests TO authenticated;
GRANT ALL ON public.withdrawal_requests TO service_role;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "withdrawal_requests_investor_manage" ON public.withdrawal_requests;
CREATE POLICY "withdrawal_requests_investor_manage" ON public.withdrawal_requests FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.investor_accounts WHERE id = withdrawal_requests.investor_id AND user_id = auth.uid()) OR public.is_admin(auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.investor_accounts WHERE id = withdrawal_requests.investor_id AND user_id = auth.uid()) OR public.is_admin(auth.uid()));

DROP TRIGGER IF EXISTS trg_withdrawal_requests_updated ON public.withdrawal_requests;
CREATE TRIGGER trg_withdrawal_requests_updated BEFORE UPDATE ON public.withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================================
-- PROCEDURAL DOMAIN FUNCTIONS (SERVER-AUTHORITATIVE & IDEMPOTENT)
-- ============================================================================

-- Function: Compute Investor Financial Position
CREATE OR REPLACE FUNCTION public.get_investor_financial_position(p_investor_id UUID)
RETURNS TABLE (
  total_deposited NUMERIC,
  active_committed_capital NUMERIC,
  available_capital NUMERIC,
  settled_capital NUMERIC,
  current_cycle_realized_pnl NUMERIC,
  current_economic_equity NUMERIC,
  total_withdrawn NUMERIC,
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
  -- 1. Total Activated Capital Deposits
  SELECT COALESCE(SUM(amount), 0) INTO v_deposited
  FROM public.capital_events
  WHERE investor_id = p_investor_id
    AND status = 'ACTIVATED'
    AND event_type IN ('INITIAL_CAPITAL', 'ADDITIONAL_CAPITAL');

  -- 2. Total Processed Withdrawals
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

  -- Return Result Record
  total_deposited := v_deposited;
  total_withdrawn := v_withdrawn;
  current_cycle_realized_pnl := v_pnl;
  current_economic_equity := (v_deposited + v_pnl - v_withdrawn);
  active_committed_capital := v_committed;
  available_capital := GREATEST(0, (v_deposited + v_pnl - v_withdrawn) - v_committed);
  settled_capital := (v_deposited - v_withdrawn);
  open_trades_count := v_open_count;
  closed_trades_count := v_closed_count;
  RETURN NEXT;
END;
$$;


-- Function: Activate Capital Event
CREATE OR REPLACE FUNCTION public.activate_capital_event(
  p_event_id UUID,
  p_admin_user_id UUID DEFAULT auth.uid()
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event RECORD;
  v_ledger_event public.ledger_event_type;
  v_ledger_id UUID;
BEGIN
  -- Verify admin authorization if invoked by user
  IF p_admin_user_id IS NOT NULL AND NOT public.is_admin(p_admin_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can activate capital events.';
  END IF;

  SELECT * INTO v_event FROM public.capital_events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Capital event not found: %', p_event_id;
  END IF;

  IF v_event.status = 'ACTIVATED' THEN
    RETURN jsonb_build_object('status', 'already_activated', 'event_id', p_event_id);
  END IF;

  UPDATE public.capital_events
  SET status = 'ACTIVATED',
      activated_at = COALESCE(activated_at, now()),
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

  -- Post to Financial Ledger (Idempotent)
  INSERT INTO public.financial_ledger (
    investor_id, event_type, amount, currency,
    idempotency_key, reference_id, description, metadata
  ) VALUES (
    v_event.investor_id,
    v_ledger_event,
    v_event.amount,
    v_event.currency,
    'cap_act_' || p_event_id,
    p_event_id::text,
    'Capital activation: ' || v_event.event_type || ' of ' || v_event.amount || ' ' || v_event.currency,
    jsonb_build_object('capital_event_id', p_event_id, 'activated_by', p_admin_user_id)
  ) ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_ledger_id;

  RETURN jsonb_build_object(
    'status', 'success',
    'event_id', p_event_id,
    'activated_at', now(),
    'ledger_id', v_ledger_id
  );
END;
$$;


-- Function: Snapshot Trade Participation
CREATE OR REPLACE FUNCTION public.snapshot_trade_participation(
  p_trade_id UUID,
  p_risk_basis public.risk_basis_type DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_trade RECORD;
  v_cycle RECORD;
  v_config RECORD;
  v_investor RECORD;
  v_basis public.risk_basis_type;
  v_risk_pct NUMERIC(5, 2);
  v_part_capital NUMERIC(20, 6);
  v_risk_amount NUMERIC(20, 6);
  v_created_count INTEGER := 0;
BEGIN
  SELECT * INTO v_trade FROM public.trades WHERE trade_id = p_trade_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trade not found: %', p_trade_id;
  END IF;

  -- Get active platform config & active investment cycle
  SELECT * INTO v_config FROM public.platform_configuration WHERE is_active = true ORDER BY version DESC LIMIT 1;
  SELECT * INTO v_cycle FROM public.investment_cycles WHERE status = 'ACTIVE' ORDER BY cycle_number DESC LIMIT 1;

  v_basis := COALESCE(p_risk_basis, v_config.risk_basis, 'AVAILABLE_CAPITAL');
  v_risk_pct := COALESCE(v_trade.risk_pct, 1.00);

  -- For each active investor with activated capital on or before trade creation time
  FOR v_investor IN
    SELECT ia.id AS investor_id
    FROM public.investor_accounts ia
    WHERE ia.status = 'ACTIVE'
      AND EXISTS (
        SELECT 1 FROM public.capital_events ce
        WHERE ce.investor_id = ia.id
          AND ce.status = 'ACTIVATED'
          AND ce.activated_at <= v_trade.created_at
      )
  LOOP
    -- Calculate investor's current participating capital snapshot based on activated capital prior to trade
    SELECT
      CASE
        WHEN v_basis = 'AVAILABLE_CAPITAL' THEN pos.available_capital
        WHEN v_basis = 'ACCOUNT_EQUITY' THEN pos.current_economic_equity
        ELSE pos.settled_capital
      END
    INTO v_part_capital
    FROM public.get_investor_financial_position(v_investor.investor_id) pos;

    IF v_part_capital > 0 THEN
      v_risk_amount := ROUND((v_part_capital * (v_risk_pct / 100.0)), 6);

      INSERT INTO public.trade_participations (
        trade_id, investor_id, cycle_id, participation_timestamp,
        participating_capital_snapshot, risk_basis, risk_pct, risk_amount,
        status, idempotency_key
      ) VALUES (
        p_trade_id, v_investor.investor_id, v_cycle.id, v_trade.created_at,
        v_part_capital, v_basis, v_risk_pct, v_risk_amount,
        'COMMITTED', 'part_' || p_trade_id || '_' || v_investor.investor_id
      ) ON CONFLICT (trade_id, investor_id) DO NOTHING;

      v_created_count := v_created_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'status', 'success',
    'trade_id', p_trade_id,
    'participations_created', v_created_count
  );
END;
$$;


-- Function: Process Trade Allocation (Deterministic & Idempotent)
CREATE OR REPLACE FUNCTION public.process_trade_allocation(
  p_trade_id UUID
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_trade RECORD;
  v_result RECORD;
  v_part RECORD;
  v_pnl_percent NUMERIC(8, 4);
  v_investor_pnl NUMERIC(20, 6);
  v_event_type public.ledger_event_type;
  v_allocated_count INTEGER := 0;
BEGIN
  SELECT * INTO v_trade FROM public.trades WHERE trade_id = p_trade_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trade not found: %', p_trade_id;
  END IF;

  SELECT * INTO v_result FROM public.results WHERE trade_id = p_trade_id;
  IF NOT FOUND OR v_result.pnl_percent IS NULL THEN
    RAISE EXCEPTION 'Authoritative trade result with pnl_percent not found for trade: %', p_trade_id;
  END IF;

  v_pnl_percent := v_result.pnl_percent;

  -- Ensure participations exist (snapshot if not already created)
  PERFORM public.snapshot_trade_participation(p_trade_id);

  FOR v_part IN
    SELECT * FROM public.trade_participations
    WHERE trade_id = p_trade_id FOR UPDATE
  LOOP
    -- Deterministic mathematical calculation: PnL = Participating Capital * (Return% / 100)
    v_investor_pnl := ROUND((v_part.participating_capital_snapshot * (v_pnl_percent / 100.0)), 6);

    IF v_investor_pnl >= 0 THEN
      v_event_type := 'TRADE_ALLOCATION_PROFIT';
    ELSE
      v_event_type := 'TRADE_ALLOCATION_LOSS';
    END IF;

    -- Update participation record
    UPDATE public.trade_participations
    SET status = 'ALLOCATED',
        result_pnl_percent = v_pnl_percent,
        investor_gross_pnl = v_investor_pnl,
        updated_at = now()
    WHERE id = v_part.id;

    -- Post to financial ledger (Idempotent)
    INSERT INTO public.financial_ledger (
      investor_id, cycle_id, trade_id, participation_id, event_type,
      amount, currency, idempotency_key, reference_id, description, metadata
    ) VALUES (
      v_part.investor_id,
      v_part.cycle_id,
      p_trade_id,
      v_part.id,
      v_event_type,
      v_investor_pnl,
      'USD',
      'alloc_' || v_part.id,
      p_trade_id::text,
      'Trade ' || v_trade.pair || ' allocation: ' || v_pnl_percent || '% on capital ' || v_part.participating_capital_snapshot,
      jsonb_build_object(
        'trade_id', p_trade_id,
        'pair', v_trade.pair,
        'direction', v_trade.direction,
        'pnl_percent', v_pnl_percent,
        'participating_capital', v_part.participating_capital_snapshot,
        'gross_pnl', v_investor_pnl
      )
    ) ON CONFLICT (idempotency_key) DO NOTHING;

    v_allocated_count := v_allocated_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'status', 'success',
    'trade_id', p_trade_id,
    'pnl_percent', v_pnl_percent,
    'investors_allocated', v_allocated_count
  );
END;
$$;


-- ============================================================================
-- REPORTING READ MODELS & ANALYTICAL VIEWS
-- ============================================================================

-- View: Company-wide Financial Summary
CREATE OR REPLACE VIEW public.company_financial_summary AS
WITH deposits AS (
  SELECT
    COALESCE(SUM(amount), 0) AS total_deposited
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
CROSS JOIN counts c;

GRANT SELECT ON public.company_financial_summary TO authenticated;
GRANT SELECT ON public.company_financial_summary TO service_role;


-- View: Portfolio Exposure by Currency Pair
CREATE OR REPLACE VIEW public.portfolio_exposure_summary AS
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
GROUP BY t.pair, t.direction;

GRANT SELECT ON public.portfolio_exposure_summary TO authenticated;
GRANT SELECT ON public.portfolio_exposure_summary TO service_role;


-- View: Investor Financial Summary (Scoped to auth.uid())
CREATE OR REPLACE VIEW public.investor_financial_summary AS
SELECT
  ia.id AS investor_id,
  ia.user_id,
  ia.account_number,
  ia.currency,
  ia.status AS account_status,
  pos.total_deposited,
  pos.active_committed_capital,
  pos.available_capital,
  pos.settled_capital,
  pos.current_cycle_realized_pnl,
  pos.current_economic_equity,
  pos.total_withdrawn,
  pos.open_trades_count,
  pos.closed_trades_count
FROM public.investor_accounts ia
CROSS JOIN LATERAL public.get_investor_financial_position(ia.id) pos;

GRANT SELECT ON public.investor_financial_summary TO authenticated;
GRANT SELECT ON public.investor_financial_summary TO service_role;
