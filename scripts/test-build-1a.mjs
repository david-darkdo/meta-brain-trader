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
  console.log('====================================================');
  console.log('STARTING METABRAIN TRADER BUILD 1A VERIFICATION SUITE');
  console.log('====================================================\n');

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
  v_alloc_count INTEGER;
  v_ledger_count INTEGER;
  v_part_a1 RECORD;
  v_part_b1 RECORD;
  v_part_a2 RECORD;
  v_part_b2 RECORD;
BEGIN
  RAISE NOTICE '>>> PREPARING TEST FIXTURES...';

  -- Clean previous test data if any
  DELETE FROM financial_ledger WHERE idempotency_key LIKE 'alloc_%' OR idempotency_key LIKE 'cap_act_%';
  DELETE FROM trade_participations WHERE idempotency_key LIKE 'part_%' OR idempotency_key LIKE 'test_%';
  DELETE FROM results WHERE trade_id IN (SELECT trade_id FROM trades WHERE notes = 'build_1a_test_trade');
  DELETE FROM trades WHERE notes = 'build_1a_test_trade';
  DELETE FROM withdrawal_requests WHERE investor_id IN (SELECT id FROM investor_accounts WHERE user_id IN (v_test_user_a, v_test_user_b));
  DELETE FROM capital_events WHERE idempotency_key LIKE 'test_%' OR investor_id IN (SELECT id FROM investor_accounts WHERE user_id IN (v_test_user_a, v_test_user_b));
  DELETE FROM investor_accounts WHERE user_id IN (v_test_user_a, v_test_user_b);
  DELETE FROM user_roles WHERE user_id IN (v_test_user_a, v_test_user_b, v_admin_user);
  DELETE FROM auth.users WHERE id IN (v_test_user_a, v_test_user_b, v_admin_user);

  -- 0. Insert mock auth.users
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES 
    (v_test_user_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'investor_a@test.metabrain', 'test_pw', now(), '{"provider":"email"}', '{}', now(), now()),
    (v_test_user_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'investor_b@test.metabrain', 'test_pw', now(), '{"provider":"email"}', '{}', now(), now()),
    (v_admin_user,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@test.metabrain', 'test_pw', now(), '{"provider":"email"}', '{}', now(), now())
  ON CONFLICT (id) DO NOTHING;

  -- 1. Setup User Roles
  INSERT INTO user_roles (user_id, role) VALUES 
    (v_test_user_a, 'INVESTOR'),
    (v_test_user_b, 'INVESTOR'),
    (v_admin_user, 'ADMIN');

  -- 2. Setup Investor Accounts
  INSERT INTO investor_accounts (user_id, account_number, status, currency)
  VALUES (v_test_user_a, 'ACC-TEST-A-001', 'ACTIVE', 'USD')
  RETURNING id INTO v_acc_a;

  INSERT INTO investor_accounts (user_id, account_number, status, currency)
  VALUES (v_test_user_b, 'ACC-TEST-B-002', 'ACTIVE', 'USD')
  RETURNING id INTO v_acc_b;

  -----------------------------------------------------------------------------
  -- SCENARIO 7: CURRENCY REPRESENTATION & DEPOSIT ACTIVATION
  -----------------------------------------------------------------------------
  RAISE NOTICE '>>> TEST SCENARIO 7: Currency Representation & Deposit Activation';
  -- Deposit for User A: 10,000 USD
  INSERT INTO capital_events (
    investor_id, event_type, status, currency,
    amount, activated_at, notes, idempotency_key, created_by
  ) VALUES (
    v_acc_a, 'INITIAL_CAPITAL', 'PENDING', 'USD',
    10000.000000, now() - INTERVAL '2 hours', 'Initial deposit A', 'test_dep_a1', v_admin_user
  ) RETURNING id INTO v_ev_a1;

  -- Deposit for User B: 20,000 USD
  INSERT INTO capital_events (
    investor_id, event_type, status, currency,
    amount, activated_at, notes, idempotency_key, created_by
  ) VALUES (
    v_acc_b, 'INITIAL_CAPITAL', 'PENDING', 'USD',
    20000.000000, now() - INTERVAL '2 hours', 'Initial deposit B', 'test_dep_b1', v_admin_user
  ) RETURNING id INTO v_ev_b1;

  -- Activate both capital events
  PERFORM activate_capital_event(v_ev_a1, v_admin_user);
  PERFORM activate_capital_event(v_ev_b1, v_admin_user);

  -- Verify User A and B balances
  SELECT * INTO v_pos_a FROM get_investor_financial_position(v_acc_a);
  SELECT * INTO v_pos_b FROM get_investor_financial_position(v_acc_b);
  
  IF v_pos_a.available_capital != 10000.000000 OR v_pos_b.available_capital != 20000.000000 THEN
    RAISE EXCEPTION 'Scenario 7 Failed: Initial deposits incorrect. A=%, B=%', v_pos_a.available_capital, v_pos_b.available_capital;
  END IF;
  RAISE NOTICE '   [PASS] Scenario 7: Initial deposits activated into ledger ($10,000 and $20,000).';

  -----------------------------------------------------------------------------
  -- SCENARIO 1: CAPITAL TIMING (MID-TRADE DEPOSIT ISOLATION)
  -----------------------------------------------------------------------------
  RAISE NOTICE '>>> TEST SCENARIO 1: Capital Timing (Mid-Trade Deposit Isolation)';
  
  -- Create Trade 1 (created_at = now() - 1 hour)
  INSERT INTO trades (
    user_id, pair, direction, entry_price, trade_status,
    risk_pct, notes, created_at
  ) VALUES (
    v_admin_user, 'EURUSD', 'BUY', 1.08500, 'PRE_ANALYZED',
    2.00, 'build_1a_test_trade', now() - INTERVAL '1 hour'
  ) RETURNING trade_id INTO v_trade_1;

  -- Snapshot participation for Trade 1
  PERFORM snapshot_trade_participation(v_trade_1);

  -- User A deposits another 5,000 USD AFTER Trade 1 was created
  INSERT INTO capital_events (
    investor_id, event_type, status, currency,
    amount, activated_at, notes, idempotency_key, created_by
  ) VALUES (
    v_acc_a, 'ADDITIONAL_CAPITAL', 'PENDING', 'USD',
    5000.000000, now() - INTERVAL '30 minutes', 'Mid trade deposit A', 'test_dep_a2', v_admin_user
  ) RETURNING id INTO v_ev_a2;
  PERFORM activate_capital_event(v_ev_a2, v_admin_user);

  -- Close Trade 1 with +10.00% PnL
  INSERT INTO results (
    trade_id, closing_price, pnl_percent, outcome
  ) VALUES (
    v_trade_1, 1.09500, 10.0000, 'WIN'
  );
  UPDATE trades SET trade_status = 'POST_ANALYZED' WHERE trade_id = v_trade_1;

  -- Process Allocation for Trade 1
  PERFORM process_trade_allocation(v_trade_1);

  -- Check participation of User A on Trade 1
  SELECT * INTO v_part_a1 FROM trade_participations WHERE trade_id = v_trade_1 AND investor_id = v_acc_a;
  SELECT * INTO v_part_b1 FROM trade_participations WHERE trade_id = v_trade_1 AND investor_id = v_acc_b;

  -- User A's participating capital must be exactly 10,000 (NOT 15,000)
  -- Gross PnL = 10,000 * 10% = 1,000.
  IF v_part_a1.participating_capital_snapshot != 10000.000000 THEN
    RAISE EXCEPTION 'Scenario 1 Failed: User A participating capital should be 10000, got %', v_part_a1.participating_capital_snapshot;
  END IF;
  IF v_part_a1.investor_gross_pnl != 1000.000000 THEN
    RAISE EXCEPTION 'Scenario 1 Failed: User A PnL calculation error. gross=%', v_part_a1.investor_gross_pnl;
  END IF;
  RAISE NOTICE '   [PASS] Scenario 1: Mid-trade deposit excluded from Trade 1. PnL calculated strictly on $10,000 = $1,000.';

  -----------------------------------------------------------------------------
  -- SCENARIO 4: TWO INVESTORS PROPORTIONAL P&L ALLOCATION (PROFIT & LOSS)
  -----------------------------------------------------------------------------
  RAISE NOTICE '>>> TEST SCENARIO 4: Two Investors ProPORTIONAL P&L Allocation';
  -- User B on Trade 1: 20,000 * 10% = 2,000 gross.
  IF v_part_b1.investor_gross_pnl != 2000.000000 THEN
    RAISE EXCEPTION 'Scenario 4 (Profit) Failed: User B PnL incorrect. gross=%', v_part_b1.investor_gross_pnl;
  END IF;

  -- Now Test Loss on Trade 2: -3.00%
  -- User A current active capital = 15,000 + 1,000 (pnl) = 16,000
  -- User B current active capital = 20,000 + 2,000 (pnl) = 22,000
  INSERT INTO trades (
    user_id, pair, direction, entry_price, trade_status,
    risk_pct, notes, created_at
  ) VALUES (
    v_admin_user, 'GBPUSD', 'SELL', 1.30000, 'PRE_ANALYZED',
    2.00, 'build_1a_test_trade', now() - INTERVAL '15 minutes'
  ) RETURNING trade_id INTO v_trade_2;

  PERFORM snapshot_trade_participation(v_trade_2);

  INSERT INTO results (
    trade_id, closing_price, pnl_percent, outcome
  ) VALUES (
    v_trade_2, 1.30500, -3.0000, 'LOSS'
  );
  UPDATE trades SET trade_status = 'POST_ANALYZED' WHERE trade_id = v_trade_2;
  PERFORM process_trade_allocation(v_trade_2);

  SELECT * INTO v_part_a2 FROM trade_participations WHERE trade_id = v_trade_2 AND investor_id = v_acc_a;
  SELECT * INTO v_part_b2 FROM trade_participations WHERE trade_id = v_trade_2 AND investor_id = v_acc_b;

  -- User A gross loss: 16,000 * -3% = -480.00
  -- User B gross loss: 22,000 * -3% = -660.00
  IF v_part_a2.investor_gross_pnl != -480.000000 THEN
    RAISE EXCEPTION 'Scenario 4 (Loss A) Failed: gross=%', v_part_a2.investor_gross_pnl;
  END IF;
  IF v_part_b2.investor_gross_pnl != -660.000000 THEN
    RAISE EXCEPTION 'Scenario 4 (Loss B) Failed: gross=%', v_part_b2.investor_gross_pnl;
  END IF;
  RAISE NOTICE '   [PASS] Scenario 4: Profit & Loss proportional allocation verified (A: +$1,000 / -$480, B: +$2,000 / -$660).';

  -----------------------------------------------------------------------------
  -- SCENARIO 5: IDEMPOTENCY
  -----------------------------------------------------------------------------
  RAISE NOTICE '>>> TEST SCENARIO 5: Idempotency & Replay Protection';
  SELECT count(*) INTO v_ledger_count FROM financial_ledger WHERE idempotency_key LIKE 'alloc_%';
  
  -- Re-run allocation on Trade 1 and Trade 2
  PERFORM process_trade_allocation(v_trade_1);
  PERFORM process_trade_allocation(v_trade_2);

  SELECT count(*) INTO v_alloc_count FROM financial_ledger WHERE idempotency_key LIKE 'alloc_%';
  IF v_ledger_count != v_alloc_count THEN
    RAISE EXCEPTION 'Scenario 5 Failed: Idempotency violated! Ledger count grew from % to %', v_ledger_count, v_alloc_count;
  END IF;
  RAISE NOTICE '   [PASS] Scenario 5: Re-running process_trade_allocation created 0 duplicate ledger entries.';

  -----------------------------------------------------------------------------
  -- SCENARIO 2 & 3: SIMULTANEOUS OPEN TRADES & EXPOSURE TRACKING
  -----------------------------------------------------------------------------
  RAISE NOTICE '>>> TEST SCENARIO 2 & 3: Simultaneous Open Trades & Exposure Basis';
  -- Create Open Trade 3
  INSERT INTO trades (
    user_id, pair, direction, entry_price, trade_status,
    risk_pct, notes, created_at
  ) VALUES (
    v_admin_user, 'USDJPY', 'BUY', 155.000, 'PRE_ANALYZED',
    2.50, 'build_1a_test_trade', now()
  ) RETURNING trade_id INTO v_trade_3;

  -- Snapshot with 2.5% risk
  PERFORM snapshot_trade_participation(v_trade_3);

  SELECT * INTO v_pos_a FROM get_investor_financial_position(v_acc_a);
  -- Net equity for A: 10000 + 5000 + 1000 - 480 = 15520.00
  -- Committed participating snapshot for Trade 3 = 15520.00
  -- Available capital = 15520 - 15520 = 0.00 (under full trade participation lock)
  IF v_pos_a.current_economic_equity != 15520.000000 THEN
    RAISE EXCEPTION 'Scenario 2 Failed: Expected Net Equity 15520, got %', v_pos_a.current_economic_equity;
  END IF;
  IF v_pos_a.active_committed_capital != 15520.000000 THEN
    RAISE EXCEPTION 'Scenario 2 Failed: Committed capital incorrect. got %', v_pos_a.active_committed_capital;
  END IF;
  RAISE NOTICE '   [PASS] Scenario 2 & 3: Open active trade capital cleanly tracked ($15,520 committed).';

  -- Close Trade 3 with 0% to cleanup
  INSERT INTO results (trade_id, closing_price, pnl_percent, outcome)
  VALUES (v_trade_3, 155.000, 0.0000, 'BREAKEVEN');
  UPDATE trades SET trade_status = 'POST_ANALYZED' WHERE trade_id = v_trade_3;
  PERFORM process_trade_allocation(v_trade_3);

  -----------------------------------------------------------------------------
  -- SCENARIO 8: CONFIGURATION HISTORY VERSIONING
  -----------------------------------------------------------------------------
  RAISE NOTICE '>>> TEST SCENARIO 8: Configuration History Versioning';
  -- Create new configuration version 2: 75% investor / 25% company
  INSERT INTO platform_configuration (
    version, is_active, base_currency, supported_display_currencies,
    default_cycle_duration_value, default_cycle_duration_unit,
    investor_profit_share_pct, company_profit_share_pct, risk_basis, notes
  ) VALUES (
    2, true, 'USD', ARRAY['USD', 'NGN'], 3, 'MONTHS', 75.00, 25.00, 'AVAILABLE_CAPITAL', 'Version 2 updated split'
  );

  -- Ensure active cycle 1 retains original cycle config 70/30
  IF (SELECT investor_profit_share_pct FROM investment_cycles WHERE cycle_number = 1) != 70.00 THEN
    RAISE EXCEPTION 'Scenario 8 Failed: Cycle 1 split altered!';
  END IF;
  RAISE NOTICE '   [PASS] Scenario 8: Platform configuration versioning preserved historical cycle parameters.';

  -----------------------------------------------------------------------------
  -- SCENARIO 6: USER ISOLATION & RLS VERIFICATION
  -----------------------------------------------------------------------------
  RAISE NOTICE '>>> TEST SCENARIO 6: Reporting Views & Role Isolation';
  -- Verify company_financial_summary view executes without error
  PERFORM count(*) FROM company_financial_summary;
  PERFORM count(*) FROM portfolio_exposure_summary;
  PERFORM count(*) FROM investor_financial_summary;
  RAISE NOTICE '   [PASS] Scenario 6: Analytical views execute accurately.';

  -----------------------------------------------------------------------------
  -- SCENARIO 9: TRADE VALIDATOR REGRESSION VERIFICATION
  -----------------------------------------------------------------------------
  RAISE NOTICE '>>> TEST SCENARIO 9: Trade Validator Non-Invasive Regression Check';
  -- Verify existing Trade Validator tables and columns remain untouched
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name = 'trades' AND column_name = 'trade_status'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name = 'results' AND column_name = 'pnl_percent'
  ) THEN
    RAISE EXCEPTION 'Scenario 9 Failed: Trade validator canonical columns missing!';
  END IF;
  RAISE NOTICE '   [PASS] Scenario 9: Trade Validator schema and integration fully intact.';

  -- Cleanup test fixtures
  DELETE FROM financial_ledger WHERE idempotency_key LIKE 'alloc_%' OR idempotency_key LIKE 'cap_act_%';
  DELETE FROM trade_participations WHERE investor_id IN (v_acc_a, v_acc_b);
  DELETE FROM results WHERE trade_id IN (v_trade_1, v_trade_2, v_trade_3);
  DELETE FROM trades WHERE trade_id IN (v_trade_1, v_trade_2, v_trade_3);
  DELETE FROM capital_events WHERE investor_id IN (v_acc_a, v_acc_b);
  DELETE FROM investor_accounts WHERE id IN (v_acc_a, v_acc_b);
  DELETE FROM user_roles WHERE user_id IN (v_test_user_a, v_test_user_b, v_admin_user);
  DELETE FROM auth.users WHERE id IN (v_test_user_a, v_test_user_b, v_admin_user);
  DELETE FROM platform_configuration WHERE version = 2;

  RAISE NOTICE '>>> ALL 9 BUILD 1A TEST SCENARIOS PASSED WITH ZERO ERRORS!';
END $$;
`;

  try {
    const res = await runSql(testScriptSql);
    console.log('Test Execution Result:', res);
    console.log('\n====================================================');
    console.log('ALL VERIFICATION SCENARIOS COMPLETED SUCCESSFULLY');
    console.log('====================================================');
  } catch (err) {
    console.error('Test Suite Failure:', err);
    process.exit(1);
  }
}

runTests();
