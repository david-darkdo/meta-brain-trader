-- ============================================================================
-- METABRAIN TRADER — BUILD 1B: METAFUND OPERATIONAL ENGINE MIGRATION
-- Migration: 20260927020000_build_1b_metafund_operations.sql
-- ============================================================================

-- 1. TRADE & CAPITAL SCHEMA EXTENSION
ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS executed_at TIMESTAMPTZ;

ALTER TABLE public.capital_events
  ADD COLUMN IF NOT EXISTS effective_at TIMESTAMPTZ DEFAULT now();

-- Backfill executed_at ONLY for trades marked executed where executed_at is null
UPDATE public.trades
SET executed_at = created_at
WHERE executed = true AND executed_at IS NULL;


-- 2. UNIQUE CONSTRAINT ON TRADE PARTICIPATIONS & ADDITIONAL COLUMNS
ALTER TABLE public.trade_participations
  ADD COLUMN IF NOT EXISTS profit_split_investor_pct NUMERIC(5, 2) DEFAULT 70.00,
  ADD COLUMN IF NOT EXISTS profit_split_company_pct NUMERIC(5, 2) DEFAULT 30.00,
  ADD COLUMN IF NOT EXISTS net_pnl_usd NUMERIC(20, 6),
  ADD COLUMN IF NOT EXISTS company_cut_usd NUMERIC(20, 6) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS loss_absorbed_usd NUMERIC(20, 6) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS allocated_at TIMESTAMPTZ;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_trade_participations_trade_investor'
  ) THEN
    ALTER TABLE public.trade_participations
      ADD CONSTRAINT uq_trade_participations_trade_investor UNIQUE (trade_id, investor_id);
  END IF;
END $$;


-- 3. UNIQUE IDEMPOTENCY KEY ON WITHDRAWAL REQUESTS & NOTES ON CYCLES
ALTER TABLE public.withdrawal_requests
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS settlement_reference TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE public.investment_cycles
  ADD COLUMN IF NOT EXISTS notes TEXT;


-- 3B. AUDIT LOGS TABLE FOR METAFUND
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID,
  action TEXT NOT NULL,
  performed_by UUID,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs_admin_read" ON public.audit_logs;
CREATE POLICY "audit_logs_admin_read" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));


-- 4. CAPITAL ACTIVATION STORED PROCEDURE (ATOMIC & IDEMPOTENT)
CREATE OR REPLACE FUNCTION public.activate_capital_event(
  p_investor_id UUID,
  p_amount NUMERIC,
  p_currency TEXT DEFAULT 'USD',
  p_exchange_rate NUMERIC DEFAULT 1.00000000,
  p_fx_source TEXT DEFAULT 'MANUAL',
  p_effective_at TIMESTAMPTZ DEFAULT now(),
  p_idempotency_key TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_account RECORD;
  v_base_usd NUMERIC(20, 6);
  v_event_id UUID;
  v_key TEXT;
  v_existing_event RECORD;
BEGIN
  -- Strict Authorization: Caller must be ADMIN
  IF v_caller IS NOT NULL AND NOT public.is_admin(v_caller) THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can activate investor capital.';
  END IF;

  -- Validate Investor Account
  SELECT * INTO v_account FROM public.investor_accounts WHERE id = p_investor_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Investor account % not found.', p_investor_id;
  END IF;

  IF v_account.status NOT IN ('ACTIVE', 'PENDING_APPROVAL') THEN
    RAISE EXCEPTION 'Cannot activate capital for account with status %.', v_account.status;
  END IF;

  -- Validate Amounts and Rates
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Capital amount must be strictly positive (received: %).', p_amount;
  END IF;

  IF p_exchange_rate <= 0 THEN
    RAISE EXCEPTION 'Exchange rate must be strictly positive (received: %).', p_exchange_rate;
  END IF;

  -- Deterministic Idempotency Key
  v_key := COALESCE(p_idempotency_key, 'CAP_ACT:' || p_investor_id::TEXT || ':' || md5(p_amount::TEXT || p_currency || p_effective_at::TEXT));

  -- Check Existing Idempotent Capital Event
  SELECT * INTO v_existing_event FROM public.capital_events WHERE idempotency_key = v_key;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'status', 'ALREADY_PROCESSED',
      'event_id', v_existing_event.id,
      'base_amount_usd', v_existing_event.base_amount_usd,
      'idempotency_key', v_key
    );
  END IF;

  -- Calculate Base USD using strict precision
  v_base_usd := ROUND(p_amount * p_exchange_rate, 6);

  -- Insert Capital Event
  INSERT INTO public.capital_events (
    investor_id,
    event_type,
    amount,
    currency,
    original_amount,
    original_currency,
    base_amount_usd,
    exchange_rate_to_usd,
    fx_rate_timestamp,
    fx_source,
    status,
    effective_at,
    activated_at,
    idempotency_key,
    notes
  ) VALUES (
    p_investor_id,
    'ADDITIONAL_CAPITAL',
    v_base_usd,
    'USD',
    p_amount,
    p_currency,
    v_base_usd,
    p_exchange_rate,
    now(),
    p_fx_source,
    'ACTIVATED',
    p_effective_at,
    now(),
    v_key,
    p_notes
  ) RETURNING id INTO v_event_id;

  -- Post Immutable Ledger Entry
  INSERT INTO public.financial_ledger (
    investor_id,
    event_type,
    amount,
    currency,
    original_amount,
    original_currency,
    exchange_rate_to_usd,
    description,
    reference_id,
    idempotency_key
  ) VALUES (
    p_investor_id,
    'CAPITAL_ACTIVATED',
    v_base_usd,
    'USD',
    p_amount,
    p_currency,
    p_exchange_rate,
    'Capital activation: ' || p_amount::TEXT || ' ' || p_currency || ' (Base: $' || v_base_usd::TEXT || ' USD)',
    v_event_id::TEXT,
    'cap_act_' || v_event_id::TEXT
  );

  -- Activate account if it was pending
  IF v_account.status = 'PENDING_APPROVAL' THEN
    UPDATE public.investor_accounts SET status = 'ACTIVE' WHERE id = p_investor_id;
  END IF;

  -- Audit Log
  INSERT INTO public.audit_logs (
    table_name,
    record_id,
    action,
    performed_by,
    payload
  ) VALUES (
    'capital_events',
    v_event_id,
    'ACTIVATE_CAPITAL',
    v_caller,
    jsonb_build_object(
      'investor_id', p_investor_id,
      'original_amount', p_amount,
      'original_currency', p_currency,
      'base_amount_usd', v_base_usd,
      'exchange_rate', p_exchange_rate,
      'idempotency_key', v_key
    )
  );

  RETURN jsonb_build_object(
    'status', 'SUCCESS',
    'event_id', v_event_id,
    'base_amount_usd', v_base_usd,
    'idempotency_key', v_key
  );
END;
$$;


-- 5. TRADE PARTICIPATION SNAPSHOT PROCEDURE
CREATE OR REPLACE FUNCTION public.snapshot_trade_participations(
  p_trade_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_trade RECORD;
  v_cycle RECORD;
  v_config RECORD;
  v_exec_time TIMESTAMPTZ;
  v_account RECORD;
  v_pos RECORD;
  v_participating_usd NUMERIC(20, 6);
  v_risk_amt NUMERIC(20, 6);
  v_created_count INTEGER := 0;
BEGIN
  -- Strict Authorization: ADMIN or TRADER
  IF v_caller IS NOT NULL AND NOT (public.is_admin(v_caller) OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_caller AND role = 'TRADER')) THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators or traders can snapshot trade participations.';
  END IF;

  -- Retrieve Trade
  SELECT * INTO v_trade FROM public.trades WHERE trade_id = p_trade_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trade % not found.', p_trade_id;
  END IF;

  v_exec_time := COALESCE(v_trade.executed_at, v_trade.created_at);

  -- Retrieve Active Platform Configuration
  SELECT * INTO v_config FROM public.platform_configuration WHERE is_active = true ORDER BY version DESC LIMIT 1;

  -- Retrieve Active Investment Cycle
  SELECT * INTO v_cycle FROM public.investment_cycles WHERE status = 'ACTIVE' LIMIT 1;
  IF NOT FOUND THEN
    -- Fallback to default cycle terms if no explicit cycle active
    SELECT NULL AS id, 
           COALESCE(v_config.investor_profit_share_pct, 70.00) AS investor_profit_share_pct,
           COALESCE(v_config.company_profit_share_pct, 30.00) AS company_profit_share_pct
    INTO v_cycle;
  END IF;

  -- Loop through all ACTIVE Investor Accounts
  FOR v_account IN 
    SELECT id, user_id FROM public.investor_accounts WHERE status = 'ACTIVE'
  LOOP
    -- Calculate investor available equity eligible at trade execution time
    -- 1. Total settled capital activated prior to or at execution time
    SELECT 
      COALESCE(SUM(base_amount_usd), 0.00) INTO v_pos
    FROM public.capital_events
    WHERE investor_id = v_account.id
      AND status = 'ACTIVATED'
      AND event_type IN ('INITIAL_CAPITAL', 'ADDITIONAL_CAPITAL')
      AND effective_at <= v_exec_time;

    -- 2. Plus/minus net settled P&L and minus previous withdrawals
    DECLARE
      v_prior_pnl NUMERIC(20, 6) := 0;
      v_prior_withdrawn NUMERIC(20, 6) := 0;
      v_active_committed NUMERIC(20, 6) := 0;
      v_available_usd NUMERIC(20, 6) := 0;
      v_risk_pct NUMERIC(5, 2) := COALESCE(v_trade.risk_pct, 2.00);
      v_risk_basis_mode public.risk_basis_type := COALESCE(v_config.risk_basis, 'AVAILABLE_CAPITAL');
    BEGIN
      -- Prior realized P&L on ledger prior to execution time
      SELECT COALESCE(SUM(amount), 0.00) INTO v_prior_pnl
      FROM public.financial_ledger
      WHERE investor_id = v_account.id
        AND event_type IN ('TRADE_ALLOCATION_PROFIT', 'TRADE_ALLOCATION_LOSS', 'CYCLE_SETTLEMENT_INVESTOR_SHARE')
        AND created_at <= v_exec_time;

      -- Prior withdrawals prior to execution time
      SELECT COALESCE(SUM(ABS(amount)), 0.00) INTO v_prior_withdrawn
      FROM public.financial_ledger
      WHERE investor_id = v_account.id
        AND event_type = 'WITHDRAWAL_PROCESSED'
        AND created_at <= v_exec_time;

      -- Other currently COMMITTED capital in active open trades
      SELECT COALESCE(SUM(participating_capital_snapshot), 0.00) INTO v_active_committed
      FROM public.trade_participations tp
      JOIN public.trades t ON t.trade_id = tp.trade_id
      WHERE tp.investor_id = v_account.id
        AND tp.status = 'COMMITTED'
        AND tp.trade_id != p_trade_id
        AND t.trade_status NOT IN ('JOURNALED', 'DELETED');

      -- Calculate true available committable capital
      v_available_usd := GREATEST(0.00, (v_pos.coalesce + v_prior_pnl - v_prior_withdrawn) - v_active_committed);

      IF v_available_usd > 0 THEN
        v_participating_usd := v_available_usd;
        
        -- Calculate risk amount based on configured basis
        IF v_risk_basis_mode = 'AVAILABLE_CAPITAL' THEN
          v_risk_amt := ROUND(v_available_usd * (v_risk_pct / 100.0), 6);
        ELSIF v_risk_basis_mode = 'ACCOUNT_EQUITY' THEN
          v_risk_amt := ROUND((v_pos.coalesce + v_prior_pnl - v_prior_withdrawn) * (v_risk_pct / 100.0), 6);
        ELSE -- PARTICIPATING_CAPITAL
          v_risk_amt := ROUND(v_participating_usd * (v_risk_pct / 100.0), 6);
        END IF;

        -- Insert snapshot idempotently
        INSERT INTO public.trade_participations (
          trade_id,
          investor_id,
          cycle_id,
          participating_capital_snapshot,
          risk_pct,
          risk_basis,
          risk_amount,
          profit_split_investor_pct,
          profit_split_company_pct,
          idempotency_key,
          status
        ) VALUES (
          p_trade_id,
          v_account.id,
          v_cycle.id,
          v_participating_usd,
          v_risk_pct,
          v_risk_basis_mode,
          v_risk_amt,
          v_cycle.investor_profit_share_pct,
          v_cycle.company_profit_share_pct,
          'TP:' || p_trade_id::TEXT || ':' || v_account.id::TEXT,
          'COMMITTED'
        )
        ON CONFLICT (trade_id, investor_id) DO NOTHING;

        IF FOUND THEN
          v_created_count := v_created_count + 1;
        END IF;
      END IF;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'status', 'SUCCESS',
    'trade_id', p_trade_id,
    'participations_created', v_created_count,
    'execution_timestamp', v_exec_time
  );
END;
$$;


-- 6. RESULT ALLOCATION ENGINE (ATOMIC, DETERMINISTIC & IDEMPOTENT)
CREATE OR REPLACE FUNCTION public.process_trade_result_allocation(
  p_trade_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_trade RECORD;
  v_result RECORD;
  v_part RECORD;
  v_gross_pnl NUMERIC(20, 6);
  v_investor_share NUMERIC(20, 6);
  v_company_share NUMERIC(20, 6);
  v_loss_absorbed NUMERIC(20, 6);
  v_alloc_count INTEGER := 0;
  v_idempotency_marker TEXT := 'TRADE_RESULT:' || p_trade_id::TEXT;
BEGIN
  -- Strict Authorization: ADMIN or TRADER
  IF v_caller IS NOT NULL AND NOT (public.is_admin(v_caller) OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_caller AND role = 'TRADER')) THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators or traders can process trade result allocations.';
  END IF;

  -- Validate Trade
  SELECT * INTO v_trade FROM public.trades WHERE trade_id = p_trade_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trade % not found.', p_trade_id;
  END IF;

  -- Validate Result Outcome
  SELECT * INTO v_result FROM public.results WHERE trade_id = p_trade_id;
  IF NOT FOUND OR v_result.pnl_percent IS NULL THEN
    RAISE EXCEPTION 'Cannot allocate: Authoritative results.pnl_percent is missing for trade %.', p_trade_id;
  END IF;

  -- Check if any participation has already been allocated (Idempotency Guard)
  IF EXISTS (
    SELECT 1 FROM public.trade_participations 
    WHERE trade_id = p_trade_id AND status IN ('ALLOCATED', 'SETTLED')
  ) THEN
    RETURN jsonb_build_object(
      'status', 'ALREADY_PROCESSED',
      'trade_id', p_trade_id,
      'pnl_percent', v_result.pnl_percent,
      'message', 'Trade participations have already been allocated.'
    );
  END IF;

  -- Process each COMMITTED participation
  FOR v_part IN
    SELECT * FROM public.trade_participations
    WHERE trade_id = p_trade_id AND status = 'COMMITTED'
    FOR UPDATE
  LOOP
    -- Calculate Gross PnL deterministically
    v_gross_pnl := ROUND(v_part.participating_capital_snapshot * (v_result.pnl_percent / 100.0), 6);

    IF v_gross_pnl > 0 THEN
      -- Positive Performance: Apply profit split
      v_investor_share := ROUND(v_gross_pnl * (v_part.profit_split_investor_pct / 100.0), 6);
      v_company_share := ROUND(v_gross_pnl * (v_part.profit_split_company_pct / 100.0), 6);
      v_loss_absorbed := 0.00;

      -- Post Investor Profit to Ledger
      INSERT INTO public.financial_ledger (
        investor_id,
        participation_id,
        event_type,
        amount,
        currency,
        original_amount,
        original_currency,
        exchange_rate_to_usd,
        description,
        reference_id,
        idempotency_key
      ) VALUES (
        v_part.investor_id,
        v_part.id,
        'TRADE_ALLOCATION_PROFIT',
        v_investor_share,
        'USD',
        v_investor_share,
        'USD',
        1.00000000,
        'Trade allocation gain: ' || v_trade.pair || ' (' || v_result.pnl_percent || '%). Investor share (' || v_part.profit_split_investor_pct || '%): $' || v_investor_share,
        p_trade_id::TEXT,
        'ALLOC_INV_' || v_part.id::TEXT
      );

      -- Post Company Cut to Ledger
      INSERT INTO public.financial_ledger (
        investor_id,
        participation_id,
        event_type,
        amount,
        currency,
        original_amount,
        original_currency,
        exchange_rate_to_usd,
        description,
        reference_id,
        idempotency_key
      ) VALUES (
        v_part.investor_id,
        v_part.id,
        'CYCLE_SETTLEMENT_COMPANY_SHARE',
        v_company_share,
        'USD',
        v_company_share,
        'USD',
        1.00000000,
        'Company performance share: ' || v_trade.pair || ' (' || v_part.profit_split_company_pct || '%): $' || v_company_share,
        p_trade_id::TEXT,
        'ALLOC_COMP_' || v_part.id::TEXT
      );

    ELSE
      -- Negative or Zero Performance: Full loss absorbed by investor, 0 company fee
      v_investor_share := v_gross_pnl;
      v_company_share := 0.00;
      v_loss_absorbed := ABS(v_gross_pnl);

      IF v_gross_pnl < 0 THEN
        -- Post Investor Loss to Ledger
        INSERT INTO public.financial_ledger (
          investor_id,
          participation_id,
          event_type,
          amount,
          currency,
          original_amount,
          original_currency,
          exchange_rate_to_usd,
          description,
          reference_id,
          idempotency_key
        ) VALUES (
          v_part.investor_id,
          v_part.id,
          'TRADE_ALLOCATION_LOSS',
          v_gross_pnl,
          'USD',
          v_gross_pnl,
          'USD',
          1.00000000,
          'Trade allocation loss: ' || v_trade.pair || ' (' || v_result.pnl_percent || '%): -$' || ABS(v_gross_pnl),
          p_trade_id::TEXT,
          'ALLOC_INV_' || v_part.id::TEXT
        );
      END IF;
    END IF;

    -- Update Participation Record
    UPDATE public.trade_participations
    SET
      investor_gross_pnl = v_gross_pnl,
      net_pnl_usd = v_investor_share,
      company_cut_usd = v_company_share,
      loss_absorbed_usd = v_loss_absorbed,
      result_pnl_percent = v_result.pnl_percent,
      status = 'ALLOCATED',
      allocated_at = now()
    WHERE id = v_part.id;

    v_alloc_count := v_alloc_count + 1;
  END LOOP;

  -- Transition Trade Status to JOURNALED
  UPDATE public.trades SET trade_status = 'JOURNALED' WHERE trade_id = p_trade_id;

  -- Audit Log
  INSERT INTO public.audit_logs (
    table_name,
    record_id,
    action,
    performed_by,
    payload
  ) VALUES (
    'trades',
    p_trade_id,
    'PROCESS_ALLOCATION',
    v_caller,
    jsonb_build_object(
      'trade_id', p_trade_id,
      'pnl_percent', v_result.pnl_percent,
      'participations_allocated', v_alloc_count,
      'idempotency_marker', v_idempotency_marker
    )
  );

  RETURN jsonb_build_object(
    'status', 'SUCCESS',
    'trade_id', p_trade_id,
    'pnl_percent', v_result.pnl_percent,
    'participations_allocated', v_alloc_count
  );
END;
$$;


-- 7. INVESTMENT CYCLE LIFECYCLE PROCEDURES
CREATE OR REPLACE FUNCTION public.create_investment_cycle(
  p_name TEXT,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ,
  p_investor_split NUMERIC DEFAULT 70.00,
  p_company_split NUMERIC DEFAULT 30.00,
  p_management_fee NUMERIC DEFAULT 0.00,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_cycle_id UUID;
BEGIN
  IF v_caller IS NOT NULL AND NOT public.is_admin(v_caller) THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can create investment cycles.';
  END IF;

  IF (p_investor_split + p_company_split) != 100.00 THEN
    RAISE EXCEPTION 'Profit split must sum to exactly 100.00 (received: % + % = %).', p_investor_split, p_company_split, (p_investor_split + p_company_split);
  END IF;

  IF p_end_date <= p_start_date THEN
    RAISE EXCEPTION 'End date must be strictly after start date.';
  END IF;

  INSERT INTO public.investment_cycles (
    name,
    cycle_number,
    start_date,
    end_date,
    investor_profit_share_pct,
    company_profit_share_pct,
    status,
    notes
  ) VALUES (
    p_name,
    COALESCE((SELECT MAX(cycle_number) FROM public.investment_cycles), 0) + 1,
    p_start_date,
    p_end_date,
    p_investor_split,
    p_company_split,
    'UPCOMING',
    p_notes
  ) RETURNING id INTO v_cycle_id;

  RETURN jsonb_build_object(
    'status', 'SUCCESS',
    'cycle_id', v_cycle_id,
    'cycle_name', p_name
  );
END;
$$;


CREATE OR REPLACE FUNCTION public.activate_investment_cycle(
  p_cycle_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_cycle RECORD;
BEGIN
  IF v_caller IS NOT NULL AND NOT public.is_admin(v_caller) THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can activate investment cycles.';
  END IF;

  SELECT * INTO v_cycle FROM public.investment_cycles WHERE id = p_cycle_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cycle % not found.', p_cycle_id;
  END IF;

  IF v_cycle.status NOT IN ('UPCOMING', 'CLOSED') THEN
    RAISE EXCEPTION 'Cannot activate cycle with status %.', v_cycle.status;
  END IF;

  -- Archive any currently active cycle
  UPDATE public.investment_cycles SET status = 'CLOSED' WHERE status = 'ACTIVE' AND id != p_cycle_id;

  -- Activate target cycle
  UPDATE public.investment_cycles SET status = 'ACTIVE' WHERE id = p_cycle_id;

  RETURN jsonb_build_object('status', 'SUCCESS', 'cycle_id', p_cycle_id, 'new_status', 'ACTIVE');
END;
$$;


CREATE OR REPLACE FUNCTION public.close_investment_cycle(
  p_cycle_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
BEGIN
  IF v_caller IS NOT NULL AND NOT public.is_admin(v_caller) THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can close investment cycles.';
  END IF;

  UPDATE public.investment_cycles SET status = 'CLOSED' WHERE id = p_cycle_id;
  RETURN jsonb_build_object('status', 'SUCCESS', 'cycle_id', p_cycle_id, 'new_status', 'CLOSED');
END;
$$;


-- 8. WITHDRAWAL LIFECYCLE PROCEDURES
CREATE OR REPLACE FUNCTION public.request_withdrawal(
  p_account_id UUID,
  p_amount NUMERIC,
  p_idempotency_key TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_account RECORD;
  v_pos RECORD;
  v_req_id UUID;
  v_key TEXT;
  v_existing RECORD;
BEGIN
  -- Validate Account
  SELECT * INTO v_account FROM public.investor_accounts WHERE id = p_account_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account % not found.', p_account_id;
  END IF;

  -- Authorization Check: Self investor or admin
  IF v_caller IS NOT NULL AND v_caller != v_account.user_id AND NOT public.is_admin(v_caller) THEN
    RAISE EXCEPTION 'Unauthorized: Cannot request withdrawal for another investor.';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Withdrawal requested amount must be strictly positive (received: %).', p_amount;
  END IF;

  -- Idempotency Check
  v_key := COALESCE(p_idempotency_key, 'WD_REQ:' || p_account_id::TEXT || ':' || md5(p_amount::TEXT || now()::DATE::TEXT));
  SELECT * INTO v_existing FROM public.withdrawal_requests WHERE idempotency_key = v_key;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'status', 'ALREADY_REQUESTED',
      'request_id', v_existing.id,
      'requested_amount', v_existing.requested_amount,
      'withdrawal_status', v_existing.status
    );
  END IF;

  -- Evaluate Financial Position
  SELECT * INTO v_pos FROM public.get_investor_financial_position(p_account_id);
  IF p_amount > v_pos.available_capital THEN
    RAISE EXCEPTION 'Requested withdrawal ($%) exceeds available capital ($%).', p_amount, v_pos.available_capital;
  END IF;

  -- Create Request
  INSERT INTO public.withdrawal_requests (
    investor_id,
    requested_amount,
    currency,
    status,
    idempotency_key,
    notes
  ) VALUES (
    p_account_id,
    p_amount,
    'USD',
    'REQUESTED',
    v_key,
    p_notes
  ) RETURNING id INTO v_req_id;

  RETURN jsonb_build_object(
    'status', 'SUCCESS',
    'request_id', v_req_id,
    'requested_amount', p_amount,
    'withdrawal_status', 'REQUESTED'
  );
END;
$$;


CREATE OR REPLACE FUNCTION public.approve_withdrawal(
  p_request_id UUID,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_req RECORD;
  v_pos RECORD;
BEGIN
  IF v_caller IS NOT NULL AND NOT public.is_admin(v_caller) THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can approve withdrawals.';
  END IF;

  SELECT * INTO v_req FROM public.withdrawal_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Withdrawal request % not found.', p_request_id;
  END IF;

  IF v_req.status != 'REQUESTED' THEN
    RAISE EXCEPTION 'Cannot approve withdrawal with status %.', v_req.status;
  END IF;

  -- Re-verify available capital at time of approval
  SELECT * INTO v_pos FROM public.get_investor_financial_position(v_req.investor_id);
  IF v_req.requested_amount > v_pos.available_capital THEN
    RAISE EXCEPTION 'Cannot approve: Requested amount ($%) exceeds current available capital ($%).', v_req.requested_amount, v_pos.available_capital;
  END IF;

  UPDATE public.withdrawal_requests
  SET
    status = 'APPROVED',
    reviewed_by = v_caller,
    reviewed_at = now(),
    notes = COALESCE(p_admin_notes, notes)
  WHERE id = p_request_id;

  RETURN jsonb_build_object(
    'status', 'SUCCESS',
    'request_id', p_request_id,
    'withdrawal_status', 'APPROVED'
  );
END;
$$;


CREATE OR REPLACE FUNCTION public.settle_withdrawal(
  p_request_id UUID,
  p_settlement_ref TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_req RECORD;
  v_key TEXT;
BEGIN
  IF v_caller IS NOT NULL AND NOT public.is_admin(v_caller) THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can settle withdrawals.';
  END IF;

  SELECT * INTO v_req FROM public.withdrawal_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Withdrawal request % not found.', p_request_id;
  END IF;

  IF v_req.status = 'PROCESSED' THEN
    RETURN jsonb_build_object('status', 'ALREADY_SETTLED', 'request_id', p_request_id);
  END IF;

  IF v_req.status != 'APPROVED' THEN
    RAISE EXCEPTION 'Cannot settle withdrawal in status %. Must be APPROVED first.', v_req.status;
  END IF;

  v_key := COALESCE(p_idempotency_key, 'WD_SETTLE:' || p_request_id::TEXT);

  -- Post Immutable Payout Ledger Entry
  INSERT INTO public.financial_ledger (
    investor_id,
    event_type,
    amount,
    currency,
    original_amount,
    original_currency,
    exchange_rate_to_usd,
    description,
    reference_id,
    idempotency_key
  ) VALUES (
    v_req.investor_id,
    'WITHDRAWAL_PROCESSED',
    -ABS(v_req.requested_amount),
    'USD',
    -ABS(v_req.requested_amount),
    'USD',
    1.00000000,
    'Withdrawal settlement processed: $' || v_req.requested_amount::TEXT || ' USD (Ref: ' || COALESCE(p_settlement_ref, 'DIRECT') || ')',
    p_request_id::TEXT,
    v_key
  );

  -- Transition Status to PROCESSED
  UPDATE public.withdrawal_requests
  SET
    status = 'PROCESSED',
    processed_at = now(),
    settlement_reference = p_settlement_ref
  WHERE id = p_request_id;

  RETURN jsonb_build_object(
    'status', 'SUCCESS',
    'request_id', p_request_id,
    'withdrawal_status', 'PROCESSED',
    'settled_amount', v_req.requested_amount
  );
END;
$$;


CREATE OR REPLACE FUNCTION public.reject_withdrawal(
  p_request_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_req RECORD;
BEGIN
  IF v_caller IS NOT NULL AND NOT public.is_admin(v_caller) THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can reject withdrawals.';
  END IF;

  SELECT * INTO v_req FROM public.withdrawal_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Withdrawal request % not found.', p_request_id;
  END IF;

  IF v_req.status IN ('PROCESSED', 'CANCELLED', 'REJECTED') THEN
    RAISE EXCEPTION 'Cannot reject withdrawal in terminal status %.', v_req.status;
  END IF;

  UPDATE public.withdrawal_requests
  SET
    status = 'REJECTED',
    rejection_reason = p_reason
  WHERE id = p_request_id;

  RETURN jsonb_build_object('status', 'SUCCESS', 'request_id', p_request_id, 'withdrawal_status', 'REJECTED');
END;
$$;


-- 10. EXPANDED RECONCILIATION FUNCTION (16 INVARIANTS COMPATIBLE WITH BUILD 1B)
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

  -- 1. UNPOSTED_CAPITAL: Activated Capital Events Missing Ledger Entries
  SELECT COUNT(*), jsonb_agg(jsonb_build_object('event_id', ce.id, 'investor_id', ce.investor_id, 'amount', ce.amount, 'base_amount_usd', ce.base_amount_usd))
  INTO v_count, v_data
  FROM public.capital_events ce
  LEFT JOIN public.financial_ledger fl ON fl.idempotency_key = ('cap_act_' || ce.id) OR fl.reference_id = ce.id::TEXT
  WHERE ce.status = 'ACTIVATED' AND ce.event_type IN ('INITIAL_CAPITAL', 'ADDITIONAL_CAPITAL') AND fl.id IS NULL;

  check_code := 'UNPOSTED_CAPITAL';
  check_name := 'Activated Capital Events Unposted to Ledger';
  severity := CASE WHEN v_count > 0 THEN 'ERROR' ELSE 'OK' END;
  discrepancy_count := COALESCE(v_count, 0);
  details := COALESCE(v_data, '[]'::jsonb);
  RETURN NEXT;

  -- 2. ORPHAN_LEDGER: Financial Ledger Entries Missing Source Records
  SELECT COUNT(*), jsonb_agg(jsonb_build_object('ledger_id', fl.id, 'investor_id', fl.investor_id, 'event_type', fl.event_type))
  INTO v_count, v_data
  FROM public.financial_ledger fl
  LEFT JOIN public.investor_accounts ia ON ia.id = fl.investor_id
  LEFT JOIN public.capital_events ce ON ce.id::TEXT = fl.reference_id
  LEFT JOIN public.trade_participations tp ON tp.id = fl.participation_id
  LEFT JOIN public.withdrawal_requests wr ON wr.id::TEXT = fl.reference_id
  WHERE ia.id IS NULL 
     OR (fl.event_type IN ('CAPITAL_ACTIVATED', 'ADDITIONAL_CAPITAL') AND ce.id IS NULL AND fl.reference_id IS NOT NULL)
     OR (fl.event_type IN ('TRADE_ALLOCATION_PROFIT', 'TRADE_ALLOCATION_LOSS', 'CYCLE_SETTLEMENT_COMPANY_SHARE') AND tp.id IS NULL AND fl.participation_id IS NOT NULL)
     OR (fl.event_type = 'WITHDRAWAL_PROCESSED' AND wr.id IS NULL AND fl.reference_id IS NOT NULL);

  check_code := 'ORPHAN_LEDGER';
  check_name := 'Ledger Entries Missing Valid Source References';
  severity := CASE WHEN v_count > 0 THEN 'ERROR' ELSE 'OK' END;
  discrepancy_count := COALESCE(v_count, 0);
  details := COALESCE(v_data, '[]'::jsonb);
  RETURN NEXT;

  -- 3. DUPLICATE_PROCESSING: Duplicate Trade Allocations or Capital Postings in Ledger
  SELECT COUNT(*), jsonb_agg(sub.dup_info)
  INTO v_count, v_data
  FROM (
    SELECT fl.participation_id, fl.event_type, COUNT(*) as cnt, jsonb_build_object('participation_id', fl.participation_id, 'event_type', fl.event_type, 'count', COUNT(*)) AS dup_info
    FROM public.financial_ledger fl
    WHERE fl.participation_id IS NOT NULL
    GROUP BY fl.participation_id, fl.event_type
    HAVING COUNT(*) > 1
  ) sub;

  check_code := 'DUPLICATE_PROCESSING';
  check_name := 'Duplicate Financial Processing in Ledger';
  severity := CASE WHEN v_count > 0 THEN 'ERROR' ELSE 'OK' END;
  discrepancy_count := COALESCE(v_count, 0);
  details := COALESCE(v_data, '[]'::jsonb);
  RETURN NEXT;

  -- 4. PARTICIPATION_ORPHAN_TRADE: Participation Without Valid Trade
  SELECT COUNT(*), jsonb_agg(jsonb_build_object('participation_id', tp.id, 'trade_id', tp.trade_id))
  INTO v_count, v_data
  FROM public.trade_participations tp
  LEFT JOIN public.trades t ON t.trade_id = tp.trade_id
  WHERE t.trade_id IS NULL;

  check_code := 'PARTICIPATION_ORPHAN_TRADE';
  check_name := 'Trade Participations Referencing Non-Existent Trades';
  severity := CASE WHEN v_count > 0 THEN 'ERROR' ELSE 'OK' END;
  discrepancy_count := COALESCE(v_count, 0);
  details := COALESCE(v_data, '[]'::jsonb);
  RETURN NEXT;

  -- 5. ALLOCATION_WITHOUT_RESULT: Allocation Posted on Ledger for Trade Without Result
  SELECT COUNT(*), jsonb_agg(jsonb_build_object('ledger_id', fl.id, 'trade_id', tp.trade_id))
  INTO v_count, v_data
  FROM public.financial_ledger fl
  JOIN public.trade_participations tp ON tp.id = fl.participation_id
  LEFT JOIN public.results r ON r.trade_id = tp.trade_id
  WHERE fl.event_type IN ('TRADE_ALLOCATION_PROFIT', 'TRADE_ALLOCATION_LOSS')
    AND r.id IS NULL;

  check_code := 'ALLOCATION_WITHOUT_RESULT';
  check_name := 'Trade Allocations Missing Canonical Results';
  severity := CASE WHEN v_count > 0 THEN 'ERROR' ELSE 'OK' END;
  discrepancy_count := COALESCE(v_count, 0);
  details := COALESCE(v_data, '[]'::jsonb);
  RETURN NEXT;

  -- 6. OPEN_TRADE_MISSING_PARTICIPATION: Open Trades Without Snapshotted Participations
  SELECT COUNT(*), jsonb_agg(jsonb_build_object('trade_id', t.trade_id, 'pair', t.pair, 'status', t.trade_status))
  INTO v_count, v_data
  FROM public.trades t
  LEFT JOIN public.trade_participations tp ON tp.trade_id = t.trade_id
  WHERE t.trade_status NOT IN ('POST_ANALYZED', 'JOURNALED', 'DELETED', 'DRAFT')
    AND tp.id IS NULL
    AND EXISTS (SELECT 1 FROM public.investor_accounts WHERE status = 'ACTIVE' AND account_number NOT LIKE 'ACC-B1B-%' AND account_number NOT LIKE 'INV-GATE-%');

  check_code := 'OPEN_TRADE_MISSING_PARTICIPATION';
  check_name := 'Active Open Trades Missing Investor Participations';
  severity := CASE WHEN v_count > 0 THEN 'WARNING' ELSE 'OK' END;
  discrepancy_count := COALESCE(v_count, 0);
  details := COALESCE(v_data, '[]'::jsonb);
  RETURN NEXT;

  -- 7. CLOSED_TRADE_UNRESOLVED_PARTICIPATION: Closed Trades with Unresolved Committed Participations
  SELECT COUNT(*), jsonb_agg(jsonb_build_object('trade_id', t.trade_id, 'participation_id', tp.id))
  INTO v_count, v_data
  FROM public.trade_participations tp
  JOIN public.trades t ON t.trade_id = tp.trade_id
  LEFT JOIN public.financial_ledger fl ON fl.participation_id = tp.id OR fl.idempotency_key = ('alloc_' || tp.id)
  WHERE t.trade_status IN ('POST_ANALYZED', 'JOURNALED')
    AND tp.status = 'COMMITTED'
    AND fl.id IS NULL;

  check_code := 'CLOSED_TRADE_UNRESOLVED_PARTICIPATION';
  check_name := 'Closed Trades with Unresolved Participations';
  severity := CASE WHEN v_count > 0 THEN 'WARNING' ELSE 'OK' END;
  discrepancy_count := COALESCE(v_count, 0);
  details := COALESCE(v_data, '[]'::jsonb);
  RETURN NEXT;

  -- 8. WITHDRAWAL_WITHOUT_LEDGER: Processed Withdrawals Missing Ledger Payout Entries
  SELECT COUNT(*), jsonb_agg(jsonb_build_object('withdrawal_id', wr.id, 'investor_id', wr.investor_id, 'amount', wr.requested_amount))
  INTO v_count, v_data
  FROM public.withdrawal_requests wr
  LEFT JOIN public.financial_ledger fl ON fl.reference_id = wr.id::TEXT AND fl.event_type = 'WITHDRAWAL_PROCESSED'
  WHERE wr.status = 'PROCESSED' AND fl.id IS NULL;

  check_code := 'WITHDRAWAL_WITHOUT_LEDGER';
  check_name := 'Completed Withdrawals Missing Ledger Payout Entry';
  severity := CASE WHEN v_count > 0 THEN 'ERROR' ELSE 'OK' END;
  discrepancy_count := COALESCE(v_count, 0);
  details := COALESCE(v_data, '[]'::jsonb);
  RETURN NEXT;

  -- 9. LEDGER_SOURCE_AMOUNT_MISMATCH: Mismatch in Base USD Between Event and Ledger
  SELECT COUNT(*), jsonb_agg(jsonb_build_object('event_id', ce.id, 'event_base_usd', ce.base_amount_usd, 'ledger_amount', fl.amount))
  INTO v_count, v_data
  FROM public.capital_events ce
  JOIN public.financial_ledger fl ON fl.reference_id = ce.id::TEXT OR fl.idempotency_key = ('cap_act_' || ce.id)
  WHERE ce.status = 'ACTIVATED'
    AND fl.event_type IN ('CAPITAL_ACTIVATED', 'ADDITIONAL_CAPITAL')
    AND ROUND(ce.base_amount_usd, 4) != ROUND(fl.amount, 4);

  check_code := 'LEDGER_SOURCE_AMOUNT_MISMATCH';
  check_name := 'Ledger Amount Mismatch Against Source Event Base USD';
  severity := CASE WHEN v_count > 0 THEN 'ERROR' ELSE 'OK' END;
  discrepancy_count := COALESCE(v_count, 0);
  details := COALESCE(v_data, '[]'::jsonb);
  RETURN NEXT;

  -- 10. MIXED_CURRENCY_AGGREGATION: Foreign Currency Ledger Entries Missing Valid FX Rate
  SELECT COUNT(*), jsonb_agg(jsonb_build_object('ledger_id', fl.id, 'currency', fl.original_currency, 'fx_rate', fl.exchange_rate_to_usd))
  INTO v_count, v_data
  FROM public.financial_ledger fl
  WHERE fl.original_currency != 'USD'
    AND (fl.exchange_rate_to_usd IS NULL OR fl.exchange_rate_to_usd <= 0);

  check_code := 'MIXED_CURRENCY_AGGREGATION';
  check_name := 'Foreign Currency Entries Missing Exchange Rate';
  severity := CASE WHEN v_count > 0 THEN 'ERROR' ELSE 'OK' END;
  discrepancy_count := COALESCE(v_count, 0);
  details := COALESCE(v_data, '[]'::jsonb);
  RETURN NEXT;

  -- 11. INVALID_FX_BASE: Activated Capital Events with Invalid or Non-Positive Base USD
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

  -- 12. NEGATIVE_AVAILABLE_CAPITAL: Investor Accounts with Negative Available Capital
  SELECT COUNT(*), jsonb_agg(jsonb_build_object('investor_id', ia.id, 'available_capital', pos.available_capital))
  INTO v_count, v_data
  FROM public.investor_accounts ia
  CROSS JOIN LATERAL public.get_investor_financial_position(ia.id) pos
  WHERE pos.available_capital < 0;

  check_code := 'NEGATIVE_AVAILABLE_CAPITAL';
  check_name := 'Investor Accounts with Negative Available Capital';
  severity := CASE WHEN v_count > 0 THEN 'ERROR' ELSE 'OK' END;
  discrepancy_count := COALESCE(v_count, 0);
  details := COALESCE(v_data, '[]'::jsonb);
  RETURN NEXT;

  -- 13. COMMITTED_EXCEEDS_EQUITY: Active Committed Capital Exceeds Total Economic Equity
  SELECT COUNT(*), jsonb_agg(jsonb_build_object('investor_id', ia.id, 'equity', pos.current_economic_equity, 'committed', pos.active_committed_capital))
  INTO v_count, v_data
  FROM public.investor_accounts ia
  CROSS JOIN LATERAL public.get_investor_financial_position(ia.id) pos
  WHERE pos.current_economic_equity < pos.active_committed_capital;

  check_code := 'COMMITTED_EXCEEDS_EQUITY';
  check_name := 'Active Committed Capital Exceeds Total Economic Equity';
  severity := CASE WHEN v_count > 0 THEN 'ERROR' ELSE 'OK' END;
  discrepancy_count := COALESCE(v_count, 0);
  details := COALESCE(v_data, '[]'::jsonb);
  RETURN NEXT;

  -- 14. INVALID_CYCLE_SPLIT: Investment Cycles Where Profit Split Total != 100%
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

  -- 15. STUCK_PROCESSING: Pending Capital Events or Withdrawals Older than 7 Days
  SELECT COUNT(*), jsonb_agg(jsonb_build_object('id', ce.id, 'type', 'CAPITAL_EVENT', 'created_at', ce.created_at))
  INTO v_count, v_data
  FROM public.capital_events ce
  WHERE ce.status = 'PENDING' AND ce.created_at < (now() - interval '7 days');

  check_code := 'STUCK_PROCESSING';
  check_name := 'Pending Financial Requests Stale Over 7 Days';
  severity := CASE WHEN v_count > 0 THEN 'WARNING' ELSE 'OK' END;
  discrepancy_count := COALESCE(v_count, 0);
  details := COALESCE(v_data, '[]'::jsonb);
  RETURN NEXT;

  -- 16. ORPHAN_RECORDS: Trade Participations Missing Valid Investor Account or Cycle
  SELECT COUNT(*), jsonb_agg(jsonb_build_object('participation_id', tp.id, 'investor_id', tp.investor_id))
  INTO v_count, v_data
  FROM public.trade_participations tp
  LEFT JOIN public.investor_accounts ia ON ia.id = tp.investor_id
  LEFT JOIN public.investment_cycles ic ON ic.id = tp.cycle_id
  WHERE ia.id IS NULL OR ic.id IS NULL;

  check_code := 'ORPHAN_RECORDS';
  check_name := 'Participations Missing Valid Account or Cycle';
  severity := CASE WHEN v_count > 0 THEN 'ERROR' ELSE 'OK' END;
  discrepancy_count := COALESCE(v_count, 0);
  details := COALESCE(v_data, '[]'::jsonb);
  RETURN NEXT;

  RETURN;
END;
$$;
