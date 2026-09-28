/**
 * Comprehensive Master Stabilization Test Suite
 * Covers Build 1A, Build 1B, Build 1C, Build 1D Hardening, and Production Gateway Invariants
 */

import fs from 'fs';
import https from 'https';

const env = fs.readFileSync('.env', 'utf8');
const tokenMatch = env.match(/superbase_Access_Tokens\s*=\s*(.+)/);
const mgmtToken = tokenMatch ? tokenMatch[1].trim().replace(/^["']|["']$/g, '') : '';
const projectRef = 'jqptprskuxkhfoxsvwcl';

async function runSql(sql) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.supabase.com',
      path: `/v1/projects/${projectRef}/database/query`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mgmtToken}`,
        'Content-Type': 'application/json',
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
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

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${message}`);
    failed++;
  }
}

async function main() {
  console.log('============================================================');
  console.log('METABRAIN TRADER — MASTER STABILIZATION VERIFICATION SUITE');
  console.log('============================================================\n');

  // --- 1. COMPILED SOURCE & GATEWAY INVARIANTS ---
  console.log('--- TEST GROUP 1: APPLICATION GATEWAY & SHELL ---');
  const indexContent = fs.readFileSync('src/routes/index.tsx', 'utf8');
  assert(!indexContent.includes('Landing()'), 'Marketing Landing component removed from root route');
  assert(!indexContent.includes('Foundation release'), 'Marketing slogans removed from root route');
  assert(indexContent.includes('/validator') && indexContent.includes('/auth'), 'Root route serves as auth/validator gateway');

  const boardNavContent = fs.readFileSync('src/lib/board-navigation.ts', 'utf8');
  assert(boardNavContent.includes('Meta Validator'), 'Board defines Meta Validator platform');
  assert(boardNavContent.includes('MetaFund'), 'Board defines MetaFund platform');
  assert(boardNavContent.includes('Community'), 'Board defines Community platform');
  assert(boardNavContent.includes('Profile'), 'Board defines Profile platform');
  assert(!boardNavContent.includes('command-center'), 'Command Center is strictly excluded from global board navigation');

  const routeContent = fs.readFileSync('src/routes/_authenticated/route.tsx', 'utf8');
  assert(routeContent.includes('BOARD_PLATFORMS.map'), 'Board shell renders exactly the canonical 4 platforms');

  // --- 2. SOURCE CORRUPTION & SYNTAX SCAN ---
  console.log('\n--- TEST GROUP 2: SOURCE CORRUPTION & SYNTAX AUDIT ---');
  const tradeCreatorContent = fs.readFileSync('src/routes/_authenticated/trade-creator.tsx', 'utf8');
  assert(!tradeCreatorContent.includes('(\\n'), 'trade-creator.tsx contains no escaped newline syntax error');
  assert(tradeCreatorContent.includes('executed_at: mode === "run"'), 'trade-creator sets authoritative executed_at on Save & Run');

  // --- 3. RPC PRIVILEGES & SECURITY DEFINER LEAST PRIVILEGE ---
  console.log('\n--- TEST GROUP 3: RPC SECURITY & PRIVILEGE AUDIT ---');
  const rpcGrants = await runSql(`
    SELECT routine_name, grantee 
    FROM information_schema.routine_privileges 
    WHERE routine_schema = 'public' 
      AND routine_name IN (
        'activate_capital_event',
        'snapshot_trade_participations',
        'process_trade_result_allocation',
        'create_investment_cycle',
        'activate_investment_cycle',
        'close_investment_cycle',
        'request_withdrawal',
        'approve_withdrawal',
        'settle_withdrawal',
        'reject_withdrawal',
        'reconcile_financial_system',
        'get_investor_financial_position'
      )
      AND grantee IN ('anon', 'PUBLIC');
  `);
  assert(rpcGrants.length === 0, `All sensitive financial RPCs revoked from anon/PUBLIC (Found ${rpcGrants.length} leaks)`);

  // --- 4. FINANCIAL ENGINE CALCULATION & ISOLATION INVARIANTS ---
  console.log('\n--- TEST GROUP 4: FINANCIAL ENGINE & SNAPSHOT EXECUTION TIME ---');
  
  // Fetch an existing auth user id from auth.users or create one
  const authUsers = await runSql(`SELECT id FROM auth.users LIMIT 1;`);
  const testUserId = authUsers.length > 0 ? authUsers[0].id : '00000000-0000-0000-0000-000000000000';
  const testAccNumber = 'TEST-ACC-STAB-01';

  await runSql(`
    SET LOCAL app.allow_financial_cleanup = 'true';
    -- Cleanup prior test runs
    DELETE FROM public.financial_ledger WHERE participation_id IN (SELECT id FROM public.trade_participations WHERE trade_id IN (SELECT trade_id FROM public.trades WHERE pair = 'TESTPAIR')) OR reference_id IN (SELECT trade_id::TEXT FROM public.trades WHERE pair = 'TESTPAIR') OR idempotency_key LIKE 'TEST_%';
    DELETE FROM public.trade_participations WHERE idempotency_key LIKE 'TEST_TP_%' OR trade_id IN (SELECT trade_id FROM public.trades WHERE pair = 'TESTPAIR');
    DELETE FROM public.capital_events WHERE idempotency_key LIKE 'TEST_%';
    DELETE FROM public.trades WHERE pair = 'TESTPAIR';
    DELETE FROM public.investor_accounts WHERE account_number = '${testAccNumber}';

    -- Insert test account for user
    INSERT INTO public.investor_accounts (user_id, account_number, status, currency)
    VALUES ('${testUserId}', '${testAccNumber}', 'ACTIVE', 'USD');
  `);

  const accRes = await runSql(`SELECT id FROM public.investor_accounts WHERE account_number = '${testAccNumber}';`);
  const testAccId = accRes[0].id;

  // 1. Initial Deposit: $10,000 activated at T0 (2 hours ago)
  await runSql(`
    INSERT INTO public.capital_events (
      investor_id, event_type, amount, currency, original_amount, original_currency,
      base_amount_usd, exchange_rate_to_usd, status, effective_at, activated_at, idempotency_key
    ) VALUES (
      '${testAccId}', 'INITIAL_CAPITAL', 10000, 'USD', 10000, 'USD',
      10000, 1.0, 'ACTIVATED', now() - interval '2 hours', now() - interval '2 hours', 'TEST_CAP_1'
    );

    INSERT INTO public.financial_ledger (
      investor_id, event_type, amount, currency, original_amount, original_currency,
      exchange_rate_to_usd, description, idempotency_key, reference_id
    ) VALUES (
      '${testAccId}', 'CAPITAL_ACTIVATED', 10000, 'USD', 10000, 'USD',
      1.0, 'Test capital deposit', 'TEST_LEDGER_1', (SELECT id::TEXT FROM public.capital_events WHERE idempotency_key = 'TEST_CAP_1')
    );
  `);

  // 2. Mid-Trade Deposit: $5,000 activated at T+1 hour (in future relative to trade execution time)
  await runSql(`
    INSERT INTO public.capital_events (
      investor_id, event_type, amount, currency, original_amount, original_currency,
      base_amount_usd, exchange_rate_to_usd, status, effective_at, activated_at, idempotency_key
    ) VALUES (
      '${testAccId}', 'ADDITIONAL_CAPITAL', 5000, 'USD', 5000, 'USD',
      5000, 1.0, 'ACTIVATED', now() + interval '1 hour', now() + interval '1 hour', 'TEST_CAP_FUTURE'
    );

    INSERT INTO public.financial_ledger (
      investor_id, event_type, amount, currency, original_amount, original_currency,
      exchange_rate_to_usd, description, idempotency_key, reference_id
    ) VALUES (
      '${testAccId}', 'ADDITIONAL_CAPITAL', 5000, 'USD', 5000, 'USD',
      1.0, 'Test future deposit', 'TEST_LEDGER_FUTURE', (SELECT id::TEXT FROM public.capital_events WHERE idempotency_key = 'TEST_CAP_FUTURE')
    );
  `);

  // 3. Trade Executed at T0 + 30 mins (1.5 hours ago)
  const tradeInsert = await runSql(`
    INSERT INTO public.trades (
      user_id, pair, direction, trade_status, executed, executed_at, risk_pct
    ) VALUES (
      '${testUserId}', 'TESTPAIR', 'LONG', 'PRE_ANALYSIS', true, now() - interval '90 minutes', 2.0
    ) RETURNING trade_id;
  `);
  const testTradeId = tradeInsert[0].trade_id;

  // Snapshot participations
  await runSql(`SELECT public.snapshot_trade_participations('${testTradeId}');`);

  const partRes = await runSql(`
    SELECT * FROM public.trade_participations WHERE trade_id = '${testTradeId}' AND investor_id = '${testAccId}';
  `);
  assert(partRes.length === 1, 'Trade participation created for eligible investor');
  assert(Number(partRes[0].participating_capital_snapshot) === 10000, `Mid-trade capital excluded: Snapshot is $10,000 (Actual: $${partRes[0]?.participating_capital_snapshot})`);

  // 4. Test Trade Result Allocation (+2% on $10,000)
  await runSql(`
    INSERT INTO public.results (trade_id, pnl_percent, outcome)
    VALUES ('${testTradeId}', 2.00, 'WIN');
  `);

  await runSql(`SELECT public.process_trade_result_allocation('${testTradeId}');`);

  const allocPart = await runSql(`
    SELECT * FROM public.trade_participations WHERE trade_id = '${testTradeId}' AND investor_id = '${testAccId}';
  `);
  assert(Number(allocPart[0].investor_gross_pnl) === 200, `Gross PnL is $200 (+2% on $10,000) (Actual: $${allocPart[0].investor_gross_pnl})`);
  assert(Number(allocPart[0].net_pnl_usd) === 140, `Investor 70% share is $140 (Actual: $${allocPart[0].net_pnl_usd})`);
  assert(Number(allocPart[0].company_cut_usd) === 60, `Company 30% cut is $60 (Actual: $${allocPart[0].company_cut_usd})`);

  // 5. Test Negative Result Allocation (-2% on $10,000 => loss -$200, company cut $0)
  const lossTradeInsert = await runSql(`
    INSERT INTO public.trades (
      user_id, pair, direction, trade_status, executed, executed_at, risk_pct
    ) VALUES (
      '${testUserId}', 'TESTPAIR', 'SHORT', 'PRE_ANALYSIS', true, now() - interval '30 minutes', 2.0
    ) RETURNING trade_id;
  `);
  const lossTradeId = lossTradeInsert[0].trade_id;
  await runSql(`SELECT public.snapshot_trade_participations('${lossTradeId}');`);
  await runSql(`INSERT INTO public.results (trade_id, pnl_percent, outcome) VALUES ('${lossTradeId}', -2.00, 'LOSS');`);
  await runSql(`SELECT public.process_trade_result_allocation('${lossTradeId}');`);

  const lossPart = await runSql(`
    SELECT * FROM public.trade_participations WHERE trade_id = '${lossTradeId}' AND investor_id = '${testAccId}';
  `);
  assert(Number(lossPart[0].net_pnl_usd) === -200, `Investor absorbs 100% of loss (-$200) (Actual: $${lossPart[0].net_pnl_usd})`);
  assert(Number(lossPart[0].company_cut_usd) === 0, `Company fee is $0 on negative trades (Actual: $${lossPart[0].company_cut_usd})`);

  // 6. Test Authoritative executed_at Enforcement: Rejection if executed_at is NULL
  const draftTradeInsert = await runSql(`
    INSERT INTO public.trades (
      user_id, pair, direction, trade_status, executed, executed_at, risk_pct
    ) VALUES (
      '${testUserId}', 'TESTPAIR', 'LONG', 'DRAFT', false, NULL, 2.0
    ) RETURNING trade_id;
  `);
  const draftTradeId = draftTradeInsert[0].trade_id;

  let rejected = false;
  try {
    await runSql(`SELECT public.snapshot_trade_participations('${draftTradeId}');`);
  } catch (e) {
    rejected = true;
  }
  assert(rejected, 'snapshot_trade_participations rejects trade with NULL executed_at (no fallback to created_at)');

  // --- 5. WITHDRAWAL LIFECYCLE & OVER-CAPITAL PREVENTION ---
  console.log('\n--- TEST GROUP 5: WITHDRAWAL LIFECYCLE & OVER-CAPITAL PROTECTION ---');
  // Re-check available capital on testAccId (currently deposited $10k + $5k future - let's query position)
  const posBefore = await runSql(`SELECT * FROM public.get_investor_financial_position('${testAccId}');`);
  const availCap = Number(posBefore[0].available_capital);

  // Test over-withdrawal rejection (exceeding available capital)
  let overWdFailed = false;
  try {
    await runSql(`SELECT public.request_withdrawal('${testAccId}', ${availCap + 5000}, 'TEST_WD_OVER');`);
  } catch (e) {
    overWdFailed = true;
  }
  assert(overWdFailed, `Over-withdrawal request ($${availCap + 5000} against $${availCap}) is rejected`);

  // Test valid withdrawal lifecycle ($2,000)
  const reqRes = await runSql(`SELECT public.request_withdrawal('${testAccId}', 2000, 'TEST_WD_VALID');`);
  const wdReqId = reqRes[0].request_withdrawal.request_id;
  assert(reqRes[0].request_withdrawal.withdrawal_status === 'REQUESTED', 'Withdrawal created in REQUESTED status');

  const appRes = await runSql(`SELECT public.approve_withdrawal('${wdReqId}', 'Admin approved');`);
  assert(appRes[0].approve_withdrawal.withdrawal_status === 'APPROVED', 'Withdrawal transitioned to APPROVED status');

  const setRes = await runSql(`SELECT public.settle_withdrawal('${wdReqId}', 'TXN-REF-123', 'TEST_WD_SETTLE');`);
  assert(setRes[0].settle_withdrawal.withdrawal_status === 'PROCESSED', 'Withdrawal transitioned to PROCESSED status');

  const wdLedger = await runSql(`SELECT * FROM public.financial_ledger WHERE idempotency_key = 'TEST_WD_SETTLE';`);
  assert(wdLedger.length === 1 && Number(wdLedger[0].amount) === -2000, 'Withdrawal processed posted immutable -$2,000 entry on ledger');

  // --- 6. RECONCILIATION INVARIANTS ---
  console.log('\n--- TEST GROUP 6: FINANCIAL SYSTEM RECONCILIATION INVARIANTS ---');
  const reconRes = await runSql(`SELECT * FROM public.reconcile_financial_system();`);
  assert(reconRes.length >= 16, `Reconciliation engine evaluated ${reconRes.length} system invariants`);
  const errorChecks = reconRes.filter(r => r.severity === 'ERROR');
  if (errorChecks.length > 0) {
    console.error('Reconciliation error discrepancies details:', JSON.stringify(errorChecks, null, 2));
  }
  assert(errorChecks.length === 0, `0 reconciliation error discrepancies found (Checked: ${reconRes.map(r => r.check_code).join(', ')})`);

  // Clean up test data
  await runSql(`
    SET LOCAL app.allow_financial_cleanup = 'true';
    DELETE FROM public.financial_ledger WHERE participation_id IN (SELECT id FROM public.trade_participations WHERE trade_id IN ('${testTradeId}', '${lossTradeId}', '${draftTradeId}'));
    DELETE FROM public.trade_participations WHERE trade_id IN ('${testTradeId}', '${lossTradeId}', '${draftTradeId}');
    DELETE FROM public.results WHERE trade_id IN ('${testTradeId}', '${lossTradeId}', '${draftTradeId}');
    DELETE FROM public.trades WHERE trade_id IN ('${testTradeId}', '${lossTradeId}', '${draftTradeId}');
    DELETE FROM public.withdrawal_requests WHERE investor_id = '${testAccId}';
    DELETE FROM public.financial_ledger WHERE idempotency_key LIKE 'TEST_%';
    DELETE FROM public.capital_events WHERE idempotency_key LIKE 'TEST_%';
    DELETE FROM public.investor_accounts WHERE id = '${testAccId}';
  `);

  console.log('\n============================================================');
  console.log(`MASTER SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('============================================================');
}

main().catch(console.error);
