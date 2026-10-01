-- ============================================================================
-- META BRAIN TRADER — BUILD 3: TRADE VALIDATOR EXECUTION BOUNDARY
-- ============================================================================
-- AI validation and real trade execution are separate state transitions.
-- Running the validator never activates MetaFund participation.
-- Only execute_trade() may cross the execution boundary.
-- ============================================================================

ALTER TABLE public.trades
  ALTER COLUMN executed SET DEFAULT false;

CREATE OR REPLACE FUNCTION public.execute_trade(
  p_trade_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_trade RECORD;
  v_snapshot JSONB;
  v_exec_time TIMESTAMPTZ := now();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT *
  INTO v_trade
  FROM public.trades
  WHERE trade_id = p_trade_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trade % not found.', p_trade_id;
  END IF;

  IF NOT (
    v_trade.user_id = v_caller
    OR public.is_admin(v_caller)
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = v_caller AND role = 'TRADER'
    )
  ) THEN
    RAISE EXCEPTION 'Unauthorized: you cannot execute this trade.';
  END IF;

  IF v_trade.executed THEN
    RETURN jsonb_build_object(
      'status', 'ALREADY_EXECUTED',
      'trade_id', p_trade_id,
      'executed_at', v_trade.executed_at
    );
  END IF;

  IF v_trade.trade_status <> 'PRE_ANALYZED' OR v_trade.processing_step <> 'COMPLETED' THEN
    RAISE EXCEPTION 'Trade must complete Meta Validator pre-trade validation before execution. Current status: %, processing step: %.',
      v_trade.trade_status, v_trade.processing_step;
  END IF;

  UPDATE public.trades
  SET executed = true,
      executed_at = v_exec_time,
      updated_at = now()
  WHERE trade_id = p_trade_id;

  v_snapshot := public.snapshot_trade_participations(p_trade_id);

  INSERT INTO public.audit_logs (
    table_name,
    record_id,
    action,
    performed_by,
    payload
  ) VALUES (
    'trades',
    p_trade_id,
    'EXECUTE_TRADE',
    v_caller,
    jsonb_build_object(
      'trade_id', p_trade_id,
      'executed_at', v_exec_time,
      'snapshot', v_snapshot
    )
  );

  RETURN jsonb_build_object(
    'status', 'EXECUTED',
    'trade_id', p_trade_id,
    'executed_at', v_exec_time,
    'snapshot', v_snapshot
  );
END;
$$;

REVOKE ALL ON FUNCTION public.execute_trade(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.execute_trade(UUID) TO authenticated;

REVOKE UPDATE (executed, executed_at, trade_status) ON public.trades FROM authenticated;
