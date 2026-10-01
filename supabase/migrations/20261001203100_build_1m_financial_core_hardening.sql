-- MetaBrain Trader Build 1M hardening pass
-- Financial API escape hatches, withdrawal idempotency, company reservation math.
-- No historical financial rows are modified.

CREATE OR REPLACE VIEW public.company_financial_summary AS
WITH deposits AS (
  SELECT COALESCE(sum(COALESCE(ce.base_amount_usd,ce.amount)),0)::numeric AS total_deposited
  FROM public.capital_events ce WHERE ce.status='ACTIVATED' AND ce.event_type IN('INITIAL_CAPITAL','ADDITIONAL_CAPITAL')
), withdrawals AS (
  SELECT COALESCE(sum(ABS(fl.amount)),0)::numeric AS total_withdrawn
  FROM public.financial_ledger fl WHERE fl.event_type='WITHDRAWAL_PROCESSED' AND fl.amount<0
), reserved_withdrawals AS (
  SELECT COALESCE(sum(wr.requested_amount),0)::numeric AS total_reserved_withdrawals
  FROM public.withdrawal_requests wr WHERE wr.status IN('REQUESTED','UNDER_REVIEW','WAITING_FOR_OPEN_TRADES','PERFORMANCE_CRYSTALLIZATION_REQUIRED','APPROVED')
), trading_pnl AS (
  SELECT COALESCE(sum(CASE WHEN fl.amount>0 THEN fl.amount ELSE 0 END),0)::numeric AS total_gross_profit,
         COALESCE(sum(CASE WHEN fl.amount<0 THEN fl.amount ELSE 0 END),0)::numeric AS total_gross_loss,
         COALESCE(sum(fl.amount),0)::numeric AS net_trading_pnl
  FROM public.financial_ledger fl WHERE fl.event_type IN('TRADE_ALLOCATION_PROFIT','TRADE_ALLOCATION_LOSS')
), committed_exposure AS (
  SELECT COALESCE(sum(tp.participating_capital_snapshot),0)::numeric AS total_active_committed_capital,
         COALESCE(sum(tp.risk_amount),0)::numeric AS total_active_risk_amount
  FROM public.trade_participations tp JOIN public.trades t ON t.trade_id=tp.trade_id
  WHERE tp.status='COMMITTED' AND t.trade_status NOT IN('POST_ANALYZED','JOURNALED','DELETED')
), counts AS (
  SELECT (SELECT count(*) FROM public.investor_accounts) AS total_investors,
         (SELECT count(*) FROM public.investor_accounts WHERE status='ACTIVE') AS active_investors,
         (SELECT count(*) FROM public.trades WHERE trade_status NOT IN('POST_ANALYZED','JOURNALED','DELETED')) AS open_trades_count,
         (SELECT count(*) FROM public.trades WHERE trade_status IN('POST_ANALYZED','JOURNALED')) AS closed_trades_count
)
SELECT d.total_deposited,ce.total_active_committed_capital,
       GREATEST(0,d.total_deposited+tpnl.net_trading_pnl-w.total_withdrawn-ce.total_active_committed_capital-rw.total_reserved_withdrawals) AS total_available_capital,
       d.total_deposited+tpnl.net_trading_pnl-w.total_withdrawn AS total_economic_equity,
       w.total_withdrawn,tpnl.total_gross_profit,tpnl.total_gross_loss,tpnl.net_trading_pnl,
       ce.total_active_risk_amount,c.total_investors,c.active_investors,c.open_trades_count,c.closed_trades_count,
       0::numeric AS pending_company_profit_share,
       rw.total_reserved_withdrawals
FROM deposits d CROSS JOIN withdrawals w CROSS JOIN reserved_withdrawals rw
CROSS JOIN trading_pnl tpnl CROSS JOIN committed_exposure ce CROSS JOIN counts c
WHERE (select public.is_admin(auth.uid()));
ALTER VIEW public.company_financial_summary SET (security_invoker=true);

CREATE OR REPLACE FUNCTION public.request_withdrawal_with_details(
  p_account_id uuid,p_amount numeric,p_payout_details jsonb DEFAULT NULL::jsonb,
  p_idempotency_key text DEFAULT NULL::text,p_notes text DEFAULT NULL::text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_account RECORD; v_pos RECORD; v_req_id uuid; v_key text; v_existing RECORD;
BEGIN
  SELECT * INTO v_account FROM public.investor_accounts WHERE id=p_account_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Account % not found.',p_account_id; END IF;
  IF current_user NOT IN('postgres','service_role') THEN
    IF auth.uid() IS NULL OR (auth.uid()!=v_account.user_id AND NOT public.is_admin(auth.uid())) THEN RAISE EXCEPTION 'Unauthorized: Cannot request withdrawal for another investor.'; END IF;
  END IF;
  IF p_amount<=0 THEN RAISE EXCEPTION 'Withdrawal requested amount must be strictly positive (received: %).',p_amount; END IF;
  IF p_payout_details IS NULL OR jsonb_typeof(p_payout_details)<>'object' THEN RAISE EXCEPTION 'Payout destination details are required.'; END IF;
  v_key:=COALESCE(p_idempotency_key,'WD_REQ:'||p_account_id::text||':'||md5(p_amount::text||coalesce(p_payout_details::text,'')||now()::DATE::text));
  SELECT * INTO v_existing FROM public.withdrawal_requests WHERE idempotency_key=v_key;
  IF FOUND THEN
    IF v_existing.investor_id<>p_account_id OR v_existing.requested_amount<>p_amount THEN RAISE EXCEPTION 'Idempotency key is already bound to a different withdrawal request.'; END IF;
    RETURN jsonb_build_object('status','ALREADY_REQUESTED','request_id',v_existing.id,'requested_amount',v_existing.requested_amount,'withdrawal_status',v_existing.status);
  END IF;
  SELECT * INTO v_pos FROM public.get_investor_financial_position(p_account_id);
  IF p_amount>v_pos.available_capital THEN RAISE EXCEPTION 'Requested withdrawal ($%) exceeds available capital ($%).',p_amount,v_pos.available_capital; END IF;
  INSERT INTO public.withdrawal_requests(investor_id,requested_amount,currency,status,idempotency_key,notes,payout_details)
  VALUES(p_account_id,p_amount,'USD','REQUESTED',v_key,p_notes,p_payout_details) RETURNING id INTO v_req_id;
  RETURN jsonb_build_object('status','SUCCESS','request_id',v_req_id,'requested_amount',p_amount,'withdrawal_status','REQUESTED');
END;
$function$;

CREATE OR REPLACE FUNCTION public.settle_withdrawal(
  p_request_id uuid,p_settlement_ref text DEFAULT NULL,p_idempotency_key text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_req RECORD; v_existing RECORD; v_key text;
BEGIN
  IF current_user NOT IN('postgres','service_role') THEN
    IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Unauthorized: Only administrators can settle withdrawals.'; END IF;
  END IF;
  IF p_settlement_ref IS NULL OR btrim(p_settlement_ref)='' THEN RAISE EXCEPTION 'Settlement reference is required before marking a withdrawal as disbursed.'; END IF;
  SELECT * INTO v_req FROM public.withdrawal_requests WHERE id=p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Withdrawal request % not found.',p_request_id; END IF;
  IF v_req.status='PROCESSED' THEN RETURN jsonb_build_object('status','ALREADY_SETTLED','request_id',p_request_id); END IF;
  IF v_req.status<>'APPROVED' THEN RAISE EXCEPTION 'Cannot settle withdrawal in status %. Must be APPROVED first.',v_req.status; END IF;
  v_key:=COALESCE(p_idempotency_key,'WD_SETTLE:'||p_request_id::text);
  SELECT id,reference_id,investor_id,amount INTO v_existing FROM public.financial_ledger WHERE idempotency_key=v_key FOR UPDATE;
  IF FOUND THEN
    IF v_existing.reference_id<>p_request_id::text OR v_existing.investor_id<>v_req.investor_id OR v_existing.amount<>-ABS(v_req.requested_amount) THEN RAISE EXCEPTION 'Settlement idempotency key is already bound to a different ledger event.'; END IF;
    UPDATE public.withdrawal_requests SET status='PROCESSED',processed_at=COALESCE(processed_at,now()),settlement_reference=COALESCE(settlement_reference,p_settlement_ref),net_disbursed_amount=ABS(v_req.requested_amount),updated_at=now() WHERE id=p_request_id;
    RETURN jsonb_build_object('status','ALREADY_SETTLED','request_id',p_request_id,'settled_amount',ABS(v_req.requested_amount),'settlement_reference',COALESCE(v_req.settlement_reference,p_settlement_ref));
  END IF;
  INSERT INTO public.financial_ledger(investor_id,event_type,amount,currency,original_amount,original_currency,exchange_rate_to_usd,description,reference_id,idempotency_key)
  VALUES(v_req.investor_id,'WITHDRAWAL_PROCESSED',-ABS(v_req.requested_amount),'USD',-ABS(v_req.requested_amount),'USD',1.00000000,'Withdrawal settlement processed: $'||v_req.requested_amount::text||' USD (Ref: '||p_settlement_ref||')',p_request_id::text,v_key);
  UPDATE public.withdrawal_requests SET status='PROCESSED',processed_at=now(),settlement_reference=p_settlement_ref,net_disbursed_amount=ABS(v_req.requested_amount),updated_at=now() WHERE id=p_request_id;
  RETURN jsonb_build_object('status','SUCCESS','request_id',p_request_id,'withdrawal_status','PROCESSED','settled_amount',ABS(v_req.requested_amount),'settlement_reference',p_settlement_ref);
END;
$function$;

REVOKE ALL ON TABLE public.capital_events,public.investor_accounts,public.trade_participations,public.withdrawal_requests,public.investment_cycles FROM anon;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE public.capital_events,public.investor_accounts,public.trade_participations,public.withdrawal_requests,public.investment_cycles FROM authenticated;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE public.company_financial_summary FROM authenticated;
REVOKE ALL ON TABLE public.company_financial_summary FROM anon;
GRANT SELECT ON TABLE public.capital_events,public.investor_accounts,public.trade_participations,public.withdrawal_requests,public.investment_cycles TO authenticated;
GRANT SELECT ON TABLE public.company_financial_summary TO authenticated;
REVOKE EXECUTE ON FUNCTION public.request_withdrawal(uuid,numeric,text,text) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.request_withdrawal_with_details(uuid,numeric,jsonb,text,text) TO authenticated;
