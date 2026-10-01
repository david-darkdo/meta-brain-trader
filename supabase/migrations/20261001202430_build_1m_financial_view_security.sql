-- MetaBrain Trader Build 1M: ensure the recreated company financial view retains caller RLS semantics.
ALTER VIEW public.company_financial_summary SET (security_invoker=true);
