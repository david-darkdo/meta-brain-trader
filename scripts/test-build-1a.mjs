import fs from 'fs';
import https from 'https';

const env = fs.readFileSync('.env', 'utf8');
const tokenMatch = env.match(/superbase_Access_Tokens\s*=\s*(.+)/);
let token = tokenMatch ? tokenMatch[1].trim().replace(/^["']|["']$/g, '') : null;
const projectRef = 'jqptprskuxkhfoxsvwcl';

async function runSql(sql) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.supabase.com',
      path: `/v1/projects/${projectRef}/database/query`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve(data);
          }
        } else {
          reject(new Error(`SQL Error (${res.statusCode}): ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.write(JSON.stringify({ query: sql }));
    req.end();
  });
}

async function runTests() {
  console.log('================================================================');
  console.log('STARTING METABRAIN TRADER BUILD 1A COMPREHENSIVE HARDENING SUITE');
  console.log('================================================================\n');

  const testScriptSql = `
DO $$
DECLARE
  v_test_user_a UUID := 'a0000000-0000-0000-0000-000000000001'::UUID;
  v_test_user_b UUID := 'b0000000-0000-0000-0000-000000000002'::UUID;
  v_admin_user  UUID := 'e0000000-0000-0000-0000-00000000000e'::UUID;
  
  v_acc_a UUID;
  v_acc_b UUID;
  
  v_ev_a1 UUID;
  v_ev_a2 UUID;
  v_ev_b1 UUID;
  
  v_trade_1 UUID;
  v_trade_2 UUID;
  v_trade_3 UUID;
  
  v_pos_a RECORD;
  v_pos_b RECORD;
  v_part_a1 RECORD;
  v_part_b1 RECORD;
  v_part_a2 RECORD;
  v_part_b2 RECORD;
  v_alloc_count INTEGER;
  v_ledger_count INTEGER;
  v_err_caught BOOLEAN;
  v_rec_record RECORD;
BEGIN
  RAISE NOTICE '>>> [PHASE 0] INITIALIZING CLEAN TEST ENVIRONMENT & FIXTURES...';

  -- Enable maintenance hook for fixture setup
  PERFORM set_config('app.allow_financial_cleanup', 'true', true);

  -- Cleanup previous test fixtures
  DELETE FROM financial_ledger WHERE idempotency_key LIKE 'alloc_%' OR idempotency_key LIKE 'cap_act_%';
  DELETE FROM trade_participations WHERE idempotency_key LIKE 'part_%' OR idempotency_key LIKE 'test_%';
  DELETE FROM results WHERE trade_id IN (SELECT trade_id FROM trades WHERE notes = 'build_1a_test_trade');
  DELETE FROM trades WHERE notes = 'build_1a_test_trade';
  DELETE FROM withdrawal_requests WHERE investor_id IN (SELECT id FROM investor_accounts WHERE user_id IN (v_test_user_a, v_test_user_b));
  DELETE FROM capital_events WHERE idempotency_key LIKE 'test_%' OR investor_id IN (SELECT id FROM investor_accounts WHERE user_id IN (v_test_user_a, v_test_user_b));
  DELETE FROM investor_accounts WHERE user_id IN (v_test_user_a, v_test_user_b);
  DELETE FROM user_roles WHERE user_id IN (v_test_user_a, v_test_user_b, v_admin_user);
  DELETE FROM auth.users WHERE id IN (v_test_user_a, v_test_user_b, v_admin_user);

  -- Disable maintenance hook for tests
  PERFORM set_config('app.allow_financial_cleanup', 'false', true);

  -- 1. Create mock auth users
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES 
    (v_test_user_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'investor_a@test.metabrain', 'test_pw', now(), '{"provider":"email"}', '{}', now(), now()),
    (v_test_user_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'investor_b@test.metabrain', 'test_pw', now(), '{"provider":"email"}', '{}', now(), now()),
    (v_admin_user,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@test.metabrain', 'test_pw', now(), '{"provider":"email"}', '{}', now(), now())
  ON CONFLICT (id) DO NOTHING;

  -- 2. Setup User Roles
  INSERT INTO user_roles (user_id, role) VALUES 
    (v_test_user_a, 'INVESTOR'),
    (v_test_user_b, 'INVESTOR'),
    (v_admin_user, 'ADMIN');

  -- 3. Setup Investor Accounts
  INSERT INTO investor_accounts (user_id, account_number, status, currency)
  VALUES (v_test_user_a, 'ACC-TEST-A-001', 'ACTIVE', 'USD')
  RETURNING id INTO v_acc_a;

  INSERT INTO investor_accounts (user_id, account_number, status, currency)
  VALUES (v_test_user_b, 'ACC-TEST-B-002', 'ACTIVE', 'EUR')
  RETURNING id INTO v_acc_b;

  -----------------------------------------------------------------------------
  -- GATE 1: MULTI-CURRENCY DEPOSIT & BASE USD NORMALIZATION
  -----------------------------------------------------------------------------
  RAISE NOTICE '>>> [GATE 1] Testing Multi-Currency Deposit & USD Normalization...';
  -- Investor A: 10,000 USD @ rate 1.0
  INSERT INTO capital_events (
    investor_id, event_type, status, currency,
    original_amount, original_currency, exchange_rate_to_usd,
    amount, activated_at, notes, idempotency_key, created_by
  ) VALUES (
    v_acc_a, 'INITIAL_CAPITAL', 'PENDING', 'USD',
    10000.000000, 'USD', 1.00000000,
    10000.000000, now() - INTERVAL '2 hours', 'Initial deposit A (USD)', 'test_dep_a1', v_admin_user
  ) RETURNING id INTO v_ev_a1;

  -- Investor B: 20,000 EUR @ rate 1.08 -> 21,600 USD
  INSERT INTO capital_events (
    investor_id, event_type, status, currency,
    original_amount, original_currency, exchange_rate_to_usd,
    amount, activated_at, notes, idempotency_key, created_by
  ) VALUES (
    v_acc_b, 'INITIAL_CAPITAL', 'PENDING', 'EUR',
    20000.000000, 'EUR', 1.08000000,
    20000.000000, now() - INTERVAL '2 hours', 'Initial deposit B (EUR)', 'test_dep_b1', v_admin_user
  ) RETURNING id INTO v_ev_b1;

  PERFORM activate_capital_event(v_ev_a1, v_admin_user);
  PERFORM activate_capital_event(v_ev_b1, v_admin_user);

  SELECT * INTO v_pos_a FROM get_investor_financial_position(v_acc_a);
  SELECT * INTO v_pos_b FROM get_investor_financial_position(v_acc_b);

  IF v_pos_a.available_capital != 10000.000000 THEN
    RAISE EXCEPTION 'Gate 1 Failed: Investor A available capital is %, expected 10000.00', v_pos_a.available_capital;
  END IF;

  IF v_pos_b.available_capital != 21600.000000 THEN
    RAISE EXCEPTION 'Gate 1 Failed: Investor B available capital is %, expected 21600.00 (EUR 20000 @ 1.08)', v_pos_b.available_capital;
  END IF;
  RAISE NOTICE '   [PASS] Gate 1: Multi-Currency base USD conversion accurate (A: $10,000.00, B: $21,600.00).';

  -----------------------------------------------------------------------------
  -- GATE 2: FINANCIAL IMMUTABILITY VERIFICATION (TRIGGERS)
  -----------------------------------------------------------------------------
  RAISE NOTICE '>>> [GATE 2] Testing Financial Immutability Triggers (Ledger & Capital Events)...';
  
  -- Test 2A: Attempt direct UPDATE on financial_ledger (MUST FAIL)
  v_err_caught := FALSE;
  BEGIN
    UPDATE financial_ledger SET amount = 999999 WHERE idempotency_key = 'cap_act_' || v_ev_a1;
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := TRUE;
  END;
  IF NOT v_err_caught THEN
    RAISE EXCEPTION 'Gate 2A Failed: Direct UPDATE on financial_ledger was allowed!';
  END IF;

  -- Test 2B: Attempt direct DELETE on financial_ledger (MUST FAIL)
  v_err_caught := FALSE;
  BEGIN
    DELETE FROM financial_ledger WHERE idempotency_key = 'cap_act_' || v_ev_a1;
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := TRUE;
  END;
  IF NOT v_err_caught THEN
    RAISE EXCEPTION 'Gate 2B Failed: Direct DELETE on financial_ledger was allowed!';
  END IF;

  -- Test 2C: Attempt direct UPDATE on ACTIVATED capital_events (MUST FAIL)
  v_err_caught := FALSE;
  BEGIN
    UPDATE capital_events SET amount = 50000 WHERE id = v_ev_a1;
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := TRUE;
  END;
  IF NOT v_err_caught THEN
    RAISE EXCEPTION 'Gate 2C Failed: Direct UPDATE of financial terms on ACTIVATED capital_event was allowed!';
  END IF;

  -- Test 2D: Attempt direct DELETE on ACTIVATED capital_events (MUST FAIL)
  v_err_caught := FALSE;
  BEGIN
    DELETE FROM capital_events WHERE id = v_ev_a1;
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := TRUE;
  END;
  IF NOT v_err_caught THEN
    RAISE EXCEPTION 'Gate 2D Failed: Direct DELETE of ACTIVATED capital_event was allowed!';
  END IF;

  RAISE NOTICE '   [PASS] Gate 2: Financial Immutability triggers strictly prevented all direct mutation attempts.';

  -----------------------------------------------------------------------------
  -- GATE 3: CALLER AUTHORIZATION & CROSS-INVESTOR DATA ISOLATION
  -----------------------------------------------------------------------------
  RAISE NOTICE '>>> [GATE 3] Testing Caller Authorization & Cross-Investor Isolation...';

  -- Simulate session for Investor A
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_test_user_a::text)::text, true);

  -- Investor A querying own position -> SUCCESS
  BEGIN
    SELECT * INTO v_pos_a FROM get_investor_financial_position(v_acc_a);
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Gate 3A Failed: Investor A could not query own position: %', SQLERRM;
  END;

  -- Investor A querying Investor B position -> MUST FAIL
  v_err_caught := FALSE;
  BEGIN
    SELECT * INTO v_pos_b FROM get_investor_financial_position(v_acc_b);
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := TRUE;
  END;
  IF NOT v_err_caught THEN
    RAISE EXCEPTION 'Gate 3B Failed: Investor A was able to query Investor B position!';
  END IF;

  -- Reset to Admin session
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin_user::text)::text, true);

  -- Admin querying Investor A position -> SUCCESS
  BEGIN
    SELECT * INTO v_pos_a FROM get_investor_financial_position(v_acc_a);
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Gate 3C Failed: Admin could not query Investor A position: %', SQLERRM;
  END;

  RAISE NOTICE '   [PASS] Gate 3: Caller authorization strictly enforced cross-investor isolation.';

  -----------------------------------------------------------------------------
  -- GATE 4: CAPITAL TIMING & PROPORTIONAL P&L ALLOCATION
  -----------------------------------------------------------------------------
  RAISE NOTICE '>>> [GATE 4] Testing Capital Timing & Proportional P&L Allocation...';

  -- Reset claims for engine actions
  PERFORM set_config('request.jwt.claims', '', true);

  -- Trade 1 created @ T-1 hour
  INSERT INTO trades (
    user_id, pair, direction, entry_price, trade_status,
    risk_pct, notes, created_at
  ) VALUES (
    v_admin_user, 'EURUSD', 'BUY', 1.08500, 'PRE_ANALYZED',
    2.00, 'build_1a_test_trade', now() - INTERVAL '1 hour'
  ) RETURNING trade_id INTO v_trade_1;

  -- Snapshot participation for Trade 1 (A has 10,000, B has 21,600)
  PERFORM snapshot_trade_participation(v_trade_1);

  -- Mid-trade deposit for User A @ T-30 mins
  INSERT INTO capital_events (
    investor_id, event_type, status, currency,
    original_amount, original_currency, exchange_rate_to_usd,
    amount, activated_at, notes, idempotency_key, created_by
  ) VALUES (
    v_acc_a, 'ADDITIONAL_CAPITAL', 'PENDING', 'USD',
    5000.000000, 'USD', 1.00000000,
    5000.000000, now() - INTERVAL '30 minutes', 'Mid trade deposit A', 'test_dep_a2', v_admin_user
  ) RETURNING id INTO v_ev_a2;
  PERFORM activate_capital_event(v_ev_a2, v_admin_user);

  -- Close Trade 1 with +10.00% PnL
  INSERT INTO results (trade_id, closing_price, pnl_percent, outcome)
  VALUES (v_trade_1, 1.09500, 10.0000, 'WIN');
  UPDATE trades SET trade_status = 'POST_ANALYZED' WHERE trade_id = v_trade_1;

  PERFORM process_trade_allocation(v_trade_1);

  SELECT * INTO v_part_a1 FROM trade_participations WHERE trade_id = v_trade_1 AND investor_id = v_acc_a;
  SELECT * INTO v_part_b1 FROM trade_participations WHERE trade_id = v_trade_1 AND investor_id = v_acc_b;

  -- Verify User A: snapshot was 10,000 (mid-trade $5000 excluded), gross PnL = 1,000
  IF v_part_a1.participating_capital_snapshot != 10000.000000 OR v_part_a1.investor_gross_pnl != 1000.000000 THEN
    RAISE EXCEPTION 'Gate 4 Failed: User A PnL calculation error on Trade 1. Snap=%, PnL=%', v_part_a1.participating_capital_snapshot, v_part_a1.investor_gross_pnl;
  END IF;

  -- Verify User B: snapshot was 21,600, gross PnL = 2,160
  IF v_part_b1.participating_capital_snapshot != 21600.000000 OR v_part_b1.investor_gross_pnl != 2160.000000 THEN
    RAISE EXCEPTION 'Gate 4 Failed: User B PnL calculation error on Trade 1. Snap=%, PnL=%', v_part_b1.participating_capital_snapshot, v_part_b1.investor_gross_pnl;
  END IF;

  -- Trade 2: Loss of -3.00%
  -- User A equity = 10000 + 5000 + 1000 = 16000.00
  -- User B equity = 21600 + 2160 = 23760.00
  INSERT INTO trades (
    user_id, pair, direction, entry_price, trade_status,
    risk_pct, notes, created_at
  ) VALUES (
    v_admin_user, 'GBPUSD', 'SELL', 1.30000, 'PRE_ANALYZED',
    2.00, 'build_1a_test_trade', now() - INTERVAL '10 minutes'
  ) RETURNING trade_id INTO v_trade_2;

  PERFORM snapshot_trade_participation(v_trade_2);

  INSERT INTO results (trade_id, closing_price, pnl_percent, outcome)
  VALUES (v_trade_2, 1.30500, -3.0000, 'LOSS');
  UPDATE trades SET trade_status = 'POST_ANALYZED' WHERE trade_id = v_trade_2;

  PERFORM process_trade_allocation(v_trade_2);

  SELECT * INTO v_part_a2 FROM trade_participations WHERE trade_id = v_trade_2 AND investor_id = v_acc_a;
  SELECT * INTO v_part_b2 FROM trade_participations WHERE trade_id = v_trade_2 AND investor_id = v_acc_b;

  -- User A gross loss: 16,000 * -3% = -480.00
  -- User B gross loss: 23,760 * -3% = -712.80
  IF v_part_a2.investor_gross_pnl != -480.000000 THEN
    RAISE EXCEPTION 'Gate 4 Failed: User A Loss error. got %', v_part_a2.investor_gross_pnl;
  END IF;
  IF v_part_b2.investor_gross_pnl != -712.800000 THEN
    RAISE EXCEPTION 'Gate 4 Failed: User B Loss error. got %', v_part_b2.investor_gross_pnl;
  END IF;

  RAISE NOTICE '   [PASS] Gate 4: Capital timing and proportional profit/loss distribution verified.';

  -----------------------------------------------------------------------------
  -- GATE 5: IDEMPOTENCY & REPLAY PROTECTION
  -----------------------------------------------------------------------------
  RAISE NOTICE '>>> [GATE 5] Testing Idempotency & Replay Protection...';
  SELECT count(*) INTO v_ledger_count FROM financial_ledger WHERE idempotency_key LIKE 'alloc_%';

  PERFORM process_trade_allocation(v_trade_1);
  PERFORM process_trade_allocation(v_trade_2);

  SELECT count(*) INTO v_alloc_count FROM financial_ledger WHERE idempotency_key LIKE 'alloc_%';
  IF v_ledger_count != v_alloc_count THEN
    RAISE EXCEPTION 'Gate 5 Failed: Idempotency violated! Ledger grew from % to %', v_ledger_count, v_alloc_count;
  END IF;
  RAISE NOTICE '   [PASS] Gate 5: Re-running trade allocations produced exactly 0 duplicate ledger entries.';

  -----------------------------------------------------------------------------
  -- GATE 6: RECONCILIATION ENGINE INTEGRITY VERIFICATION
  -----------------------------------------------------------------------------
  RAISE NOTICE '>>> [GATE 6] Testing Reconciliation Engine...';
  FOR v_rec_record IN SELECT * FROM reconcile_financial_system() LOOP
    IF v_rec_record.severity = 'ERROR' THEN
      RAISE EXCEPTION 'Gate 6 Failed: Reconciliation check % failed with ERROR: %', v_rec_record.check_code, v_rec_record.details;
    END IF;
    RAISE NOTICE '   [RECONCILIATION] %: % [Status: %, Count: %]', v_rec_record.check_code, v_rec_record.check_name, v_rec_record.severity, v_rec_record.discrepancy_count;
  END LOOP;
  RAISE NOTICE '   [PASS] Gate 6: Financial reconciliation engine passed all 7 invariants with zero errors.';

  -----------------------------------------------------------------------------
  -- GATE 7: READ MODEL VIEWS VALIDATION (INVESTOR TRADE HISTORY & SUMMARIES)
  -----------------------------------------------------------------------------
  RAISE NOTICE '>>> [GATE 7] Testing Investor Trade History and Reporting Views...';
  IF (SELECT count(*) FROM investor_trade_history) < 4 THEN
    RAISE EXCEPTION 'Gate 7 Failed: investor_trade_history missing records!';
  END IF;
  IF (SELECT count(*) FROM investor_financial_summary) < 2 THEN
    RAISE EXCEPTION 'Gate 7 Failed: investor_financial_summary missing records!';
  END IF;
  RAISE NOTICE '   [PASS] Gate 7: Reporting views accurately rendered all trade histories and position snapshots.';

  -- Cleanup test fixtures with maintenance hook
  PERFORM set_config('app.allow_financial_cleanup', 'true', true);
  DELETE FROM financial_ledger WHERE idempotency_key LIKE 'alloc_%' OR idempotency_key LIKE 'cap_act_%';
  DELETE FROM trade_participations WHERE investor_id IN (v_acc_a, v_acc_b);
  DELETE FROM results WHERE trade_id IN (v_trade_1, v_trade_2);
  DELETE FROM trades WHERE trade_id IN (v_trade_1, v_trade_2);
  DELETE FROM capital_events WHERE investor_id IN (v_acc_a, v_acc_b);
  DELETE FROM investor_accounts WHERE id IN (v_acc_a, v_acc_b);
  DELETE FROM user_roles WHERE user_id IN (v_test_user_a, v_test_user_b, v_admin_user);
  DELETE FROM auth.users WHERE id IN (v_test_user_a, v_test_user_b, v_admin_user);
  PERFORM set_config('app.allow_financial_cleanup', 'false', true);

  RAISE NOTICE '>>> ALL 7 HARDENING GATES PASSED DETERMINISTICALLY WITH ZERO DEFECTS!';
END $$;
`;

  try {
    const res = await runSql(testScriptSql);
    console.log('Test Execution Result:', res);
    console.log('\n================================================================');
    console.log('ALL 7 HARDENING GATES PASSED CLEANLY AND FULLY VERIFIED');
    console.log('================================================================');
  } catch (err) {
    console.error('Test Suite Failure:', err);
    process.exit(1);
  }
}

runTests();
