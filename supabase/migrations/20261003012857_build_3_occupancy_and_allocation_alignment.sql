-- Build 3 follow-up: make MetaFund occupancy and allocation consume
-- the execution-time risk snapshot, and retire the legacy public snapshot path.

CREATE OR REPLACE FUNCTION public.get_investor_financial_position(p_investor_id uuid)
RETURNS TABLE(
  cumulative_deposited numeric,
  current_contributed_capital numeric,
  active_committed_capital numeric,
  available_capital numeric,
  realized_trading_pnl numeric,
  current_economic_equity numeric,
  settled_capital numeric,
  cumulative_withdrawn numeric,
  open_trades_count integer,
  closed_trades_count integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_deposited numeric(20,6) := 0;
  v_withdrawn numeric(20,6) := 0;
  v_pnl numeric(20,6) := 0;
  v_committed numeric(20,6) := 0;
  v_reserved_withdrawals numeric(20,6) := 0;
  v_open_count integer := 0;
  v_closed_count integer := 0;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF NOT (public.is_admin(v_caller) OR EXISTS (SELECT 1 FROM public.investor_accounts WHERE id=p_investor_id AND user_id=v_caller)) THEN RAISE EXCEPTION 'Access denied.'; END IF;

  SELECT COALESCE(SUM(COALESCE(base_amount_usd, amount)),0) INTO v_deposited
  FROM public.capital_events
  WHERE investor_id=p_investor_id AND status='ACTIVATED'
    AND event_type IN ('INITIAL_CAPITAL','ADDITIONAL_CAPITAL');

  SELECT COALESCE(SUM(ABS(amount)),0) INTO v_withdrawn
  FROM public.financial_ledger
  WHERE investor_id=p_investor_id AND event_type='WITHDRAWAL_PROCESSED' AND amount<0;

  SELECT COALESCE(SUM(amount),0) INTO v_pnl
  FROM public.financial_ledger
  WHERE investor_id=p_investor_id
    AND event_type IN('TRADE_ALLOCATION_PROFIT','TRADE_ALLOCATION_LOSS','CYCLE_SETTLEMENT_PROFIT');

  SELECT COALESCE(SUM(tp.risk_amount),0),COUNT(tp.id) INTO v_committed,v_open_count
  FROM public.trade_participations tp
  JOIN public.trades t ON t.trade_id=tp.trade_id
  WHERE tp.investor_id=p_investor_id
    AND tp.status='COMMITTED'
    AND t.executed=true
    AND t.executed_at IS NOT NULL
    AND t.trade_status NOT IN('POST_ANALYZED','JOURNALED','DELETED');

  SELECT COUNT(tp.id) INTO v_closed_count
  FROM public.trade_participations tp
  WHERE tp.investor_id=p_investor_id AND tp.status='ALLOCATED';

  SELECT COALESCE(SUM(requested_amount),0) INTO v_reserved_withdrawals
  FROM public.withdrawal_requests
  WHERE investor_id=p_investor_id
    AND status IN('REQUESTED','UNDER_REVIEW','WAITING_FOR_OPEN_TRADES','PERFORMANCE_CRYSTALLIZATION_REQUIRED','APPROVED');

  cumulative_deposited:=v_deposited;
  cumulative_withdrawn:=v_withdrawn;
  current_contributed_capital:=v_deposited-v_withdrawn;
  realized_trading_pnl:=v_pnl;
  current_economic_equity:=v_deposited+v_pnl-v_withdrawn;
  active_committed_capital:=v_committed;
  available_capital:=GREATEST(0,(v_deposited+v_pnl-v_withdrawn)-v_committed-v_reserved_withdrawals);
  settled_capital:=v_deposited-v_withdrawn;
  open_trades_count:=v_open_count;
  closed_trades_count:=v_closed_count;
  RETURN NEXT;
END;
$function$;

CREATE OR REPLACE FUNCTION public.process_trade_allocation(p_trade_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_trade record; v_result record; v_part record; v_pnl numeric(8,4);
  v_pnl_amt numeric(20,6); v_event public.ledger_event_type; v_count integer:=0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF NOT (public.is_admin(auth.uid()) OR EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role='TRADER') OR EXISTS(SELECT 1 FROM public.trades WHERE trade_id=p_trade_id AND user_id=auth.uid())) THEN
    RAISE EXCEPTION 'Unauthorized to process trade allocation.';
  END IF;
  SELECT * INTO v_trade FROM public.trades WHERE trade_id=p_trade_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trade not found.'; END IF;
  IF NOT (v_trade.executed=true AND v_trade.executed_at IS NOT NULL) THEN RAISE EXCEPTION 'Trade allocation requires an executed trade.'; END IF;
  SELECT * INTO v_result FROM public.results WHERE trade_id=p_trade_id;
  IF NOT FOUND OR v_result.pnl_percent IS NULL THEN RAISE EXCEPTION 'Authoritative results.pnl_percent is required.'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.trade_participations WHERE trade_id=p_trade_id) THEN RAISE EXCEPTION 'Trade participation snapshot is missing. Execute the trade first.'; END IF;
  FOR v_part IN SELECT * FROM public.trade_participations WHERE trade_id=p_trade_id AND status='COMMITTED' FOR UPDATE LOOP
    v_pnl:=v_result.pnl_percent;
    v_pnl_amt:=round(v_part.risk_amount*(v_pnl/100.0),6);
    v_event:=CASE WHEN v_pnl_amt>=0 THEN 'TRADE_ALLOCATION_PROFIT' ELSE 'TRADE_ALLOCATION_LOSS' END;
    UPDATE public.trade_participations SET status='ALLOCATED',result_pnl_percent=v_pnl,investor_gross_pnl=v_pnl_amt,net_pnl_usd=v_pnl_amt,updated_at=now() WHERE id=v_part.id;
    INSERT INTO public.financial_ledger(investor_id,cycle_id,trade_id,participation_id,event_type,amount,currency,idempotency_key,reference_id,description,metadata)
    VALUES(v_part.investor_id,v_part.cycle_id,p_trade_id,v_part.id,v_event,v_pnl_amt,'USD','alloc_'||v_part.id,p_trade_id::text,'Trade allocation',jsonb_build_object('pnl_percent',v_pnl,'risk_amount',v_part.risk_amount))
    ON CONFLICT(idempotency_key) DO NOTHING;
    v_count:=v_count+1;
  END LOOP;
  RETURN jsonb_build_object('status','SUCCESS','trade_id',p_trade_id,'pnl_percent',v_pnl,'investors_allocated',v_count);
END;
$function$;

CREATE OR REPLACE FUNCTION public.process_trade_result_allocation(p_trade_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_trade record; v_result record; v_part record; v_gross numeric(20,6);
  v_inv numeric(20,6); v_company numeric(20,6); v_loss numeric(20,6); v_count integer:=0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF NOT (public.is_admin(auth.uid()) OR EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role='TRADER') OR EXISTS(SELECT 1 FROM public.trades WHERE trade_id=p_trade_id AND user_id=auth.uid())) THEN
    RAISE EXCEPTION 'Unauthorized to process trade result allocation.';
  END IF;
  SELECT * INTO v_trade FROM public.trades WHERE trade_id=p_trade_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trade not found.'; END IF;
  IF NOT (v_trade.executed=true AND v_trade.executed_at IS NOT NULL) THEN RAISE EXCEPTION 'Trade result allocation requires an executed trade.'; END IF;
  SELECT * INTO v_result FROM public.results WHERE trade_id=p_trade_id;
  IF NOT FOUND OR v_result.pnl_percent IS NULL THEN RAISE EXCEPTION 'Authoritative results.pnl_percent is required.'; END IF;
  IF EXISTS(SELECT 1 FROM public.trade_participations WHERE trade_id=p_trade_id AND status IN('ALLOCATED','SETTLED')) THEN
    RETURN jsonb_build_object('status','ALREADY_PROCESSED','trade_id',p_trade_id,'pnl_percent',v_result.pnl_percent);
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.trade_participations WHERE trade_id=p_trade_id AND status='COMMITTED') THEN
    RAISE EXCEPTION 'No committed trade participation exists. Execute the trade first.';
  END IF;
  FOR v_part IN SELECT * FROM public.trade_participations WHERE trade_id=p_trade_id AND status='COMMITTED' FOR UPDATE LOOP
    v_gross:=round(v_part.risk_amount*(v_result.pnl_percent/100.0),6);
    IF v_gross>0 THEN
      v_inv:=round(v_gross*(v_part.profit_split_investor_pct/100.0),6);
      v_company:=round(v_gross*(v_part.profit_split_company_pct/100.0),6);
      v_loss:=0;
      INSERT INTO public.financial_ledger(investor_id,participation_id,event_type,amount,currency,original_amount,original_currency,exchange_rate_to_usd,description,reference_id,idempotency_key)
      VALUES(v_part.investor_id,v_part.id,'TRADE_ALLOCATION_PROFIT',v_inv,'USD',v_inv,'USD',1,'Trade investor profit',p_trade_id::text,'ALLOC_INV_'||v_part.id)
      ON CONFLICT(idempotency_key) DO NOTHING;
      INSERT INTO public.financial_ledger(investor_id,participation_id,event_type,amount,currency,original_amount,original_currency,exchange_rate_to_usd,description,reference_id,idempotency_key)
      VALUES(v_part.investor_id,v_part.id,'CYCLE_SETTLEMENT_COMPANY_SHARE',v_company,'USD',v_company,'USD',1,'Company performance share',p_trade_id::text,'ALLOC_COMP_'||v_part.id)
      ON CONFLICT(idempotency_key) DO NOTHING;
    ELSE
      v_inv:=v_gross; v_company:=0; v_loss:=abs(v_gross);
      IF v_gross<0 THEN
        INSERT INTO public.financial_ledger(investor_id,participation_id,event_type,amount,currency,original_amount,original_currency,exchange_rate_to_usd,description,reference_id,idempotency_key)
        VALUES(v_part.investor_id,v_part.id,'TRADE_ALLOCATION_LOSS',v_gross,'USD',v_gross,'USD',1,'Trade investor loss',p_trade_id::text,'ALLOC_INV_'||v_part.id)
        ON CONFLICT(idempotency_key) DO NOTHING;
      END IF;
    END IF;
    UPDATE public.trade_participations SET investor_gross_pnl=v_gross,net_pnl_usd=v_inv,company_cut_usd=v_company,loss_absorbed_usd=v_loss,result_pnl_percent=v_result.pnl_percent,status='ALLOCATED',allocated_at=now() WHERE id=v_part.id;
    v_count:=v_count+1;
  END LOOP;
  UPDATE public.trades SET trade_status='JOURNALED' WHERE trade_id=p_trade_id;
  RETURN jsonb_build_object('status','SUCCESS','trade_id',p_trade_id,'pnl_percent',v_result.pnl_percent,'participations_allocated',v_count);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.snapshot_trade_participation(uuid, public.risk_basis_type) FROM PUBLIC, anon, authenticated;
