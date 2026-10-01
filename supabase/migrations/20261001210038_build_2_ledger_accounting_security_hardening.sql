-- Item 2 accounting security hardening.
-- Internal trigger helpers are not Data API callable; reconciliation remains admin-only.
revoke execute on function public.prevent_accounting_mutation() from public,anon,authenticated;
revoke execute on function public.set_chart_of_accounts_updated_at() from public,anon,authenticated;
revoke execute on function public.reconcile_accounting_foundation() from public,anon;
grant execute on function public.reconcile_accounting_foundation() to authenticated;
alter function public.prevent_accounting_mutation() security invoker;
alter function public.set_chart_of_accounts_updated_at() security invoker;
