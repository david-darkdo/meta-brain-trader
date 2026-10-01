-- MetaBrain Trader Build 1M financial RLS/index tightening.
-- Financial client mutations are RPC-only; financial reads remain RLS-scoped.
DO $$
BEGIN
  DROP POLICY IF EXISTS capital_events_admin_manage ON public.capital_events;
  DROP POLICY IF EXISTS financial_ledger_admin_manage ON public.financial_ledger;
  DROP POLICY IF EXISTS investor_accounts_admin_manage ON public.investor_accounts;
  DROP POLICY IF EXISTS trade_participations_admin_manage ON public.trade_participations;
  DROP POLICY IF EXISTS withdrawal_requests_admin_manage ON public.withdrawal_requests;
  DROP POLICY IF EXISTS investment_cycles_admin_manage ON public.investment_cycles;
  DROP POLICY IF EXISTS withdrawal_requests_investor_insert ON public.withdrawal_requests;
  DROP POLICY IF EXISTS withdrawal_requests_investor_update ON public.withdrawal_requests;
END $$;
CREATE POLICY capital_events_admin_read ON public.capital_events FOR SELECT TO authenticated USING ((select public.is_admin((select auth.uid()))));
CREATE POLICY financial_ledger_admin_read ON public.financial_ledger FOR SELECT TO authenticated USING ((select public.is_admin((select auth.uid()))));
CREATE POLICY investor_accounts_admin_read ON public.investor_accounts FOR SELECT TO authenticated USING ((select public.is_admin((select auth.uid()))));
CREATE POLICY trade_participations_admin_read ON public.trade_participations FOR SELECT TO authenticated USING ((select public.is_admin((select auth.uid()))));
CREATE POLICY withdrawal_requests_admin_read ON public.withdrawal_requests FOR SELECT TO authenticated USING ((select public.is_admin((select auth.uid()))));
CREATE POLICY investment_cycles_admin_read ON public.investment_cycles FOR SELECT TO authenticated USING ((select public.is_admin((select auth.uid()))));
CREATE INDEX IF NOT EXISTS financial_ledger_investor_id_idx ON public.financial_ledger(investor_id);
CREATE INDEX IF NOT EXISTS financial_ledger_cycle_id_idx ON public.financial_ledger(cycle_id);
CREATE INDEX IF NOT EXISTS financial_ledger_trade_id_idx ON public.financial_ledger(trade_id);
CREATE INDEX IF NOT EXISTS financial_ledger_participation_id_idx ON public.financial_ledger(participation_id);
CREATE INDEX IF NOT EXISTS capital_events_created_by_idx ON public.capital_events(created_by);
CREATE INDEX IF NOT EXISTS capital_events_reviewed_by_idx ON public.capital_events(reviewed_by);
