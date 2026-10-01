-- Item 2 validator fix: make reversals compatible with immutable journals and repair reconciliation source matching.
CREATE OR REPLACE FUNCTION public.reverse_journal_entry(
 p_entry_id uuid,p_reversal_idempotency_key text,p_effective_at timestamptz DEFAULT now(),p_reason text DEFAULT 'Accounting reversal')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE e public.journal_entries; v_existing uuid;
BEGIN
 IF current_user NOT IN ('postgres','service_role') AND (select public.is_admin((select auth.uid()))) IS NOT TRUE THEN RAISE EXCEPTION 'Unauthorized: accounting reversal is admin-only.'; END IF;
 SELECT * INTO e FROM public.journal_entries WHERE id=p_entry_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Journal entry % not found.',p_entry_id; END IF;
 IF EXISTS(select 1 from public.journal_entries where reversal_of_entry_id=p_entry_id) THEN select id into v_existing from public.journal_entries where reversal_of_entry_id=p_entry_id limit 1; return v_existing; END IF;
 IF nullif(btrim(p_reversal_idempotency_key),'') IS NULL THEN RAISE EXCEPTION 'Reversal idempotency key is required.'; END IF;
 SELECT id INTO v_existing FROM public.journal_entries WHERE idempotency_key=p_reversal_idempotency_key;
 IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;
 INSERT INTO public.journal_entries(source_type,source_id,idempotency_key,effective_at,description,reversal_of_entry_id,investor_id,cycle_id,trade_id,metadata,status)
 VALUES('REVERSAL',e.id::text,p_reversal_idempotency_key,coalesce(p_effective_at,now()),coalesce(nullif(p_reason,''),'Accounting reversal')||' of entry #'||e.entry_number::text,e.id,e.investor_id,e.cycle_id,e.trade_id,jsonb_build_object('reversal_of_entry_id',e.id),'POSTED') RETURNING id INTO v_existing;
 INSERT INTO public.journal_lines(journal_entry_id,account_id,line_number,description,debit,credit,currency,effective_at,investor_id,cycle_id,trade_id,metadata)
 SELECT v_existing,jl.account_id,jl.line_number,'Reversal of entry #'||e.entry_number::text,jl.credit,jl.debit,'USD',coalesce(p_effective_at,now()),jl.investor_id,jl.cycle_id,jl.trade_id,jsonb_build_object('reversal_of_line_id',jl.id)
 FROM public.journal_lines jl WHERE jl.journal_entry_id=p_entry_id;
 RETURN v_existing;
EXCEPTION WHEN unique_violation THEN
 SELECT id INTO v_existing FROM public.journal_entries WHERE idempotency_key=p_reversal_idempotency_key;
 IF v_existing IS NOT NULL THEN RETURN v_existing; END IF; RAISE;
END; $$;
REVOKE EXECUTE ON FUNCTION public.reverse_journal_entry(uuid,text,timestamptz,text) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_journal_entry(uuid,text,timestamptz,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.reconcile_accounting_foundation()
RETURNS TABLE(check_name text,status text,detail text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $$
DECLARE d numeric; c numeric; u bigint; j bigint; m bigint;
BEGIN
 IF current_user NOT IN ('postgres','service_role') AND (select public.is_admin((select auth.uid()))) IS NOT TRUE THEN RAISE EXCEPTION 'Unauthorized: accounting reconciliation is admin-only.'; END IF;
 SELECT coalesce(sum(debit),0),coalesce(sum(credit),0) INTO d,c FROM public.journal_lines;
 RETURN QUERY SELECT 'TRIAL_BALANCE',case when abs(d-c)<=0.00000001 then 'PASS' else 'FAIL' end,format('Debits=%s Credits=%s Difference=%s',d,c,d-c);
 SELECT count(*) INTO j FROM (select je.id from public.journal_entries je left join public.journal_lines jl on jl.journal_entry_id=je.id group by je.id having count(jl.id)<2 or abs(coalesce(sum(jl.debit),0)-coalesce(sum(jl.credit),0))>0.00000001) q;
 RETURN QUERY SELECT 'JOURNAL_BALANCE',case when j=0 then 'PASS' else 'FAIL' end,format('Invalid journal entries=%s',j);
 SELECT count(*) INTO u FROM public.financial_ledger fl left join public.journal_entries je on je.idempotency_key='ACCT:FINANCIAL_LEDGER:'||fl.id::text where fl.event_type in('CAPITAL_ACTIVATED','ADDITIONAL_CAPITAL','WITHDRAWAL_PROCESSED') and je.id is null;
 RETURN QUERY SELECT 'CAPITAL_WITHDRAWAL_COVERAGE',case when u=0 then 'PASS' else 'FAIL' end,format('Unjournalized capital/withdrawal events=%s',u);
 SELECT count(*) INTO m FROM (select fl.id,fl.amount from public.financial_ledger fl join public.journal_entries je on je.idempotency_key='ACCT:FINANCIAL_LEDGER:'||fl.id::text join public.journal_lines jl on jl.journal_entry_id=je.id where fl.event_type in('CAPITAL_ACTIVATED','ADDITIONAL_CAPITAL','WITHDRAWAL_PROCESSED') group by fl.id,fl.amount having abs(abs(sum(jl.debit-jl.credit))-abs(fl.amount))>0.00000001) q;
 RETURN QUERY SELECT 'SOURCE_AMOUNT_MATCH',case when m=0 then 'PASS' else 'FAIL' end,format('Financial events with journal/source amount mismatch=%s',m);
 RETURN QUERY SELECT 'UNSUPPORTED_TRADE_EVENTS',case when count(*)=0 then 'PASS' else 'INFO' end,format('Trade/P&L events remain outside the foundation bridge until cycle-level settlement rules are implemented: %s',count(*)) FROM public.financial_ledger WHERE event_type in('TRADE_ALLOCATION_PROFIT','TRADE_ALLOCATION_LOSS','CYCLE_SETTLEMENT_PROFIT');
 RETURN QUERY SELECT 'PARTICIPATION_NOT_ACCOUNTED_AS_CASH',case when count(*)=0 then 'PASS' else 'INFO' end,format('Trade participation rows exist but are not posted as cash movements by Item 2: %s',count(*)) FROM public.trade_participations;
END; $$;