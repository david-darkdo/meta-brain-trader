-- Item 2 validator hardening: enforce USD base accounting and add controlled reversals.
ALTER TABLE public.journal_lines DROP CONSTRAINT IF EXISTS journal_lines_base_currency_check;
ALTER TABLE public.journal_lines ADD CONSTRAINT journal_lines_base_currency_check CHECK (upper(currency)='USD');

CREATE OR REPLACE FUNCTION public.reverse_journal_entry(p_entry_id uuid,p_reversal_idempotency_key text,p_effective_at timestamptz DEFAULT now(),p_reason text DEFAULT 'Accounting reversal')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
