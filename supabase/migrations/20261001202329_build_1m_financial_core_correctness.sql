-- MetaBrain Trader Build 1M: Financial Core Correctness
-- Applied to production as migration 20261001202329.
-- Rate semantics: 1 USD = X units of the original currency.
-- Therefore USD base value = original amount / FX rate.
-- Historical financial events are intentionally NOT rewritten by this migration.

CREATE OR REPLACE FUNCTION public.admin_approve_deposit_event(
  p_event_id uuid, p_exchange_rate_to_usd numeric, p_fx_source text, p_review_notes text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_event public.capital_events;
  v_base_usd numeric(20,6);
  v_original_amount numeric(20,6);
  v_original_currency text;
  v_ledger_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin authorization required'; END IF;
  IF p_exchange_rate_to_usd IS NULL OR p_exchange_rate_to_usd <= 0 THEN RAISE EXCEPTION 'A positive USD conversion rate is required'; END IF;
  SELECT * INTO v_event FROM public.capital_events WHERE id=p_event_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Deposit event not found'; END IF;
  IF v_event.status <> 'PENDING' THEN RAISE EXCEPTION 'Only PENDING deposit events can be approved'; END IF;
  IF v_event.proof_storage_path IS NULL OR v_event.proof_submitted_at IS NULL THEN RAISE EXCEPTION 'Payment proof must be submitted before approval'; END IF;
  v_original_amount := COALESCE(v_event.original_amount, v_event.amount);
  v_original_currency := upper(COALESCE(v_event.original_currency, v_event.currency, 'USD'));
  IF v_original_amount <= 0 THEN RAISE EXCEPTION 'Deposit original amount must be strictly positive'; END IF;
  IF v_original_currency='USD' AND p_exchange_rate_to_usd <> 1 THEN RAISE EXCEPTION 'USD deposits must use a 1.0 USD conversion rate'; END IF;
  v_base_usd := round(v_original_amount / p_exchange_rate_to_usd, 6);
  UPDATE public.capital_events SET status='ACTIVATED', activated_at=coalesce(activated_at,now()), effective_at=coalesce(effective_at,now()), original_amount=v_original_amount, original_currency=v_original_currency, exchange_rate_to_usd=p_exchange_rate_to_usd, fx_rate_timestamp=now(), fx_source=nullif(trim(p_fx_source),''), base_amount_usd=v_base_usd, reviewed_by=auth.uid(), reviewed_at=now(), review_notes=nullif(trim(p_review_notes),''), updated_at=now() WHERE id=p_event_id;
  INSERT INTO public.financial_ledger(investor_id,event_type,amount,currency,original_amount,original_currency,exchange_rate_to_usd,description,reference_id,idempotency_key,metadata)
  VALUES(v_event.investor_id,'CAPITAL_ACTIVATED',v_base_usd,'USD',v_original_amount,v_original_currency,p_exchange_rate_to_usd,'Verified deposit activated',p_event_id::text,'deposit_act_'||p_event_id::text,jsonb_build_object('payment_account_id',v_event.company_payment_account_id,'proof_storage_path',v_event.proof_storage_path,'approved_by',auth.uid(),'fx_source',p_fx_source,'fx_semantics','1 USD = X original currency units'))
  ON CONFLICT(idempotency_key) DO NOTHING RETURNING id INTO v_ledger_id;
  UPDATE public.investor_accounts SET status='ACTIVE' WHERE id=v_event.investor_id AND status='PENDING_APPROVAL';
  INSERT INTO public.audit_logs(table_name,record_id,action,performed_by,payload)
  VALUES('capital_events',p_event_id,'APPROVE_DEPOSIT',auth.uid(),jsonb_build_object('base_amount_usd',v_base_usd,'original_amount',v_original_amount,'original_currency',v_original_currency,'exchange_rate_to_usd',p_exchange_rate_to_usd,'fx_source',p_fx_source,'ledger_id',v_ledger_id));
  RETURN jsonb_build_object('status','ACTIVATED','event_id',p_event_id,'base_amount_usd',v_base_usd,'ledger_id',v_ledger_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.activate_capital_event(
  p_event_id uuid, p_admin_user_id uuid DEFAULT auth.uid()
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_event RECORD; v_ledger_event public.ledger_event_type; v_ledger_amount numeric(20,6); v_ledger_id uuid; v_base_usd numeric(20,6); v_fx_rate numeric(20,8); v_original_amount numeric(20,6); v_original_currency text;
BEGIN
  IF current_user NOT IN ('postgres','service_role') AND (auth.uid() IS NULL OR NOT public.is_admin(auth.uid())) THEN RAISE EXCEPTION 'Unauthorized: Only administrators can activate capital events.'; END IF;
  SELECT * INTO v_event FROM public.capital_events WHERE id=p_event_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Capital event not found: %',p_event_id; END IF;
  IF v_event.status='ACTIVATED' THEN RETURN jsonb_build_object('status','already_activated','event_id',p_event_id); END IF;
  v_original_amount:=COALESCE(v_event.original_amount,v_event.amount);
  v_original_currency:=upper(COALESCE(v_event.original_currency,v_event.currency,'USD'));
  v_fx_rate:=COALESCE(v_event.exchange_rate_to_usd,1.00000000);
  IF v_original_amount<=0 THEN RAISE EXCEPTION 'Capital event original amount must be strictly positive.'; END IF;
  IF v_fx_rate<=0 THEN RAISE EXCEPTION 'Capital event FX rate must be strictly positive.'; END IF;
  IF v_original_currency='USD' AND v_fx_rate<>1 THEN RAISE EXCEPTION 'USD capital events must use a 1.0 USD conversion rate.'; END IF;
  v_base_usd:=ROUND(v_original_amount/v_fx_rate,6);
  IF v_event.event_type='INITIAL_CAPITAL' THEN v_ledger_event:='CAPITAL_ACTIVATED'; v_ledger_amount:=v_base_usd;
  ELSIF v_event.event_type='ADDITIONAL_CAPITAL' THEN v_ledger_event:='ADDITIONAL_CAPITAL'; v_ledger_amount:=v_base_usd;
  ELSIF v_event.event_type='WITHDRAWAL' THEN v_ledger_event:='WITHDRAWAL_PROCESSED'; v_ledger_amount:=-v_base_usd;
  ELSIF v_event.event_type='ADJUSTMENT' THEN v_ledger_event:='ADJUSTMENT'; v_ledger_amount:=v_base_usd;
  ELSE v_ledger_event:='REVERSAL'; v_ledger_amount:=v_base_usd; END IF;
  UPDATE public.capital_events SET status='ACTIVATED',activated_at=coalesce(activated_at,now()),original_amount=v_original_amount,original_currency=v_original_currency,exchange_rate_to_usd=v_fx_rate,base_amount_usd=v_base_usd,updated_at=now() WHERE id=p_event_id;
  INSERT INTO public.financial_ledger(investor_id,event_type,amount,currency,original_amount,original_currency,exchange_rate_to_usd,idempotency_key,reference_id,description,metadata)
  VALUES(v_event.investor_id,v_ledger_event,v_ledger_amount,'USD',CASE WHEN v_event.event_type='WITHDRAWAL' THEN -v_original_amount ELSE v_original_amount END,v_original_currency,v_fx_rate,'cap_act_'||p_event_id::text,p_event_id::text,'Capital event activated ('||v_event.event_type||')',jsonb_build_object('activated_by',auth.uid(),'base_amount_usd',v_base_usd))
  ON CONFLICT(idempotency_key) DO NOTHING RETURNING id INTO v_ledger_id;
  UPDATE public.investor_accounts SET status='ACTIVE' WHERE id=v_event.investor_id AND status='PENDING_APPROVAL';
  RETURN jsonb_build_object('status','activated','event_id',p_event_id,'ledger_id',v_ledger_id,'base_amount_usd',v_base_usd);
END;
$function$;

CREATE OR REPLACE FUNCTION public.activate_capital_event(
  p_investor_id uuid,p_amount numeric,p_currency text DEFAULT 'USD',p_exchange_rate numeric DEFAULT 1.00000000,p_fx_source text DEFAULT 'MANUAL',p_effective_at timestamptz DEFAULT now(),p_idempotency_key text DEFAULT NULL,p_notes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_account RECORD; v_base_usd numeric(20,6); v_event_id uuid; v_key text; v_existing_event RECORD; v_currency text:=upper(trim(COALESCE(p_currency,'USD')));
BEGIN
  IF current_user NOT IN ('postgres','service_role') AND (auth.uid() IS NULL OR NOT public.is_admin(auth.uid())) THEN RAISE EXCEPTION 'Unauthorized: Only administrators can activate investor capital.'; END IF;
  SELECT * INTO v_account FROM public.investor_accounts WHERE id=p_investor_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Investor account % not found.',p_investor_id; END IF;
  IF v_account.status NOT IN ('ACTIVE','PENDING_APPROVAL') THEN RAISE EXCEPTION 'Cannot activate capital for account with status %.',v_account.status; END IF;
  IF p_amount<=0 THEN RAISE EXCEPTION 'Capital amount must be strictly positive (received: %).',p_amount; END IF;
  IF p_exchange_rate<=0 THEN RAISE EXCEPTION 'Exchange rate must be strictly positive (received: %).',p_exchange_rate; END IF;
  IF v_currency='USD' AND p_exchange_rate<>1 THEN RAISE EXCEPTION 'USD capital must use a 1.0 USD conversion rate.'; END IF;
  v_key:=COALESCE(p_idempotency_key,'CAP_ACT:'||p_investor_id::text||':'||md5(p_amount::text||v_currency||p_effective_at::text));
  SELECT * INTO v_existing_event FROM public.capital_events WHERE idempotency_key=v_key;
  IF FOUND THEN RETURN jsonb_build_object('status','ALREADY_PROCESSED','event_id',v_existing_event.id,'base_amount_usd',v_existing_event.base_amount_usd,'idempotency_key',v_key); END IF;
  v_base_usd:=ROUND(p_amount/p_exchange_rate,6);
  INSERT INTO public.capital_events(investor_id,event_type,amount,currency,original_amount,original_currency,base_amount_usd,exchange_rate_to_usd,fx_rate_timestamp,fx_source,status,effective_at,activated_at,idempotency_key,notes)
  VALUES(p_investor_id,'ADDITIONAL_CAPITAL',v_base_usd,'USD',p_amount,v_currency,v_base_usd,p_exchange_rate,now(),p_fx_source,'ACTIVATED',p_effective_at,now(),v_key,p_notes) RETURNING id INTO v_event_id;
  INSERT INTO public.financial_ledger(investor_id,event_type,amount,currency,original_amount,original_currency,exchange_rate_to_usd,description,reference_id,idempotency_key)
  VALUES(p_investor_id,'CAPITAL_ACTIVATED',v_base_usd,'USD',p_amount,v_currency,p_exchange_rate,'Capital activation: '||p_amount::text||' '||v_currency||' (Base: $'||v_base_usd::text||' USD)',v_event_id::text,'cap_act_'||v_event_id::text);
  IF v_account.status='PENDING_APPROVAL' THEN UPDATE public.investor_accounts SET status='ACTIVE' WHERE id=p_investor_id; END IF;
  INSERT INTO public.audit_logs(table_name,record_id,action,performed_by,payload)
  VALUES('capital_events',v_event_id,'ACTIVATE_CAPITAL',auth.uid(),jsonb_build_object('investor_id',p_investor_id,'original_amount',p_amount,'original_currency',v_currency,'base_amount_usd',v_base_usd,'exchange_rate',p_exchange_rate,'idempotency_key',v_key));
  RETURN jsonb_build_object('status','SUCCESS','event_id',v_event_id,'base_amount_usd',v_base_usd,'idempotency_key',v_key);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_investor_financial_position(p_investor_id uuid)
RETURNS TABLE(cumulative_deposited numeric,current_contributed_capital numeric,active_committed_capital numeric,available_capital numeric,realized_trading_pnl numeric,current_economic_equity numeric,settled_capital numeric,cumulative_withdrawn numeric,open_trades_count integer,closed_trades_count integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_caller uuid:=auth.uid(); v_deposited numeric(20,6):=0; v_withdrawn numeric(20,6):=0; v_pnl numeric(20,6):=0; v_committed numeric(20,6):=0; v_reserved_withdrawals numeric(20,6):=0; v_open_count integer:=0; v_closed_count integer:=0;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
  IF NOT(public.is_admin(v_caller) OR EXISTS(SELECT 1 FROM public.investor_accounts WHERE id=p_investor_id AND user_id=v_caller)) THEN RAISE EXCEPTION 'Access denied.'; END IF;
  SELECT COALESCE(SUM(COALESCE(base_amount_usd,amount)),0) INTO v_deposited FROM public.capital_events WHERE investor_id=p_investor_id AND status='ACTIVATED' AND event_type IN('INITIAL_CAPITAL','ADDITIONAL_CAPITAL');
  SELECT COALESCE(SUM(ABS(amount)),0) INTO v_withdrawn FROM public.financial_ledger WHERE investor_id=p_investor_id AND event_type='WITHDRAWAL_PROCESSED' AND amount<0;
  SELECT COALESCE(SUM(amount),0) INTO v_pnl FROM public.financial_ledger WHERE investor_id=p_investor_id AND event_type IN('TRADE_ALLOCATION_PROFIT','TRADE_ALLOCATION_LOSS','CYCLE_SETTLEMENT_PROFIT');
  SELECT COALESCE(SUM(tp.participating_capital_snapshot),0),COUNT(tp.id) INTO v_committed,v_open_count FROM public.trade_participations tp JOIN public.trades t ON t.trade_id=tp.trade_id WHERE tp.investor_id=p_investor_id AND tp.status='COMMITTED' AND t.trade_status NOT IN('POST_ANALYZED','JOURNALED','DELETED');
  SELECT COUNT(tp.id) INTO v_closed_count FROM public.trade_participations tp WHERE tp.investor_id=p_investor_id AND tp.status='ALLOCATED';
  SELECT COALESCE(SUM(requested_amount),0) INTO v_reserved_withdrawals FROM public.withdrawal_requests WHERE investor_id=p_investor_id AND status IN('REQUESTED','UNDER_REVIEW','WAITING_FOR_OPEN_TRADES','PERFORMANCE_CRYSTALLIZATION_REQUIRED','APPROVED');
  cumulative_deposited:=v_deposited; cumulative_withdrawn:=v_withdrawn; current_contributed_capital:=v_deposited-v_withdrawn; realized_trading_pnl:=v_pnl; current_economic_equity:=v_deposited+v_pnl-v_withdrawn; active_committed_capital:=v_committed; available_capital:=GREATEST(0,(v_deposited+v_pnl-v_withdrawn)-v_committed-v_reserved_withdrawals); settled_capital:=v_deposited-v_withdrawn; open_trades_count:=v_open_count; closed_trades_count:=v_closed_count; RETURN NEXT;
END;
$function$;

CREATE OR REPLACE FUNCTION public.approve_withdrawal(p_request_id uuid,p_admin_notes text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_req RECORD; v_pos RECORD; v_available_before_request numeric(20,6);
BEGIN
  IF current_user NOT IN('postgres','service_role') AND (auth.uid() IS NULL OR NOT public.is_admin(auth.uid())) THEN RAISE EXCEPTION 'Unauthorized: Only administrators can approve withdrawals.'; END IF;
  SELECT * INTO v_req FROM public.withdrawal_requests WHERE id=p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Withdrawal request % not found.',p_request_id; END IF;
  IF v_req.status<>'REQUESTED' THEN RAISE EXCEPTION 'Cannot approve withdrawal with status %.',v_req.status; END IF;
  SELECT * INTO v_pos FROM public.get_investor_financial_position(v_req.investor_id);
  v_available_before_request:=v_pos.available_capital+v_req.requested_amount;
  IF v_req.requested_amount>v_available_before_request THEN RAISE EXCEPTION 'Cannot approve: Requested amount ($%) exceeds current available capital before this request ($%).',v_req.requested_amount,v_available_before_request; END IF;
  UPDATE public.withdrawal_requests SET status='APPROVED',reviewed_by=auth.uid(),reviewed_at=now(),approved_at=now(),notes=COALESCE(p_admin_notes,notes),updated_at=now() WHERE id=p_request_id;
  RETURN jsonb_build_object('status','SUCCESS','request_id',p_request_id,'withdrawal_status','APPROVED');
END;
$function$;

CREATE OR REPLACE FUNCTION public.settle_withdrawal(p_request_id uuid,p_settlement_ref text DEFAULT NULL,p_idempotency_key text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_req RECORD; v_key TEXT;
BEGIN
  IF current_user NOT IN('postgres','service_role') AND (auth.uid() IS NULL OR NOT public.is_admin(auth.uid())) THEN RAISE EXCEPTION 'Unauthorized: Only administrators can settle withdrawals.'; END IF;
  IF p_settlement_ref IS NULL OR btrim(p_settlement_ref)='' THEN RAISE EXCEPTION 'Settlement reference is required before marking a withdrawal as disbursed.'; END IF;
  SELECT * INTO v_req FROM public.withdrawal_requests WHERE id=p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Withdrawal request % not found.',p_request_id; END IF;
  IF v_req.status='PROCESSED' THEN RETURN jsonb_build_object('status','ALREADY_SETTLED','request_id',p_request_id); END IF;
  IF v_req.status<>'APPROVED' THEN RAISE EXCEPTION 'Cannot settle withdrawal in status %. Must be APPROVED first.',v_req.status; END IF;
  v_key:=COALESCE(p_idempotency_key,'WD_SETTLE:'||p_request_id::text);
  INSERT INTO public.financial_ledger(investor_id,event_type,amount,currency,original_amount,original_currency,exchange_rate_to_usd,description,reference_id,idempotency_key)
  VALUES(v_req.investor_id,'WITHDRAWAL_PROCESSED',-ABS(v_req.requested_amount),'USD',-ABS(v_req.requested_amount),'USD',1.00000000,'Withdrawal settlement processed: $'||v_req.requested_amount::text||' USD (Ref: '||p_settlement_ref||')',p_request_id::text,v_key)
  ON CONFLICT(idempotency_key) DO NOTHING;
  UPDATE public.withdrawal_requests SET status='PROCESSED',processed_at=now(),settlement_reference=p_settlement_ref,net_disbursed_amount=ABS(v_req.requested_amount),updated_at=now() WHERE id=p_request_id;
  RETURN jsonb_build_object('status','SUCCESS','request_id',p_request_id,'withdrawal_status','PROCESSED','settled_amount',ABS(v_req.requested_amount),'settlement_reference',p_settlement_ref);
END;
$function$;

DO $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='trades' AND policyname='trades_admin_read') THEN
    CREATE POLICY trades_admin_read ON public.trades FOR SELECT TO authenticated USING ((select public.is_admin(auth.uid())));
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='trades' AND policyname='trades_investor_participation_read') THEN
    CREATE POLICY trades_investor_participation_read ON public.trades FOR SELECT TO authenticated USING (
      EXISTS(SELECT 1 FROM public.trade_participations tp JOIN public.investor_accounts ia ON ia.id=tp.investor_id WHERE tp.trade_id=trades.trade_id AND ia.user_id=(select auth.uid()))
    );
  END IF;
END $$;

ALTER VIEW public.investor_financial_summary SET (security_invoker=true);
ALTER VIEW public.investor_trade_history SET (security_invoker=true);
ALTER VIEW public.company_financial_summary SET (security_invoker=true);

CREATE OR REPLACE VIEW public.company_financial_summary AS
WITH deposits AS(
  SELECT COALESCE(sum(COALESCE(ce.base_amount_usd,ce.amount)),0)::numeric AS total_deposited FROM public.capital_events ce WHERE ce.status='ACTIVATED' AND ce.event_type IN('INITIAL_CAPITAL','ADDITIONAL_CAPITAL')
), withdrawals AS(
  SELECT COALESCE(sum(ABS(fl.amount)),0)::numeric AS total_withdrawn FROM public.financial_ledger fl WHERE fl.event_type='WITHDRAWAL_PROCESSED' AND fl.amount<0
), trading_pnl AS(
  SELECT COALESCE(sum(CASE WHEN fl.amount>0 THEN fl.amount ELSE 0 END),0)::numeric AS total_gross_profit, COALESCE(sum(CASE WHEN fl.amount<0 THEN fl.amount ELSE 0 END),0)::numeric AS total_gross_loss, COALESCE(sum(fl.amount),0)::numeric AS net_trading_pnl FROM public.financial_ledger fl WHERE fl.event_type IN('TRADE_ALLOCATION_PROFIT','TRADE_ALLOCATION_LOSS')
), committed_exposure AS(
  SELECT COALESCE(sum(tp.participating_capital_snapshot),0)::numeric AS total_active_committed_capital, COALESCE(sum(tp.risk_amount),0)::numeric AS total_active_risk_amount FROM public.trade_participations tp JOIN public.trades t ON t.trade_id=tp.trade_id WHERE tp.status='COMMITTED' AND t.trade_status NOT IN('POST_ANALYZED','JOURNALED','DELETED')
), counts AS(
  SELECT (SELECT count(*) FROM public.investor_accounts) AS total_investors,(SELECT count(*) FROM public.investor_accounts WHERE status='ACTIVE') AS active_investors,(SELECT count(*) FROM public.trades WHERE trade_status NOT IN('POST_ANALYZED','JOURNALED','DELETED')) AS open_trades_count,(SELECT count(*) FROM public.trades WHERE trade_status IN('POST_ANALYZED','JOURNALED')) AS closed_trades_count
)
SELECT d.total_deposited,ce.total_active_committed_capital,GREATEST(0,d.total_deposited+tpnl.net_trading_pnl-w.total_withdrawn-ce.total_active_committed_capital) AS total_available_capital,d.total_deposited+tpnl.net_trading_pnl-w.total_withdrawn AS total_economic_equity,w.total_withdrawn,tpnl.total_gross_profit,tpnl.total_gross_loss,tpnl.net_trading_pnl,ce.total_active_risk_amount,c.total_investors,c.active_investors,c.open_trades_count,c.closed_trades_count,round(tpnl.total_gross_profit*0.30,6) AS pending_company_profit_share
FROM deposits d CROSS JOIN withdrawals w CROSS JOIN trading_pnl tpnl CROSS JOIN committed_exposure ce CROSS JOIN counts c
WHERE (select public.is_admin(auth.uid()));

GRANT EXECUTE ON FUNCTION public.admin_approve_deposit_event(uuid,numeric,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_capital_event(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_capital_event(uuid,numeric,text,numeric,text,timestamptz,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_investor_financial_position(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_withdrawal_with_details(uuid,numeric,jsonb,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_withdrawal(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.settle_withdrawal(uuid,text,text) TO authenticated;
