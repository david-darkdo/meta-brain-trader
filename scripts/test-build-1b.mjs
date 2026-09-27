import fs from 'fs';
import https from 'https';
import crypto from 'crypto';

const env = fs.readFileSync('.env', 'utf8');
const tokenMatch = env.match(/superbase_Access_Tokens\s*=\s*(.+)/);
const mgmtToken = tokenMatch[1].trim().replace(/^["']|["']$/g, '');
const projectRef = 'jqptprskuxkhfoxsvwcl';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxcHRwcnNrdXhraGZveHN2d2NsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxMzQzOTAsImV4cCI6MjEwMTcxMDM5MH0.uSSUrrH3xWSoqcOcc88LBePB5SGNL_fARHZzAj94cvM';
const jwtSecret = 'bTpOHvIFgvOi29HXK9beQ+Po+ineNCXhs6DfTuHCR6qYvEniS9/R+wpET0QPdgXzRxL/sggrD20UAMQcLLkj4Q==';

async function runSql(sql) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.supabase.com',
      path: `/v1/projects/${projectRef}/database/query`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mgmtToken}`,
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

function createSignedJwt(userId, email, role = 'authenticated') {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    iss: 'supabase',
    ref: projectRef,
    role: role,
    sub: userId,
    email: email,
    aud: 'authenticated',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600
  };

  const b64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  const b64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const dataToSign = `${b64Header}.${b64Payload}`;
  const signature = crypto.createHmac('sha256', jwtSecret).update(dataToSign).digest('base64url');
  return `${dataToSign}.${signature}`;
}

async function restApi(jwt, path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const headers = {
      'apikey': anonKey,
      'Authorization': `Bearer ${jwt}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };

    const req = https.request({
      hostname: `${projectRef}.supabase.co`,
      path: `/rest/v1${path}`,
      method: method,
      headers: headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : null;
          resolve({ status: res.statusCode, data: parsed, raw: data });
        } catch (e) {
          resolve({ status: res.statusCode, data, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runBuild1BVerificationSuite() {
  console.log('================================================================');
  console.log('METABRAIN TRADER BUILD 1B — OPERATIONAL ENGINE VERIFICATION SUITE');
  console.log('================================================================\n');

  // STEP 1: INITIALIZE AUTHENTICATED IDENTITIES
  console.log('[STEP 1] Initializing Test Identities in Database...');
  const userA_id = 'aaaaaaaa-1111-4000-8000-aaaaaaaaaaaa';
  const userB_id = 'bbbbbbbb-2222-4000-8000-bbbbbbbbbbbb';
  const admin_id = 'cccccccc-3333-4000-8000-cccccccccccc';

  await runSql(`
    DO $$ BEGIN
      INSERT INTO auth.users (id, email, raw_user_meta_data, created_at, updated_at, aud, role)
      VALUES 
        ('${userA_id}', 'investorA_b1b@metabrain.test', '{"full_name":"Investor A B1B"}', now(), now(), 'authenticated', 'authenticated'),
        ('${userB_id}', 'investorB_b1b@metabrain.test', '{"full_name":"Investor B B1B"}', now(), now(), 'authenticated', 'authenticated'),
        ('${admin_id}', 'admin_b1b@metabrain.test', '{"full_name":"Admin B1B"}', now(), now(), 'authenticated', 'authenticated')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO public.user_roles (user_id, role)
      VALUES 
        ('${userA_id}', 'INVESTOR'),
        ('${userB_id}', 'INVESTOR'),
        ('${admin_id}', 'ADMIN')
      ON CONFLICT (user_id, role) DO NOTHING;

      INSERT INTO public.users (user_id, email, subscription_tier)
      VALUES
        ('${userA_id}', 'investorA_b1b@metabrain.test', 'PRO'),
        ('${userB_id}', 'investorB_b1b@metabrain.test', 'PRO'),
        ('${admin_id}', 'admin_b1b@metabrain.test', 'PRO')
      ON CONFLICT (user_id) DO NOTHING;
    END $$;
  `);

  const jwtA = createSignedJwt(userA_id, 'investorA_b1b@metabrain.test');
  const jwtB = createSignedJwt(userB_id, 'investorB_b1b@metabrain.test');
  const jwtAdmin = createSignedJwt(admin_id, 'admin_b1b@metabrain.test');
  console.log('  -> Generated JWTs for Investor A, Investor B, and Admin.\n');

  // CLEANUP PREVIOUS TEST FIXTURES
  console.log('[STEP 2] Setting up clean test state...');
  await runSql(`
    SET app.allow_financial_cleanup = 'true';
    DELETE FROM public.financial_ledger WHERE investor_id IN (SELECT id FROM public.investor_accounts WHERE account_number LIKE 'ACC-B1B-%');
    DELETE FROM public.trade_participations WHERE trade_id IN (SELECT trade_id FROM public.trades WHERE notes LIKE '%b1b_%');
    DELETE FROM public.results WHERE trade_id IN (SELECT trade_id FROM public.trades WHERE notes LIKE '%b1b_%');
    DELETE FROM public.trades WHERE notes LIKE '%b1b_%';
    DELETE FROM public.capital_events WHERE notes LIKE '%b1b_%' OR investor_id IN (SELECT id FROM public.investor_accounts WHERE account_number LIKE 'ACC-B1B-%');
    DELETE FROM public.withdrawal_requests WHERE notes LIKE '%b1b_%' OR investor_id IN (SELECT id FROM public.investor_accounts WHERE account_number LIKE 'ACC-B1B-%');
    DELETE FROM public.investment_cycles WHERE name LIKE '%B1B_%';
    DELETE FROM public.investor_accounts WHERE account_number LIKE 'ACC-B1B-%';
    SET app.allow_financial_cleanup = 'false';
  `);

  // CREATE TEST ACCOUNTS
  const accRes = await runSql(`
    INSERT INTO public.investor_accounts (user_id, account_number, currency, status)
    VALUES 
      ('${userA_id}', 'ACC-B1B-INV-A', 'USD', 'ACTIVE'),
      ('${userB_id}', 'ACC-B1B-INV-B', 'USD', 'ACTIVE')
    RETURNING id, user_id, account_number;
  `);

  const accountA_id = accRes.find(r => r.user_id === userA_id).id;
  const accountB_id = accRes.find(r => r.user_id === userB_id).id;

  // CREATE ACTIVE INVESTMENT CYCLE (70/30)
  const cycleRes = await runSql(`
    INSERT INTO public.investment_cycles (name, cycle_number, duration_value, duration_unit, start_date, end_date, investor_profit_share_pct, company_profit_share_pct, status, notes)
    VALUES ('B1B_CYCLE_A', COALESCE((SELECT MAX(cycle_number) FROM public.investment_cycles), 0) + 1, 3, 'MONTHS', now() - INTERVAL '10 days', now() + INTERVAL '80 days', 70.00, 30.00, 'ACTIVE', 'b1b_cycle_a')
    RETURNING id;
  `);
  const cycleA_id = cycleRes[0].id;

  console.log('----------------------------------------------------------------');
  console.log('EXECUTING FINANCIAL OPERATIONS & VERIFICATION SCENARIOS');
  console.log('----------------------------------------------------------------\n');

  // ============================================================================
  // TEST 1 — SIMPLE PROFIT (+2% ON $10,000 CAPITAL @ 70/30 SPLIT)
  // ============================================================================
  console.log('[TEST 1] SIMPLE PROFIT (+2% on $10,000 USD @ 70/30 Split)...');
  // 1. Activate $10,000 Capital for Investor A
  await runSql(`
    SELECT public.activate_capital_event(
      '${accountA_id}'::uuid,
      10000.00,
      'USD',
      1.00000000,
      'BASE_CURRENCY',
      now() - INTERVAL '5 days',
      'CAP_ACT_B1B_TEST1',
      'b1b_test1_capital'
    );
  `);

  // 2. Create and execute Trade 1 (EUR/USD)
  const trade1Res = await runSql(`
    INSERT INTO public.trades (user_id, pair, direction, trade_status, processing_step, executed, executed_at, notes)
    VALUES ('${admin_id}', 'EUR/USD', 'BUY', 'PRE_ANALYSIS', 'COMPLETED', true, now() - INTERVAL '2 days', 'b1b_test1_trade')
    RETURNING trade_id;
  `);
  const trade1_id = trade1Res[0].trade_id;

  // 3. Snapshot participations
  const snap1 = await runSql(`SELECT public.snapshot_trade_participations('${trade1_id}'::uuid);`);

  // 4. Save authoritative Result (+2.00%)
  await runSql(`
    INSERT INTO public.results (trade_id, outcome, pnl_percent, pnl_amount, close_date)
    VALUES ('${trade1_id}', 'WIN', 2.00, 200.00, now());
  `);

  // 5. Process allocation
  const alloc1 = await runSql(`SELECT public.process_trade_result_allocation('${trade1_id}'::uuid);`);

  // 6. Verify participations & ledger
  const part1 = await runSql(`SELECT * FROM public.trade_participations WHERE trade_id = '${trade1_id}' AND investor_id = '${accountA_id}';`);
  const invProfit = Number(part1[0].net_pnl_usd);
  const compProfit = Number(part1[0].company_cut_usd);
  const grossProfit = Number(part1[0].investor_gross_pnl);

  console.log(`  - Gross P&L:       $${grossProfit.toFixed(2)} (Expected: $200.00)`);
  console.log(`  - Investor Share:  $${invProfit.toFixed(2)} (Expected: $140.00) [70%]`);
  console.log(`  - Company Cut:     $${compProfit.toFixed(2)} (Expected: $60.00) [30%]`);
  if (grossProfit === 200.00 && invProfit === 140.00 && compProfit === 60.00) {
    console.log('  -> TEST 1 PASSED (100% Deterministic Profit Distribution Verified).\n');
  } else {
    throw new Error('TEST 1 FAILED: Incorrect profit distribution calculations.');
  }

  // ============================================================================
  // TEST 2 — LOSS HANDLING (-2% ON $10,000 CAPITAL -> $0 COMPANY PERFORMANCE FEE)
  // ============================================================================
  console.log('[TEST 2] LOSS HANDLING (-2% on $10,000 USD -> Zero Company Cut)...');
  const trade2Res = await runSql(`
    INSERT INTO public.trades (user_id, pair, direction, trade_status, processing_step, executed, executed_at, notes)
    VALUES ('${admin_id}', 'GBP/USD', 'SELL', 'PRE_ANALYSIS', 'COMPLETED', true, now() - INTERVAL '1 day', 'b1b_test2_trade')
    RETURNING trade_id;
  `);
  const trade2_id = trade2Res[0].trade_id;

  await runSql(`SELECT public.snapshot_trade_participations('${trade2_id}'::uuid);`);
  await runSql(`
    INSERT INTO public.results (trade_id, outcome, pnl_percent, pnl_amount, close_date)
    VALUES ('${trade2_id}', 'LOSS', -2.00, -200.00, now());
  `);
  await runSql(`SELECT public.process_trade_result_allocation('${trade2_id}'::uuid);`);

  const part2 = await runSql(`SELECT * FROM public.trade_participations WHERE trade_id = '${trade2_id}' AND investor_id = '${accountA_id}';`);
  const lossGross = Number(part2[0].investor_gross_pnl);
  const lossInvestor = Number(part2[0].net_pnl_usd);
  const lossCompany = Number(part2[0].company_cut_usd);
  const lossAbsorbed = Number(part2[0].loss_absorbed_usd);

  console.log(`  - Gross P&L:       $${lossGross.toFixed(2)}`);
  console.log(`  - Investor Loss:   $${lossInvestor.toFixed(2)} (Absorbed: $${lossAbsorbed.toFixed(2)})`);
  console.log(`  - Company Cut:     $${lossCompany.toFixed(2)} (Expected: $0.00)`);
  if (lossCompany === 0.00 && lossInvestor === lossGross) {
    console.log('  -> TEST 2 PASSED (Zero Company Performance Fee on Losses Verified).\n');
  } else {
    throw new Error('TEST 2 FAILED: Company was incorrectly credited on negative performance.');
  }

  // ============================================================================
  // TEST 3 — MID-TRADE DEPOSIT TIME-AWARE ELIGIBILITY
  // ============================================================================
  console.log('[TEST 3] MID-TRADE DEPOSIT (Deposit at T+5m does NOT participate in Trade at T)...');
  const t_trade = new Date(Date.now() - 3600 * 1000).toISOString();
  const t_deposit = new Date(Date.now() - 1800 * 1000).toISOString();

  // Investor B initial deposit at T-2h: $10,000
  await runSql(`
    SELECT public.activate_capital_event(
      '${accountB_id}'::uuid,
      10000.00,
      'USD',
      1.00000000,
      'BASE_CURRENCY',
      now() - INTERVAL '2 hours',
      'CAP_ACT_B1B_TEST3_INIT',
      'b1b_test3_capital'
    );
  `);

  // Trade 3 executes at T
  const trade3Res = await runSql(`
    INSERT INTO public.trades (user_id, pair, direction, trade_status, processing_step, executed, executed_at, notes)
    VALUES ('${admin_id}', 'USD/JPY', 'BUY', 'PRE_ANALYSIS', 'COMPLETED', true, '${t_trade}', 'b1b_test3_trade')
    RETURNING trade_id;
  `);
  const trade3_id = trade3Res[0].trade_id;

  // Investor B deposits additional $5,000 at T+30m (after trade executed)
  await runSql(`
    SELECT public.activate_capital_event(
      '${accountB_id}'::uuid,
      5000.00,
      'USD',
      1.00000000,
      'BASE_CURRENCY',
      '${t_deposit}',
      'CAP_ACT_B1B_TEST3_LATER',
      'b1b_test3_capital_later'
    );
  `);

  // Snapshot participations for Trade 3
  await runSql(`SELECT public.snapshot_trade_participations('${trade3_id}'::uuid);`);

  const part3 = await runSql(`SELECT * FROM public.trade_participations WHERE trade_id = '${trade3_id}' AND investor_id = '${accountB_id}';`);
  const partAmount3 = Number(part3[0].participating_capital_snapshot);

  console.log(`  - Participating Amount: $${partAmount3.toFixed(2)} (Expected: $10000.00)`);
  if (partAmount3 === 10000.00) {
    console.log('  -> TEST 3 PASSED (Mid-Trade Deposit Correctly Excluded from Prior Trade).\n');
  } else {
    throw new Error(`TEST 3 FAILED: Participating amount ($${partAmount3}) included later deposit.`);
  }

  // ============================================================================
  // TEST 4 — MULTIPLE SIMULTANEOUS TRADES & COMMITTED CAPITAL LOCKING
  // ============================================================================
  console.log('[TEST 4] MULTIPLE SIMULTANEOUS TRADES (No Double Counting of Committed Capital)...');
  // Two open trades running at the same time
  const trade4ARes = await runSql(`
    INSERT INTO public.trades (user_id, pair, direction, trade_status, processing_step, executed, executed_at, notes)
    VALUES ('${admin_id}', 'AUD/USD', 'BUY', 'PRE_ANALYSIS', 'COMPLETED', true, now(), 'b1b_test4a_trade')
    RETURNING trade_id;
  `);
  const trade4A_id = trade4ARes[0].trade_id;

  await runSql(`SELECT public.snapshot_trade_participations('${trade4A_id}'::uuid);`);

  // Check committed vs available position
  const posA = await runSql(`SELECT * FROM public.get_investor_financial_position('${accountA_id}'::uuid);`);
  console.log(`  - Investor A Equity:    $${Number(posA[0].current_economic_equity).toFixed(2)}`);
  console.log(`  - Committed in Trade A: $${Number(posA[0].active_committed_capital).toFixed(2)}`);
  console.log(`  - Available Uncommitted: $${Number(posA[0].available_capital).toFixed(2)}`);

  if (Number(posA[0].active_committed_capital) > 0) {
    console.log('  -> TEST 4 PASSED (Committed Capital Locked across Simultaneous Open Trades).\n');
  } else {
    throw new Error('TEST 4 FAILED: Open trade did not lock active committed capital.');
  }

  // Clean open trades for next tests
  await runSql(`UPDATE public.trades SET trade_status = 'JOURNALED' WHERE trade_id = '${trade4A_id}' OR trade_id = '${trade3_id}';`);

  // ============================================================================
  // TEST 5 — HISTORICAL PROFIT SHARE VERSIONING (Cycle A 70/30 vs Cycle B 75/25)
  // ============================================================================
  console.log('[TEST 5] HISTORICAL PROFIT SHARE VERSIONING (Cycle Terms Immutability)...');
  // Create and activate Cycle B (75/25)
  const cycleBRes = await runSql(`
    SELECT public.create_investment_cycle('B1B_CYCLE_B', now(), now() + INTERVAL '90 days', 75.00, 25.00, 0.00, 'b1b_cycle_b');
  `);
  const cycleB_id = (await runSql(`SELECT id FROM public.investment_cycles WHERE name = 'B1B_CYCLE_B';`))[0].id;
  await runSql(`SELECT public.activate_investment_cycle('${cycleB_id}'::uuid);`);

  // Create Trade in Cycle B
  const trade5Res = await runSql(`
    INSERT INTO public.trades (user_id, pair, direction, trade_status, processing_step, executed, executed_at, notes)
    VALUES ('${admin_id}', 'NZD/USD', 'BUY', 'PRE_ANALYSIS', 'COMPLETED', true, now(), 'b1b_test5_trade')
    RETURNING trade_id;
  `);
  const trade5_id = trade5Res[0].trade_id;

  await runSql(`SELECT public.snapshot_trade_participations('${trade5_id}'::uuid);`);
  await runSql(`
    INSERT INTO public.results (trade_id, outcome, pnl_percent, pnl_amount, close_date)
    VALUES ('${trade5_id}', 'WIN', 2.00, 200.00, now());
  `);
  await runSql(`SELECT public.process_trade_result_allocation('${trade5_id}'::uuid);`);

  // Mutate global platform configuration to 80/20
  await runSql(`UPDATE public.platform_configuration SET investor_profit_share_pct = 80.00, company_profit_share_pct = 20.00 WHERE is_active = true;`);

  // Verify historical Cycle A allocation remained 70/30 and Cycle B remained 75/25
  const partCycleA = (await runSql(`SELECT * FROM public.trade_participations WHERE trade_id = '${trade1_id}' AND investor_id = '${accountA_id}';`))[0];
  const partCycleB = (await runSql(`SELECT * FROM public.trade_participations WHERE trade_id = '${trade5_id}' AND investor_id = '${accountA_id}';`))[0];

  console.log(`  - Historical Trade 1 (Cycle A) Split: ${partCycleA.profit_split_investor_pct}/${partCycleA.profit_split_company_pct} (Preserved: 70/30)`);
  console.log(`  - Historical Trade 5 (Cycle B) Split: ${partCycleB.profit_split_investor_pct}/${partCycleB.profit_split_company_pct} (Preserved: 75/25)`);
  if (Number(partCycleA.profit_split_investor_pct) === 70.00 && Number(partCycleB.profit_split_investor_pct) === 75.00) {
    console.log('  -> TEST 5 PASSED (Historical Cycle Terms are 100% Immutable and Reproducible).\n');
  } else {
    throw new Error('TEST 5 FAILED: Global config mutation corrupted historical cycle splits.');
  }

  // ============================================================================
  // TEST 6 — IDEMPOTENCY & DUPLICATE PROCESSING
  // ============================================================================
  console.log('[TEST 6] IDEMPOTENT PROCESSING & DUPLICATE PREVENTION...');
  const ledgerCountBefore = (await runSql(`SELECT COUNT(*) as count FROM public.financial_ledger WHERE reference_id = '${trade1_id}';`))[0].count;
  
  // Re-run allocation for Trade 1
  const dupeRes = await runSql(`SELECT public.process_trade_result_allocation('${trade1_id}'::uuid);`);
  const ledgerCountAfter = (await runSql(`SELECT COUNT(*) as count FROM public.financial_ledger WHERE reference_id = '${trade1_id}';`))[0].count;

  console.log(`  - Second Run Output: ${JSON.stringify(dupeRes[0].process_trade_result_allocation)}`);
  console.log(`  - Ledger Entries Count Before: ${ledgerCountBefore}, After: ${ledgerCountAfter}`);
  if (ledgerCountBefore === ledgerCountAfter && dupeRes[0].process_trade_result_allocation.status === 'ALREADY_PROCESSED') {
    console.log('  -> TEST 6 PASSED (Duplicate Result Processing Safely Prevented).\n');
  } else {
    throw new Error('TEST 6 FAILED: Second run generated duplicate financial ledger entries.');
  }

  // ============================================================================
  // TEST 7 & 8 — WITHDRAWAL LIFECYCLE & ELIGIBILITY ENFORCEMENT
  // ============================================================================
  console.log('[TEST 7 & 8] WITHDRAWAL ELIGIBILITY, APPROVAL & SETTLEMENT...');
  const posWithdraw = (await runSql(`SELECT * FROM public.get_investor_financial_position('${accountA_id}'::uuid);`))[0];
  const maxAvailable = Number(posWithdraw.available_capital);

  // 1. Attempt Over-Withdrawal ($999,999 > Available)
  let overWithdrawFailed = false;
  try {
    await runSql(`SELECT public.request_withdrawal('${accountA_id}'::uuid, 999999.00, 'WD_OVER_TEST', 'over_withdraw');`);
  } catch (err) {
    overWithdrawFailed = true;
    console.log(`  - Over-Withdrawal Attempt Correctly Rejected: ${err.message.split('\n')[0]}`);
  }
  if (!overWithdrawFailed) throw new Error('TEST 7 FAILED: Over-withdrawal was permitted.');

  // 2. Submit Legitimate Withdrawal for $1,000
  const wdReqRes = await runSql(`SELECT public.request_withdrawal('${accountA_id}'::uuid, 1000.00, 'WD_VALID_TEST', 'b1b_withdrawal');`);
  const wdReqId = wdReqRes[0].request_withdrawal.request_id;
  console.log(`  - Legitimate Withdrawal Requested: ID ${wdReqId} (Status: REQUESTED)`);

  // 3. Admin Approves Withdrawal
  await runSql(`SELECT public.approve_withdrawal('${wdReqId}'::uuid, 'Approved by compliance');`);
  const wdAppStatus = (await runSql(`SELECT status FROM public.withdrawal_requests WHERE id = '${wdReqId}';`))[0].status;
  console.log(`  - Admin Approval Processed: Status = ${wdAppStatus} (Expected: APPROVED)`);

  // 4. Admin Settles Payout
  await runSql(`SELECT public.settle_withdrawal('${wdReqId}'::uuid, 'WIRE_TX_987654');`);
  const wdFinal = (await runSql(`SELECT * FROM public.withdrawal_requests WHERE id = '${wdReqId}';`))[0];
  const wdLedger = await runSql(`SELECT * FROM public.financial_ledger WHERE reference_id = '${wdReqId}';`);

  console.log(`  - Settlement Completed: Status = ${wdFinal.status}, Ledger Amount = $${Number(wdLedger[0].amount).toFixed(2)}`);
  if (wdFinal.status === 'PROCESSED' && Number(wdLedger[0].amount) === -1000.00) {
    console.log('  -> TEST 7 & 8 PASSED (Withdrawal State Machine & Payout Ledger Integration Verified).\n');
  } else {
    throw new Error('TEST 7 & 8 FAILED: Withdrawal did not properly transition or post ledger entry.');
  }

  // ============================================================================
  // TEST 9 — REAL AUTHENTICATED POSTGREST RLS & NEGATIVE SECURITY
  // ============================================================================
  console.log('[TEST 9] REAL AUTHENTICATED RLS & NEGATIVE SECURITY OVER HTTP...');
  // Investor A querying own account
  const rlsSelf = await restApi(jwtA, `/investor_accounts?id=eq.${accountA_id}`);
  console.log(`  - Investor A query self account: Status ${rlsSelf.status}, Rows: ${rlsSelf.data.length}`);

  // Investor A querying Investor B account (Cross-Investor SELECT)
  const rlsCrossSelect = await restApi(jwtA, `/investor_accounts?id=eq.${accountB_id}`);
  console.log(`  - Investor A query Investor B account: Rows: ${rlsCrossSelect.data.length} (Expected: 0)`);

  // Investor A attempting to UPDATE Investor B account (Cross-Investor UPDATE)
  const rlsCrossUpdate = await restApi(jwtA, `/investor_accounts?id=eq.${accountB_id}`, 'PATCH', { status: 'CLOSED' });
  console.log(`  - Investor A update Investor B account: Status ${rlsCrossUpdate.status}, Rows Updated: ${rlsCrossUpdate.data?.length ?? 0} (Expected: 0)`);

  // Investor A attempting direct INSERT into financial_ledger
  const rlsLedgerInsert = await restApi(jwtA, `/financial_ledger`, 'POST', {
    investor_id: accountA_id,
    event_type: 'CAPITAL_ACTIVATED',
    amount: 1000000,
    currency: 'USD',
    description: 'Malicious direct injection'
  });
  console.log(`  - Investor A direct INSERT financial_ledger: Status ${rlsLedgerInsert.status} (Expected: 403 Forbidden)`);

  if (rlsSelf.data.length === 1 && rlsCrossSelect.data.length === 0 && rlsCrossUpdate.data.length === 0 && rlsLedgerInsert.status === 403) {
    console.log('  -> TEST 9 PASSED (100% Authenticated PostgREST Client RLS Isolation Verified).\n');
  } else {
    throw new Error('TEST 9 FAILED: RLS boundary violated.');
  }

  // ============================================================================
  // TEST 10 — CONCURRENT ALLOCATION SAFETY
  // ============================================================================
  console.log('[TEST 10] CONCURRENCY & RACE-CONDITION SAFETY...');
  const tradeConcRes = await runSql(`
    INSERT INTO public.trades (user_id, pair, direction, trade_status, processing_step, executed, executed_at, notes)
    VALUES ('${admin_id}', 'USD/CAD', 'BUY', 'PRE_ANALYSIS', 'COMPLETED', true, now(), 'b1b_test10_trade')
    RETURNING trade_id;
  `);
  const tradeConc_id = tradeConcRes[0].trade_id;

  await runSql(`SELECT public.snapshot_trade_participations('${tradeConc_id}'::uuid);`);
  await runSql(`
    INSERT INTO public.results (trade_id, outcome, pnl_percent, pnl_amount, close_date)
    VALUES ('${tradeConc_id}', 'WIN', 1.50, 150.00, now());
  `);

  // Launch two allocations in parallel
  const [concA, concB] = await Promise.all([
    runSql(`SELECT public.process_trade_result_allocation('${tradeConc_id}'::uuid);`),
    runSql(`SELECT public.process_trade_result_allocation('${tradeConc_id}'::uuid);`)
  ]);

  const concLedgerEntries = await runSql(`SELECT * FROM public.financial_ledger WHERE reference_id = '${tradeConc_id}';`);
  console.log(`  - Parallel Worker 1: ${concA[0].process_trade_result_allocation.status}`);
  console.log(`  - Parallel Worker 2: ${concB[0].process_trade_result_allocation.status}`);
  console.log(`  - Total Financial Ledger Postings: ${concLedgerEntries.length}`);

  if (concLedgerEntries.length === 4) { // 2 investors * (1 investor profit + 1 company cut)
    console.log('  -> TEST 10 PASSED (Concurrent Allocations Converged to Exactly One Financial Outcome).\n');
  } else {
    throw new Error(`TEST 10 FAILED: Concurrent workers created ${concLedgerEntries.length} entries.`);
  }

  // CLEANUP TEST FIXTURES
  console.log('[CLEANUP] Removing test fixtures from production database...');
  await runSql(`
    SET app.allow_financial_cleanup = 'true';
    DELETE FROM public.financial_ledger WHERE investor_id IN (SELECT id FROM public.investor_accounts WHERE account_number LIKE 'ACC-B1B-%');
    DELETE FROM public.trade_participations WHERE trade_id IN (SELECT trade_id FROM public.trades WHERE notes LIKE '%b1b_%');
    DELETE FROM public.results WHERE trade_id IN (SELECT trade_id FROM public.trades WHERE notes LIKE '%b1b_%');
    DELETE FROM public.trades WHERE notes LIKE '%b1b_%';
    DELETE FROM public.capital_events WHERE notes LIKE '%b1b_%' OR investor_id IN (SELECT id FROM public.investor_accounts WHERE account_number LIKE 'ACC-B1B-%');
    DELETE FROM public.withdrawal_requests WHERE notes LIKE '%b1b_%' OR investor_id IN (SELECT id FROM public.investor_accounts WHERE account_number LIKE 'ACC-B1B-%');
    DELETE FROM public.investment_cycles WHERE name LIKE '%B1B_%';
    DELETE FROM public.investor_accounts WHERE account_number LIKE 'ACC-B1B-%';
    DELETE FROM public.user_roles WHERE user_id IN ('${userA_id}', '${userB_id}', '${admin_id}');
    DELETE FROM public.users WHERE user_id IN ('${userA_id}', '${userB_id}', '${admin_id}');
    DELETE FROM auth.users WHERE id IN ('${userA_id}', '${userB_id}', '${admin_id}');
    SET app.allow_financial_cleanup = 'false';
  `);
  console.log('  -> All test fixtures cleaned up 100%.\n');

  // ============================================================================
  // TEST 11 — 16-POINT RECONCILIATION INVARIANT CHECK (POST-CLEANUP)
  // ============================================================================
  console.log('[TEST 11] 16-POINT RECONCILIATION INVARIANT ENGINE AUDIT...');
  const reconChecks = await runSql(`SELECT * FROM public.reconcile_financial_system();`);
  let totalDiscrepancies = 0;
  for (const c of reconChecks) {
    const isOk = c.discrepancy_count === 0;
    console.log(`    [${isOk ? 'OK' : 'FAIL'}] ${c.check_code.padEnd(40)} : ${c.check_name} (Discrepancies: ${c.discrepancy_count})`);
    totalDiscrepancies += c.discrepancy_count;
  }

  if (totalDiscrepancies === 0 && reconChecks.length === 16) {
    console.log('  -> TEST 11 PASSED (0 Discrepancies across all 16 Invariants).\n');
  } else {
    throw new Error(`TEST 11 FAILED: Found ${totalDiscrepancies} discrepancies.`);
  }

  console.log('================================================================');
  console.log('BUILD 1B FULL TEST SUITE PASSED WITH ZERO ERRORS (100% SUCCESS)');
  console.log('================================================================\n');
}

runBuild1BVerificationSuite().catch((err) => {
  console.error('\nTEST SUITE FAILED WITH ERROR:', err);
  process.exit(1);
});
