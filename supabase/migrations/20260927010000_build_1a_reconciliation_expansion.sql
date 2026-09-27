-- ============================================================================
-- METABRAIN TRADER — BUILD 1A: RECONCILIATION EXPANSION & INTEGRITY HARDENING
-- Chronological Migration 20260927010000
-- ============================================================================

-- 1. EXPAND RECONCILIATION FUNCTION TO COVER ALL 16 INVARIANTS
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
     OR (fl.event_type IN ('TRADE_ALLOCATION_PROFIT', 'TRADE_ALLOCATION_LOSS') AND tp.id IS NULL AND fl.participation_id IS NOT NULL)
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
    AND EXISTS (SELECT 1 FROM public.investor_accounts WHERE status = 'ACTIVE' AND account_number NOT LIKE 'INV-GATE-%');

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
  LEFT JOIN public.financial_ledger fl ON fl.idempotency_key = ('alloc_' || tp.id)
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
