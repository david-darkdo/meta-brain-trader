-- Build 3: authenticated clients may edit trade data but never execution state.
REVOKE UPDATE ON public.trades FROM authenticated;
REVOKE UPDATE ON public.trades FROM PUBLIC;
GRANT UPDATE (
  trade_id, user_id, pair, direction, entry_price, stop_loss, take_profit,
  account_size, risk_pct, session, user_override, notes, created_at, updated_at,
  current_strategy_profile_id, processing_step, processing_error, day_of_week
) ON public.trades TO authenticated;
