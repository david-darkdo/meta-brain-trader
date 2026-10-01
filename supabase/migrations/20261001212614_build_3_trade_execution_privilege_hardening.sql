REVOKE UPDATE (executed, executed_at, trade_status) ON public.trades FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.execute_trade(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.execute_trade(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.execute_trade(UUID) TO authenticated;