-- Item 2 reconciliation precision: prove journal source amounts, not only journal existence.
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
 SELECT count(*) INTO m FROM (select fl.id,fl.amount from public.financial_ledger fl join public.journal_entries je on je.idempotency_key='ACCT:FINANCIAL_LEDGER:'||fl.id::text join public.journal_lines jl on jl.journal_entry_id=je.id where fl.event_type in('CAPITAL_ACTIVATED','ADDITIONAL_CAPITAL','WITHDRAWAL_PROCESSED') group by fl.id,fl.amount having abs(sum(jl.debit)-abs(fl.amount))>0.00000001 or abs(sum(jl.credit)-abs(fl.amount))>0.00000001) q;
 RETURN QUERY SELECT 'SOURCE_AMOUNT_MATCH',case when m=0 then 'PASS' else 'FAIL' end,format('Financial events with journal/source amount mismatch=%s',m);
 RETURN QUERY SELECT 'UNSUPPORTED_TRADE_EVENTS',case when count(*)=0 then 'PASS' else 'INFO' end,format('Trade/P&L events remain outside the foundation bridge until cycle-level settlement rules are implemented: %s',count(*)) FROM public.financial_ledger WHERE event_type in('TRADE_ALLOCATION_PROFIT','TRADE_ALLOCATION_LOSS','CYCLE_SETTLEMENT_PROFIT');
 RETURN QUERY SELECT 'PARTICIPATION_NOT_ACCOUNTED_AS_CASH',case when count(*)=0 then 'PASS' else 'INFO' end,format('Trade participation rows exist but are not posted as cash movements by Item 2: %s',count(*)) FROM public.trade_participations;
END; $$;
