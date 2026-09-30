-- ==============================================================================
-- BUILD 1G MIGRATION: SERVER-AUTHORITATIVE INVESTOR ONBOARDING & USER DEPOSIT WORKFLOW
-- ==============================================================================

-- 1. Server-Authoritative Investor Onboarding Function
CREATE OR REPLACE FUNCTION public.onboard_investor_account(
  p_user_id uuid,
  p_currency text DEFAULT 'USD',
  p_account_number text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_existing RECORD;
  v_acc_num TEXT;
  v_account_id UUID;
  v_random_suffix TEXT;
BEGIN
  -- Strict Authorization: Only verified ADMIN users can onboard investor accounts
  IF current_user NOT IN ('postgres', 'service_role') THEN
    IF v_caller IS NULL OR NOT public.is_admin(v_caller) THEN
      RAISE EXCEPTION 'Unauthorized: Only administrators can onboard investor accounts.';
    END IF;
  END IF;

  -- Validate target user exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) AND NOT EXISTS (SELECT 1 FROM public.users WHERE user_id = p_user_id) THEN
    RAISE EXCEPTION 'User % does not exist.', p_user_id;
  END IF;

  -- Prevent duplicate investor account
  SELECT * INTO v_existing FROM public.investor_accounts WHERE user_id = p_user_id;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'status', 'ALREADY_EXISTS',
      'id', v_existing.id,
      'account_number', v_existing.account_number,
      'user_id', v_existing.user_id,
      'currency', v_existing.currency,
      'account_status', v_existing.status
    );
  END IF;

  -- Generate account number authoritatively if not provided
  IF p_account_number IS NOT NULL AND trim(p_account_number) != '' THEN
    v_acc_num := trim(p_account_number);
  ELSE
    v_random_suffix := upper(substr(md5(random()::text), 1, 4));
    v_acc_num := 'INV-' || to_char(now(), 'YYYYMMDD') || '-' || v_random_suffix;
  END IF;

  -- Insert investor account (Status: ACTIVE, zero capital, zero ledger balance, zero P&L)
  INSERT INTO public.investor_accounts (
    user_id,
    account_number,
    currency,
    status
  ) VALUES (
    p_user_id,
    v_acc_num,
    COALESCE(p_currency, 'USD'),
    'ACTIVE'
  ) RETURNING id INTO v_account_id;

  -- Audit log
  INSERT INTO public.audit_logs (
    table_name,
    record_id,
    action,
    performed_by,
    payload
  ) VALUES (
    'investor_accounts',
    v_account_id,
    'ONBOARD_INVESTOR',
    v_caller,
    jsonb_build_object(
      'user_id', p_user_id,
      'account_number', v_acc_num,
      'currency', COALESCE(p_currency, 'USD')
    )
  );

  RETURN jsonb_build_object(
    'status', 'SUCCESS',
    'id', v_account_id,
    'account_number', v_acc_num,
    'user_id', p_user_id,
    'currency', COALESCE(p_currency, 'USD'),
    'account_status', 'ACTIVE'
  );
END;
$$;

-- 2. Server-Authoritative User Deposit Request Function
CREATE OR REPLACE FUNCTION public.request_deposit(
  p_account_id uuid,
  p_amount numeric,
  p_currency text DEFAULT 'USD',
  p_notes text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account RECORD;
  v_event_id UUID;
  v_key TEXT;
  v_existing RECORD;
BEGIN
  -- Validate Account
  SELECT * INTO v_account FROM public.investor_accounts WHERE id = p_account_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Investor account % not found.', p_account_id;
  END IF;

  -- Authorization Check: Caller must be the account owner or admin
  IF current_user NOT IN ('postgres', 'service_role') THEN
    IF auth.uid() IS NULL OR (auth.uid() != v_account.user_id AND NOT public.is_admin(auth.uid())) THEN
      RAISE EXCEPTION 'Unauthorized: Cannot request deposit for another investor account.';
    END IF;
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Deposit amount must be strictly positive (received: %).', p_amount;
  END IF;

  -- Idempotency Check
  v_key := COALESCE(p_idempotency_key, 'DEP_REQ:' || p_account_id::TEXT || ':' || md5(p_amount::TEXT || p_currency || now()::DATE::TEXT));
  SELECT * INTO v_existing FROM public.capital_events WHERE idempotency_key = v_key;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'status', 'ALREADY_REQUESTED',
      'event_id', v_existing.id,
      'amount', v_existing.amount,
      'currency', v_existing.currency,
      'event_status', v_existing.status
    );
  END IF;

  -- Insert Pending Capital Event (does NOT activate capital, does NOT post to ledger)
  INSERT INTO public.capital_events (
    investor_id,
    event_type,
    amount,
    currency,
    original_amount,
    original_currency,
    status,
    idempotency_key,
    notes,
    created_by
  ) VALUES (
    p_account_id,
    'ADDITIONAL_CAPITAL',
    p_amount,
    COALESCE(p_currency, 'USD'),
    p_amount,
    COALESCE(p_currency, 'USD'),
    'PENDING',
    v_key,
    p_notes,
    auth.uid()
  ) RETURNING id INTO v_event_id;

  RETURN jsonb_build_object(
    'status', 'SUCCESS',
    'event_id', v_event_id,
    'amount', p_amount,
    'currency', COALESCE(p_currency, 'USD'),
    'event_status', 'PENDING'
  );
END;
$$;

-- 3. Grants
REVOKE ALL ON FUNCTION public.onboard_investor_account(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.onboard_investor_account(uuid, text, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.request_deposit(uuid, numeric, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_deposit(uuid, numeric, text, text, text) TO authenticated, service_role;
